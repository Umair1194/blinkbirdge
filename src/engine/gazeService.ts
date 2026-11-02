import { HeadStability, headPosition } from './headStability'
import { calibrationFitUsable, calibrationUsable } from './trackingQuality'
import { CameraError, listCameras, requestCamera, stopStream } from "./camera"
import { isFacing } from "./faceMetrics"
import { SimulationAdapter } from "./simulationAdapter"
import { GazeFilter, type SmoothingLevel } from "./smoothing"
import type {
  CalibrationFit,
  CalibrationResult,
  EngineKind,
  FaceMetrics,
  FaceStatus,
  GazeAdapter,
  GazePoint,
  GazeServiceState,
  RawGaze,
  TrackingStatusCode,
  ValidationResult,
  ValidationTargetResult,
} from "./types"
import { FaceLandmarkerAdapter } from "./faceLandmarkerAdapter"

const STALE_MS = 500
const FACE_LOST_MS = 700
/** During calibration, attention lost for longer than this interrupts it. */
const ATTENTION_LOST_MS = 1200
const FACE_UI_INTERVAL_MS = 250
/** A deliberate blink: eyes closed longer than a natural blink, shorter than resting. */
const BLINK_MIN_MS = 380
const BLINK_MAX_MS = 1600

type Target = { x: number; y: number }

interface SampleOptions {
  /** Identifies the calibration target (one group per dot). */
  group: number
  settleMs?: number
  durationMs: number
  signal?: AbortSignal
  onProgress?: (progress: number, attentionOk: boolean) => void
}

export interface BlinkEvent {
  /** performance.now() when the eyes closed. */
  start: number
  duration: number
}

/** Thrown by calibrate()/validate() when the user stops facing the camera. */
export class CalibrationCaptureError extends Error {
  constructor() { super('Not enough usable eye frames at this dot. Hold your gaze while we retry.'); this.name = 'CalibrationCaptureError' }
}

export class AttentionLostError extends Error {
  constructor() {
    super("The user stopped looking at the screen.")
    this.name = "AttentionLostError"
  }
}

const initialState: GazeServiceState = {
  mode: null,
  camera: "off",
  cameraError: null,
  cameraErrorDetail: null,
  deviceId: null,
  engine: "idle",
  engineError: null,
  paused: false,
  pausedKeepsGaze: false,
  faceDetected: null,
  face: null,
  calibrated: false,
  calibration: null,
  movedSinceCalibration: false,
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException("Aborted", "AbortError"))
    const abort = () => {
      clearTimeout(t)
      reject(new DOMException("Aborted", "AbortError"))
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", abort)
      resolve()
    }, ms)
    signal?.addEventListener("abort", abort, { once: true })
  })
}

function sameFace(a: FaceStatus | null, b: FaceStatus | null) {
  if (!a || !b) return a === b
  return (
    a.detected === b.detected &&
    a.facing === b.facing &&
    a.eyesOpen === b.eyesOpen &&
    a.position === b.position &&
    a.distance === b.distance &&
    a.glare === b.glare &&
    a.fps === b.fps
  )
}

/**
 * Engine-agnostic gaze service. UI code talks only to this class, so webcam
 * tracking, simulation, or future hardware trackers are interchangeable.
 */
export class GazeService {
  private state: GazeServiceState = initialState
  private listeners = new Set<() => void>()
  private gazeListeners = new Set<(p: GazePoint | null) => void>()
  private blinkListeners = new Set<(e: BlinkEvent) => void>()
  private stream: MediaStream | null = null
  private adapter: GazeAdapter | null = null
  private filter = new GazeFilter()
  private latest: GazePoint | null = null
  private latestRaw: GazePoint | null = null
  private faceLostTimer: ReturnType<typeof setTimeout> | null = null
  private startToken = 0
  private cameraToken = 0
  // Face / attention tracking
  private metrics: FaceMetrics | null = null
  private metricsAt = 0
  /** Smoothed time between analysed frames (ms). */
  private frameInterval = 33
  private closedSince: number | null = null
  private faceUiAt = 0
  // Head position at calibration time, for "you moved" guidance
  private headStability = new HeadStability()
  private checkingAccuracy = false
  private finalReferenceSamples: {cx:number;cy:number;size:number;yaw:number;pitch:number}[] = []
  private collectingReference = false
  private referenceSamples: { cx: number; cy: number; size: number; yaw: number; pitch: number }[] = []
  private validationDetails: ValidationTargetResult[] = []
  private calibratedViewport: { width: number; height: number } | null = null

  // ---- Store plumbing --------------------------------------------------
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getState = () => this.state
  private set(patch: Partial<GazeServiceState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }
  subscribeGaze(listener: (p: GazePoint | null) => void) {
    this.gazeListeners.add(listener)
    return () => {
      this.gazeListeners.delete(listener)
    }
  }
  /** Deliberate blinks (eyes closed ~0.4–1.6 s), used for blink-to-select. */
  subscribeBlink(listener: (e: BlinkEvent) => void) {
    this.blinkListeners.add(listener)
    return () => {
      this.blinkListeners.delete(listener)
    }
  }
  getStream() {
    return this.stream
  }
  setSmoothing(level: SmoothingLevel) {
    this.filter.setLevel(level)
  }
  listCameras() {
    return listCameras()
  }

  // ---- Camera ----------------------------------------------------------
  async initializeCamera(deviceId?: string | null) {
    const token = ++this.cameraToken
    const wasTracking = this.state.mode === "webcam"
    if (wasTracking) this.stopAdapter()
    stopStream(this.stream)
    this.stream = null
    this.set({
      camera: "requesting",
      cameraError: null,
      cameraErrorDetail: null,
      ...(wasTracking
        ? { engine: "idle" as const, faceDetected: null, face: null }
        : {}),
    })
    try {
      const stream = await requestCamera(deviceId)
      if (token !== this.cameraToken) {
        stopStream(stream)
        return null
      }
      this.stream = stream
      const track = stream.getVideoTracks()[0]
      track?.addEventListener("ended", () => {
        if (this.stream !== stream) return
        this.stopAdapter()
        this.stream = null
        this.set({
          camera: "error",
          cameraError: "disconnected",
          engine: "idle",
          faceDetected: null,
          face: null,
        })
      })
      this.set({
        camera: "connected",
        deviceId: track?.getSettings().deviceId ?? deviceId ?? null,
      })
      if (wasTracking) {
        // A different camera invalidates the previous calibration.
        this.resetCalibration()
        await this.startTracking("webcam")
      }
      return stream
    } catch (err) {
      if (token !== this.cameraToken) return null
      const e =
        err instanceof CameraError
          ? err
          : new CameraError("unknown", (err as Error)?.message)
      this.set({
        camera: "error",
        cameraError: e.code,
        cameraErrorDetail: e.message,
      })
      return null
    }
  }

  stopCamera() {
    this.stopTracking()
  }

  // ---- Tracking lifecycle ----------------------------------------------
  async startTracking(kind: EngineKind) {
    if (
      this.state.mode === kind &&
      (this.state.engine === "running" || this.state.engine === "loading")
    )
      return
    this.stopAdapter()
    const token = ++this.startToken

    if (kind === "simulation") {
      this.cameraToken++
      // Demo Mode needs no camera: release it.
      stopStream(this.stream)
      this.stream = null
      this.set({ camera: "off", cameraError: null })
    } else if (!this.stream) {
      this.set({
        engine: "error",
        engineError: "Connect a camera before starting eye tracking.",
      })
      return
    }

    const adapter: GazeAdapter =
      kind === "simulation"
        ? new SimulationAdapter()
        : new FaceLandmarkerAdapter()
    adapter.onGaze((g) => this.handleRawGaze(g))
    adapter.onFace((d) => this.handleFace(d))
    adapter.onMetrics((m) => this.handleMetrics(m))
    this.adapter = adapter
    this.set({
      mode: kind,
      engine: "loading",
      engineError: null,
      paused: false,
      faceDetected: kind === "simulation" ? true : null,
      face: null,
      calibrated: kind === "simulation" ? this.state.calibrated : false,
      calibration: kind === "simulation" ? this.state.calibration : null,
      movedSinceCalibration: false,
    })
    try {
      await adapter.start(this.stream)
      if (token !== this.startToken) {
        adapter.stop()
        return
      }
      this.set({ engine: "running" })
    } catch (err) {
      if (token !== this.startToken) return
      adapter.stop()
      this.adapter = null
      this.set({
        engine: "error",
        engineError:
          (err as Error)?.message ?? "The tracking engine failed to start.",
      })
    }
  }

  private stopAdapter() {
    this.startToken++
    this.adapter?.stop()
    this.adapter = null
    this.latest = null
    this.latestRaw = null
    this.metrics = null
    this.closedSince = null
    this.filter.reset()
    if (this.faceLostTimer) clearTimeout(this.faceLostTimer)
    this.faceLostTimer = null
    this.emitGaze(null)
  }

  /** Stops tracking and shuts down the camera. */
  stopTracking() {
    this.cameraToken++
    this.stopAdapter()
    stopStream(this.stream)
    this.stream = null
    this.referenceSamples = []
    this.finalReferenceSamples = []
    this.checkingAccuracy = false
    this.headStability.reset()
    this.set({ ...initialState })
  }

  /**
   * @param keepGaze when true the engine keeps estimating gaze so the user can
   * resume with their eyes; selections are still blocked by the UI.
   */
  pauseTracking(keepGaze = true) {
    if (!this.adapter) return
    if (!keepGaze) {
      this.adapter.pause()
      this.latest = null
      this.latestRaw = null
      this.emitGaze(null)
    }
    this.set({ paused: true, pausedKeepsGaze: keepGaze })
  }

  resumeTracking() {
    if (!this.adapter) return
    if (!this.state.pausedKeepsGaze) this.adapter.resume()
    this.set({ paused: false, pausedKeepsGaze: false })
  }

  // ---- Gaze -------------------------------------------------------------
  private handleRawGaze(raw: RawGaze) {
    if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
      this.latest = null
      this.latestRaw = null
      this.emitGaze(null)
      return
    }
    const w = window.innerWidth
    const h = window.innerHeight
    // Reject estimates far outside the viewport rather than clamping them into a target.
    if (
      raw.x < -0.15 * w ||
      raw.x > 1.15 * w ||
      raw.y < -0.15 * h ||
      raw.y > 1.15 * h
    ) {
      this.latest = null
      this.emitGaze(null)
      return
    }
    const now = performance.now()
    this.latestRaw = { x: raw.x / w, y: raw.y / h, timestamp: now }
    const s = this.filter.push(raw.x, raw.y, now, this.state.mode === 'webcam' && !this.checkingAccuracy)
    this.latest = {
      x: Math.min(1, Math.max(0, s.x / w)),
      y: Math.min(1, Math.max(0, s.y / h)),
      timestamp: now,
    }
    this.emitGaze(this.latest)
  }

  private emitGaze(p: GazePoint | null) {
    this.gazeListeners.forEach((l) => l(p))
  }

  private handleFace(detected: boolean) {
    if (detected) {
      if (this.faceLostTimer) clearTimeout(this.faceLostTimer)
      this.faceLostTimer = null
      if (this.state.faceDetected !== true) this.set({ faceDetected: true })
    } else if (this.state.faceDetected !== false && !this.faceLostTimer) {
      this.faceLostTimer = setTimeout(() => {
        this.faceLostTimer = null
        this.set({ faceDetected: false })
      }, FACE_LOST_MS)
    }
  }

  private handleMetrics(m: FaceMetrics | null) {
    const now = performance.now()
    if (this.metricsAt)
      this.frameInterval +=
        (Math.min(1000, now - this.metricsAt) - this.frameInterval) * 0.1
    this.metrics = m
    this.metricsAt = now

    // Deliberate blinks
    if (m?.eyesClosed) this.closedSince ??= now
    else if (m && this.closedSince !== null) {
      const duration = now - this.closedSince
      const start = this.closedSince
      this.closedSince = null
      if (duration >= BLINK_MIN_MS && duration <= BLINK_MAX_MS)
        this.blinkListeners.forEach((l) => l({ start, duration }))
    } else if (!m) this.closedSince = null

    if (m && this.collectingReference && !m.eyesClosed && isFacing(m)) {
      this.referenceSamples.push({ cx: m.cx, cy: m.cy, size: m.size, yaw: m.yawDeg, pitch: m.pitchDeg })
    }
    if (m && this.checkingAccuracy && !m.eyesClosed && isFacing(m)) this.finalReferenceSamples.push(headPosition(m))
    this.updateMoved(m, now)

    if (now - this.faceUiAt >= FACE_UI_INTERVAL_MS) {
      this.faceUiAt = now
      const face = this.faceStatusOf(m, now)
      if (!sameFace(face, this.state.face)) this.set({ face })
    }
  }

  private faceStatusOf(m: FaceMetrics | null, now: number): FaceStatus {
    const fps = Math.round(1000 / Math.max(1, this.frameInterval) / 5) * 5
    if (!m)
      return {
        detected: false,
        facing: false,
        eyesOpen: false,
        position: "ok",
        distance: "ok",
        glare: false,
        fps,
      }
    const position =
      m.cx < 0.2
        ? "move-right"
        : m.cx > 0.8
          ? "move-left"
          : m.cy < 0.18
            ? "move-down"
            : m.cy > 0.82
              ? "move-up"
              : "ok"
    const distance =
      m.size < 0.15 ? "too-far" : m.size > 0.62 ? "too-close" : "ok"
    // Ignore ordinary blinks; only report eyes closed when it lasts.
    const eyesOpen = !(
      m.eyesClosed &&
      this.closedSince !== null &&
      now - this.closedSince > 500
    )
    return {
      detected: true,
      facing: isFacing(m),
      eyesOpen,
      position,
      distance,
      glare: m.glare,
      fps,
    }
  }

  private updateMoved(m: FaceMetrics | null, now: number) {
    if (!this.state.calibrated || this.collectingReference) return
    const moved = this.headStability.push(m, now)
    if (moved !== this.state.movedSinceCalibration) this.set({movedSinceCalibration:moved})
  }

  /** Whether the user is currently facing the screen with eyes visible (always true in Demo Mode). */
  attentionOk() {
    if (this.state.mode !== "webcam") return true
    const m = this.metrics
    const now = performance.now()
    if (!m || now - this.metricsAt > Math.max(600, this.frameInterval * 3))
      return false
    if (!isFacing(m)) return false
    if (
      m.eyesClosed &&
      this.closedSince !== null &&
      now - this.closedSince > 700
    )
      return false
    return true
  }

  /** Camera estimates may remain visible through a blink, but must not click. */
  canSelect() {
    if (this.state.engine !== 'running') return false
    if (this.state.mode === 'simulation') return true
    const m = this.metrics
    if (!this.state.calibrated || !m || m.eyesClosed || !this.attentionOk() || this.state.movedSinceCalibration) return false
    if (!this.headStability.selectionSafe) return false
    return true
  }

  checkViewport() {
    const viewport = this.calibratedViewport
    if (this.state.mode === 'webcam' && this.state.calibrated && viewport
      && (Math.abs(window.innerWidth - viewport.width) > 32 || Math.abs(window.innerHeight - viewport.height) > 64)) this.resetCalibration()
  }

  getRawGazeCoordinates(): GazePoint | null {
    return this.latestRaw && performance.now() - this.latestRaw.timestamp <= STALE_MS ? this.latestRaw : null
  }

  /** Latest smoothed gaze in normalized coordinates, or null if missing/stale. */
  getGazeCoordinates(): GazePoint | null {
    if (!this.latest) return null
    if (performance.now() - this.latest.timestamp > STALE_MS) return null
    if (this.state.paused && !this.state.pausedKeepsGaze) return null
    return this.latest
  }

  // ---- Calibration ------------------------------------------------------
  /**
   * Shows a target (normalized coords) and collects samples while the user looks
   * at it. Time only advances while the user faces the screen; if attention is
   * lost for too long this throws AttentionLostError. Resolves with sample count.
   */
  async calibrate(target: Target, opts: SampleOptions) {
    const { settleMs = 700, durationMs, signal, onProgress, group } = opts
    await sleep(settleMs, signal)
    const real = this.state.mode === "webcam"
    this.adapter?.clearCalibrationGroup?.(group)
    const before = this.adapter?.calibrationSampleCount() ?? 0
    const px = {
      x: target.x * window.innerWidth,
      y: target.y * window.innerHeight,
      group,
    }
    this.collectingReference = real
    try {
      await this.collect(durationMs, real, signal,
        (progress, ok) => onProgress?.(Math.min(progress, real ? ((this.adapter?.calibrationSampleCount() ?? before) - before) / 24 : 1), ok),
        (ok) => this.adapter?.setCalibrationTarget(ok ? px : null),
        real ? () => (this.adapter?.calibrationSampleCount() ?? before) - before >= 24 : undefined,
      )
    } finally {
      this.adapter?.setCalibrationTarget(null)
      this.collectingReference = false
    }
    return (this.adapter?.calibrationSampleCount() ?? 0) - before
  }

  /**
   * Measures real gaze error at a target (px per sample). Samples gathered here
   * are independent of training and never alter the model being measured.
   */
  beginValidation() { this.validationDetails = []; this.finalReferenceSamples = [] }
  getValidationDetails() { return [...this.validationDetails] }

  async validate(target: Target, opts: SampleOptions) {
    const { settleMs = 1100, durationMs, signal, onProgress } = opts
    this.checkingAccuracy = true
    const errors: number[] = []
    const offsets: { x: number; y: number }[] = []
    const tx = target.x * window.innerWidth
    const ty = target.y * window.innerHeight
    let lastTimestamp = -1
    try {
      await sleep(settleMs, signal)
      await this.collect(durationMs, true, signal, onProgress, (ok) => {
        const g = ok ? this.getGazeCoordinates() : null
        if (g && g.timestamp !== lastTimestamp && !this.metrics?.eyesClosed) {
          lastTimestamp = g.timestamp
          offsets.push({ x: g.x * window.innerWidth - tx, y: g.y * window.innerHeight - ty })
          errors.push(
            Math.hypot(
              g.x * window.innerWidth - tx,
              g.y * window.innerHeight - ty,
            ),
          )
        }
      })
    } finally {
      this.checkingAccuracy = false
      this.adapter?.setCalibrationTarget(null)
    }
    if (offsets.length) {
      const biasX = offsets.reduce((sum, point) => sum + point.x, 0) / offsets.length
      const biasY = offsets.reduce((sum, point) => sum + point.y, 0) / offsets.length
      const spreadPx = Math.sqrt(offsets.reduce((sum, point) => sum + (point.x - biasX) ** 2 + (point.y - biasY) ** 2, 0) / offsets.length)
      this.validationDetails.push({...target, biasX, biasY, spreadPx, frames: offsets.length,
        meanErrorPx: errors.reduce((sum, error) => sum + error, 0) / errors.length})
    }
    return errors
  }

  private async collect(
    durationMs: number,
    checkAttention: boolean,
    signal: AbortSignal | undefined,
    onProgress: SampleOptions["onProgress"],
    onTick: (ok: boolean) => void,
    enoughFrames?: () => boolean,
  ) {
    const step = 50
    let collected = 0
    let badSince: number | null = null
    let last = performance.now()
    while (collected < durationMs || (enoughFrames && !enoughFrames())) {
      if (collected > durationMs + 4000) throw new CalibrationCaptureError()
      await sleep(step, signal)
      if (!this.adapter) throw new DOMException("Aborted", "AbortError")
      // Wall-clock time, so a busy main thread doesn't stretch calibration out.
      const now = performance.now()
      const elapsed = Math.min(250, now - last)
      last = now
      const ok = !checkAttention || this.attentionOk()
      if (ok) badSince = null
      else {
        badSince ??= now
        if (now - badSince > ATTENTION_LOST_MS) throw new AttentionLostError()
      }
      onTick(ok)
      if (ok) collected += elapsed
      onProgress?.(Math.min(1, collected / durationMs), ok)
    }
  }

  /** Fits the personal gaze model from collected samples (webcam only). */
  fitCalibration(): CalibrationFit | null {
    if (this.state.mode !== "webcam" || !this.adapter) return null
    return this.adapter.fitCalibration()
  }

  completeCalibration(result: Omit<CalibrationResult, "completedAt">) {
    const r = this.finalReferenceSamples.length >= 8 ? this.finalReferenceSamples : this.referenceSamples
    this.headStability.calibrate(r)
    this.calibratedViewport = { width: window.innerWidth, height: window.innerHeight }
    this.filter.reset()
    this.set({
      calibrated: result.simulated || (result.fit ? calibrationFitUsable(result.fit) : calibrationUsable(result.validation)),
      calibration: { ...result, completedAt: Date.now() },
      movedSinceCalibration: false,
    })
  }

  resetCalibration() {
    this.headStability.reset()
    this.finalReferenceSamples = []
    this.checkingAccuracy = false
    this.adapter?.clearCalibration()
    this.latest = null
    this.latestRaw = null
    this.filter.reset()
    this.referenceSamples = []
    this.set({
      calibrated: false,
      calibration: null,
      movedSinceCalibration: false,
    })
  }

  /** Implicit recalibration from a confirmed selection (target in viewport px). */
  reinforce(target: Target, from: number, to: number) {
    if (this.state.mode === "webcam" && this.state.calibrated)
      this.adapter?.reinforce(target, from, to)
  }

  getTrackingStatus(): TrackingStatusCode {
    return trackingStatusOf(this.state)
  }

  /** Engine health for troubleshooting (frames, faces, errors, fps, GPU/CPU). */
  getDiagnostics() {
    return {
      selectionReady: this.canSelect(),
      positionCheck: this.headStability.diagnostics(),
      calibration: this.state.calibration?.validation,
      mode: this.state.mode,
      engine: this.state.engine,
      ...(this.adapter?.getStats?.() ?? {}),
    }
  }
}

export function trackingStatusOf(s: GazeServiceState): TrackingStatusCode {
  if (s.mode === "simulation") return s.paused ? "paused" : "demo"
  if (s.camera === "requesting") return "camera-requesting"
  if (s.camera === "error" || s.engine === "error") return "error"
  if (s.mode === "webcam") {
    if (s.engine === "loading") return "engine-loading"
    if (s.paused) return "paused"
    if (!s.calibrated) return "calibration-required"
    if (s.faceDetected === false) return "face-not-detected"
    if (s.engine === "running") return "tracking"
  }
  return s.camera === "connected" ? "camera-connected" : "camera-off"
}

export function summarizeValidation(
  errors: number[][],
  details?: ValidationTargetResult[],
): ValidationResult | null {
  const usable = errors.map(group => group.filter(value => Number.isFinite(value) && value >= 0))
  const all = usable.flat().sort((a, b) => a - b)
  const targets = usable.filter((e) => e.length >= 6).length
  if (all.length < 10 || targets === 0) return null
  return {
    details,
    meanErrorPx: all.reduce((a, b) => a + b, 0) / all.length,
    medianErrorPx: all[Math.floor(all.length / 2)],
    p90ErrorPx: all[Math.min(all.length - 1, Math.floor(all.length * .9))],
    targets,
    validSamples: all.length,
  }
}

export const gazeService = new GazeService()

// Handy for support: run `__gazeDiagnostics()` in the browser console.
;(window as unknown as {
  __gazeDiagnostics?: () => unknown
}).__gazeDiagnostics = () => gazeService.getDiagnostics()
