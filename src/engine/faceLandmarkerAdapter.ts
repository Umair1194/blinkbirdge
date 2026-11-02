import { EyeOpenness } from './eyeOpenness'
import type {
  FaceLandmarker,
  FaceLandmarkerOptions,
} from "@mediapipe/tasks-vision"
import {
  FEATURE_SCALE_FLOORS,
  U_INDEX,
  V_INDEX,
  computeFaceMetrics,
  gazeFeatures,
  headPose,
  isFacing,
  toPixels,
  type Pt,
} from "./faceMetrics"
import type { TrainingSample } from './ridge'
import { fitPersonal, predictPersonal, refitPersonal, type PersonalModel } from './personalModel'
import type {
  CalibrationFit,
  CalibrationTargetPx,
  FaceMetrics,
  GazeAdapter,
  RawGaze,
} from "./types"

const assetUrl = (path: string) =>
  new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href

/** Recent frames kept for learning from confirmed selections. */
const RECENT_MS = 5000
const MAX_REINFORCE_SAMPLES = 300
const REINFORCE_PER_SELECTION = 6
const REFIT_EVERY = 8
/** Drift correction never shifts the cursor further than this. */
const MAX_BIAS_PX = 48
const BIAS_RATE = 0.08
const MIN_POINTS = 9
const MIN_SAMPLES = 108
const GLARE_INTERVAL_MS = 400
/** If no frame was processed for this long, the watchdog processes one itself. */
const WATCHDOG_MS = 250
/** Consecutive detection errors before the engine is recreated. */
const MAX_DETECT_ERRORS = 30
const GLARE_W = 48
const GLARE_H = 24

type Fileset = Parameters<typeof FaceLandmarker.createFromOptions>[0]
type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

/** Script load errors arrive as DOM Events; wasm/model download failures mention fetch. */
function isDownloadError(err: unknown) {
  return (
    (typeof Event !== "undefined" && err instanceof Event) ||
    /fetch|network|load/i.test(String((err as Error)?.message ?? err))
  )
}

function waitFor(check: () => boolean, timeoutMs: number, message: string) {
  return new Promise<void>((resolve, reject) => {
    const started = performance.now()
    const tick = () => {
      if (check()) return resolve()
      if (performance.now() - started > timeoutMs)
        return reject(new Error(message))
      setTimeout(tick, 50)
    }
    tick()
  })
}

/**
 * Webcam gaze estimation with MediaPipe Face Landmarker.
 * Each camera frame yields 478 face landmarks including both irises, blink and
 * gaze blendshapes, and the head pose. The iris position inside each eye
 * (plus eyelids and head pose) is mapped to the screen by a personal ridge
 * regression fitted during calibration. Everything runs on this device; video
 * is never stored or sent anywhere, and calibration lives in memory only.
 */
export class FaceLandmarkerAdapter implements GazeAdapter {
  readonly kind = "webcam" as const
  private landmarker: FaceLandmarker | null = null
  private fileset: Fileset | null = null
  private delegate: "GPU" | "CPU" = "GPU"
  private switching = false
  private video: VideoWithFrameCallback | null = null
  private running = false
  private generation = 0
  private paused = false
  private frameHandle = 0
  private frameKind: "rvfc" | "raf" = "rvfc"
  /** Set when video-frame callbacks stalled; we then drive the loop by animation frames. */
  private useRaf = false
  private watchdog: ReturnType<typeof setInterval> | null = null
  private lastProcessedAt = 0
  private detectErrors = 0
  private prevFrameAt = 0
  private lastTs = 0
  private lastMediaTime = -1
  private gazeListener: (g: RawGaze) => void = () => {}
  private faceListener: (d: boolean) => void = () => {}
  private metricsListener: (m: FaceMetrics | null) => void = () => {}
  private openness = new EyeOpenness()
  private recent: { t: number; f: Float64Array }[] = []
  private calibTarget: CalibrationTargetPx | null = null
  private calibSamples: TrainingSample[] = []
  private trainingCalib: TrainingSample[] = []
  private reinforceSamples: TrainingSample[] = []
  private model: PersonalModel | null = null
  private bias = { x: 0, y: 0 }
  private sinceRefit = 0
  private glare = false
  private glareStreak = 0
  private glareAt = 0
  private glareCtx: CanvasRenderingContext2D | null = null
  /** Engine health, for diagnostics and the "tracking speed" readout. */
  readonly stats = {
    frames: 0,
    faces: 0,
    errors: 0,
    lastError: "",
    fps: 0,
    delegate: "GPU" as "GPU" | "CPU",
  }

  async start(stream: MediaStream | null) {
    const generation = ++this.generation
    if (!stream)
      throw new Error("A camera stream is required for eye tracking.")
    const video = document.createElement("video") as VideoWithFrameCallback
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    video.setAttribute("aria-hidden", "true")
    // Kept in the document (some browsers pause detached videos) but invisible.
    Object.assign(video.style, {
      position: "fixed",
      left: "-2px",
      top: "-2px",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    })
    video.srcObject = stream
    document.body.appendChild(video)
    this.video = video
    await video.play().catch(() => {})
    await waitFor(
      () => video.readyState >= 2 && video.videoWidth > 0,
      10000,
      "The camera didn’t deliver any video.",
    )

    const { FilesetResolver } = await import("@mediapipe/tasks-vision")
    try {
      this.fileset = await FilesetResolver.forVisionTasks(
        assetUrl("mediapipe/wasm"),
      )
    } catch {
      throw new Error("The eye-tracking engine could not be loaded.")
    }
    if (generation !== this.generation) return
    await this.startEngine(video)
    if (generation !== this.generation) {
      this.landmarker?.close()
      this.landmarker = null
      return
    }
    this.running = true
    this.lastProcessedAt = performance.now()
    this.schedule()
    // rVFC only fires for frames the browser composites; a video hidden behind a
    // full-screen page can stop receiving callbacks. Keep processing regardless.
    this.watchdog = setInterval(() => {
      if (!this.running || this.paused || this.switching) return
      if (performance.now() - this.lastProcessedAt > WATCHDOG_MS) {
        this.useRaf = true
        this.tick(true)
      }
    }, WATCHDOG_MS)
  }

  /**
   * GPU first, CPU as fallback. Download failures (flaky network, low memory)
   * are retried with a short back-off rather than failing straight away.
   */
  private async startEngine(video: HTMLVideoElement) {
    let lastError: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 700 * attempt))
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          this.landmarker = await this.create(delegate, video)
          return
        } catch (err) {
          lastError = err
          if (delegate === "GPU")
            console.warn(
              "[gaze] GPU face tracking unavailable, trying CPU.",
              err,
            )
          if (!isDownloadError(err) && delegate === "CPU") break
        }
      }
      if (!isDownloadError(lastError)) break
    }
    const detail = lastError instanceof Error ? lastError.message : ""
    throw new Error(`The face model could not be loaded. ${detail}`.trim())
  }

  /** Creates a landmarker and checks that it can actually run on this device. */
  private async create(delegate: "GPU" | "CPU", video: HTMLVideoElement) {
    const { FaceLandmarker } = await import("@mediapipe/tasks-vision")
    let lm: FaceLandmarker | null = null
    try {
      lm = await FaceLandmarker.createFromOptions(
        this.fileset!,
        this.options(delegate),
      )
      lm.detectForVideo(video, this.nextTs())
      this.delegate = delegate
      this.stats.delegate = delegate
      return lm
    } catch (err) {
      lm?.close()
      throw err
    }
  }

  private options(delegate: "GPU" | "CPU"): FaceLandmarkerOptions {
    return {
      baseOptions: {
        modelAssetPath: assetUrl("mediapipe/face_landmarker.task"),
        delegate,
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.65,
      minFacePresenceConfidence: 0.65,
      minTrackingConfidence: 0.65,
    }
  }

  /** MediaPipe requires strictly increasing timestamps. */
  private nextTs() {
    this.lastTs = Math.max(Math.floor(performance.now()), this.lastTs + 1)
    return this.lastTs
  }

  // ---- Frame loop: one detection per new camera frame ------------------------
  private schedule() {
    const v = this.video
    if (!v || !this.running || this.paused) return
    if (v.requestVideoFrameCallback && !this.useRaf) {
      this.frameKind = "rvfc"
      this.frameHandle = v.requestVideoFrameCallback(this.onFrameCallback)
    } else {
      this.frameKind = "raf"
      this.frameHandle = requestAnimationFrame(this.onFrameCallback)
    }
  }

  private cancelFrame() {
    const v = this.video
    if (!this.frameHandle) return
    if (this.frameKind === "rvfc")
      v?.cancelVideoFrameCallback?.(this.frameHandle)
    else cancelAnimationFrame(this.frameHandle)
    this.frameHandle = 0
  }

  private onFrameCallback = () => {
    this.frameHandle = 0
    this.tick(false)
  }

  private tick(fromWatchdog: boolean) {
    const v = this.video
    if (!v || !this.running || this.paused) return
    // Skip calls that carry no new video frame (RAF fallback / watchdog).
    const fresh = v.currentTime !== this.lastMediaTime
    this.lastMediaTime = v.currentTime
    if (fresh && !this.switching) {
      this.lastProcessedAt = performance.now()
      try {
        this.process(v)
      } catch (err) {
        // Keep the loop alive whatever happens in a single frame.
        this.stats.lastError = String((err as Error)?.message ?? err)
      }
    }
    if (
      !fromWatchdog ||
      !this.frameHandle ||
      (this.useRaf && this.frameKind === "rvfc")
    ) {
      this.cancelFrame()
      this.schedule()
    }
  }

  private process(v: HTMLVideoElement) {
    const lm = this.landmarker
    if (!lm || v.readyState < 2) return
    let result
    try {
      result = lm.detectForVideo(v, this.nextTs())
      this.detectErrors = 0
    } catch (err) {
      this.gazeListener(null)
      this.stats.errors++
      this.stats.lastError = String((err as Error)?.message ?? err)
      if (++this.detectErrors >= MAX_DETECT_ERRORS || this.delegate === "GPU") {
        this.detectErrors = 0
        this.recreate("CPU")
      }
      return
    }
    const now = performance.now()
    this.stats.frames++
    if (this.prevFrameAt)
      this.stats.fps +=
        (1000 / Math.max(1, now - this.prevFrameAt) - this.stats.fps) * 0.1
    this.prevFrameAt = now
    const face = result.faceLandmarks?.[0]
    if (!face || face.length < 478) {
      this.faceListener(false)
      this.metricsListener(null)
      this.gazeListener(null)
      return
    }
    const w = v.videoWidth
    const h = v.videoHeight
    const p = toPixels(face, w, h)
    const blend = result.faceBlendshapes?.[0]?.categories
    const head = headPose(result.facialTransformationMatrixes?.[0]?.data, p)
    const raw = computeFaceMetrics(p, w, h, head, blend)
    this.stats.faces++
    this.checkGlare(v, p, now)
    const eyesClosed = this.updateEyes(raw.ear, raw.blink)
    const metrics: FaceMetrics = { ...raw, eyesClosed, glare: this.glare }
    this.faceListener(true)
    this.metricsListener(metrics)

    // Hold the last estimate through blinks: the iris isn't visible then.
    if (eyesClosed) return
    if (!isFacing(metrics)) {
      this.gazeListener(null)
      return
    }
    const feats = gazeFeatures(p, blend, head, raw)
    if (!feats) { this.gazeListener(null); return }

    this.recent.push({ t: now, f: feats })
    while (this.recent.length && now - this.recent[0].t > RECENT_MS)
      this.recent.shift()
    if (this.calibTarget) {
      const { x, y, group } = this.calibTarget
      this.calibSamples.push({ features: feats, x, y, weight: 1, group })
    }
    if (this.model) {
      const g = predictPersonal(this.model, feats)
      this.gazeListener({ x: g.x + this.bias.x, y: g.y + this.bias.y })
    }
  }

  /** Rebuilds the engine after repeated failures (GPU errors fall back to the CPU). */
  private recreate(delegate: "GPU" | "CPU") {
    if (this.switching || !this.fileset || !this.video) return
    this.switching = true
    const video = this.video
    const generation = this.generation
    void this.create(delegate, video)
      .then((lm) => {
        if (generation !== this.generation) {
          lm.close()
          return
        }
        this.landmarker?.close()
        this.landmarker = lm
      })
      .catch((err) => {
        this.stats.lastError = String((err as Error)?.message ?? err)
      })
      .finally(() => {
        this.switching = false
      })
  }

  /** Blink detection: MediaPipe's blink blendshape, backed by the eyelid opening ratio. */
  private updateEyes(ear: number, blink: number | null) {
    return this.openness.update(ear, blink)
  }

  /** Detects strong reflections on glasses around the eyes (bright, saturated patches). */
  private checkGlare(v: HTMLVideoElement, p: Pt[], now: number) {
    if (now - this.glareAt < GLARE_INTERVAL_MS) return
    this.glareAt = now
    if (!this.glareCtx) {
      const c = document.createElement("canvas")
      c.width = GLARE_W
      c.height = GLARE_H
      this.glareCtx = c.getContext("2d", { willReadFrequently: true })
    }
    const ctx = this.glareCtx
    if (!ctx) return
    let worst = 0
    for (const idx of [
      [33, 133, 159, 145],
      [362, 263, 386, 374],
    ]) {
      const xs = idx.map((i) => p[i].x)
      const ys = idx.map((i) => p[i].y)
      const ew = Math.max(...xs) - Math.min(...xs)
      if (!(ew > 4)) continue
      // A lens-sized box around the eye.
      const sx = Math.min(...xs) - ew * 0.35
      const sy = (Math.min(...ys) + Math.max(...ys)) / 2 - ew * 0.45
      try {
        ctx.drawImage(v, sx, sy, ew * 1.7, ew * 0.9, 0, 0, GLARE_W, GLARE_H)
        const d = ctx.getImageData(0, 0, GLARE_W, GLARE_H).data
        let bright = 0
        for (let i = 0; i < d.length; i += 4) {
          if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 242)
            bright++
        }
        worst = Math.max(worst, bright / (GLARE_W * GLARE_H))
      } catch {
        return
      }
    }
    this.glareStreak = worst > 0.03 ? this.glareStreak + 1 : 0
    this.glare = this.glareStreak >= 2
  }

  // ---- Calibration -------------------------------------------------------------
  setCalibrationTarget(target: CalibrationTargetPx | null) {
    this.calibTarget = target
  }

  clearCalibrationGroup(group: number) {
    this.calibSamples = this.calibSamples.filter(sample => sample.group !== group)
  }

  calibrationSampleCount() {
    return this.calibSamples.length
  }

  /** Drops samples taken mid-saccade or mid-blink: far from the median iris position for their target. */
  private rejectOutliers(samples: TrainingSample[]) {
    const byGroup = new Map<number, TrainingSample[]>()
    samples.forEach((s) =>
      byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s]),
    )
    const med = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1]
    const kept: TrainingSample[] = []
    byGroup.forEach((list) => {
      const us = list.map((s) => s.features[U_INDEX])
      const vs = list.map((s) => s.features[V_INDEX])
      const mu = med(us)
      const mv = med(vs)
      const madU = med(us.map((u) => Math.abs(u - mu)))
      const madV = med(vs.map((v) => Math.abs(v - mv)))
      list.forEach((s) => {
        if (
          Math.abs(s.features[U_INDEX] - mu) <= 3 * madU + 0.004 &&
          Math.abs(s.features[V_INDEX] - mv) <= 3 * madV + 0.003
        )
          kept.push(s)
      })
    })
    return kept
  }

  fitCalibration(): CalibrationFit | null {
    const samples = this.rejectOutliers(this.calibSamples)
    const points = new Set(samples.map((s) => s.group)).size
    const counts = new Map<number, number>()
    samples.forEach(sample => counts.set(sample.group, (counts.get(sample.group) ?? 0) + 1))
    if (points < MIN_POINTS || samples.length < MIN_SAMPLES || [...counts.values()].some(count => count < 12)) return null
    const fitted = fitPersonal(samples, FEATURE_SCALE_FLOORS)
    if (!fitted) return null
    this.trainingCalib = samples
    this.bias = { x: 0, y: 0 }
    this.model = fitted
    if (!this.model) return null
    return {
      samples: samples.length,
      points,
      cvErrorPx: this.model.cvErrorPx,
      modelName: this.model.name,
    }
  }

  private refit() {
    if (this.model) this.model = refitPersonal(this.model,
      [...this.trainingCalib, ...this.reinforceSamples], FEATURE_SCALE_FLOORS)
  }

  /**
   * A confirmed selection tells us where the user was really looking. The
   * average error over that moment updates a drift correction straight away,
   * and the frames are kept as extra training data for periodic refits.
   */
  reinforce(target: { x: number; y: number }, from: number, to: number) {
    if (!this.model) return
    const frames = this.recent.filter((r) => r.t >= from && r.t <= to)
    if (frames.length < 8) return
    let rx = 0
    let ry = 0
    for (const fr of frames) {
      const p = predictPersonal(this.model, fr.f)
      rx += target.x - p.x
      ry += target.y - p.y
    }
    rx /= frames.length
    ry /= frames.length
    // Uncertain or widely scattered estimates cannot safely label themselves.
    if (Math.hypot(rx - this.bias.x, ry - this.bias.y) > 80) return
    const predictions = frames.map(frame => predictPersonal(this.model!, frame.f))
    const mx = predictions.reduce((sum, point) => sum + point.x, 0) / predictions.length
    const my = predictions.reduce((sum, point) => sum + point.y, 0) / predictions.length
    if (predictions.some(point => Math.hypot(point.x - mx, point.y - my) > 35)) return
    this.bias.x += BIAS_RATE * (rx - this.bias.x)
    this.bias.y += BIAS_RATE * (ry - this.bias.y)
    const len = Math.hypot(this.bias.x, this.bias.y)
    if (len > MAX_BIAS_PX) {
      this.bias.x *= MAX_BIAS_PX / len
      this.bias.y *= MAX_BIAS_PX / len
    }

    const step = Math.max(
      1,
      Math.floor(frames.length / REINFORCE_PER_SELECTION),
    )
    for (
      let i = frames.length - 1, n = 0;
      i >= 0 && n < REINFORCE_PER_SELECTION;
      i -= step, n++
    ) {
      this.reinforceSamples.push({
        features: frames[i].f,
        x: target.x,
        y: target.y,
        weight: 0.15,
        group: -1,
      })
    }
    if (this.reinforceSamples.length > MAX_REINFORCE_SAMPLES) {
      this.reinforceSamples.splice(
        0,
        this.reinforceSamples.length - MAX_REINFORCE_SAMPLES,
      )
    }
    if (++this.sinceRefit >= REFIT_EVERY) {
      this.sinceRefit = 0
      this.refit()
      // The refreshed model has absorbed part of the drift.
      this.bias.x *= 0.5
      this.bias.y *= 0.5
    }
  }

  clearCalibration() {
    this.model = null
    this.calibTarget = null
    this.calibSamples = []
    this.trainingCalib = []
    this.reinforceSamples = []
    this.bias = { x: 0, y: 0 }
    this.sinceRefit = 0
  }

  // ---- Lifecycle -----------------------------------------------------------------
  stop() {
    this.generation++
    this.running = false
    this.openness.reset()
    this.cancelFrame()
    if (this.watchdog) clearInterval(this.watchdog)
    this.watchdog = null
    try {
      this.landmarker?.close()
    } catch {
      // Already closed.
    }
    this.landmarker = null
    if (this.video) {
      this.video.pause()
      this.video.srcObject = null
      this.video.remove()
      this.video = null
    }
    this.gazeListener(null)
  }
  pause() {
    this.paused = true
    this.cancelFrame()
    this.gazeListener(null)
  }
  resume() {
    if (!this.paused) return
    this.paused = false
    this.schedule()
  }
  getStats() {
    return {
      ...this.stats,
      model: this.model?.name ?? null,
      eyeOpeningBaseline: this.openness.getBaseline(),
      modelCvErrorPx: this.model?.cvErrorPx ?? null,
      calibrationFrames: this.calibSamples.length,
      fps: Math.round(this.stats.fps),
      loop: this.useRaf ? "animation-frame" : "video-frame",
    }
  }
  onGaze(listener: (g: RawGaze) => void) {
    this.gazeListener = listener
  }
  onFace(listener: (d: boolean) => void) {
    this.faceListener = listener
  }
  onMetrics(listener: (m: FaceMetrics | null) => void) {
    this.metricsListener = listener
  }
}
