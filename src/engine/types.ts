import type { RawFaceMetrics } from './faceMetrics'

/** Normalized screen coordinates, 0..1 on both axes, relative to the viewport. */
export interface GazePoint {
  x: number
  y: number
  timestamp: number
}

export type EngineKind = 'webcam' | 'simulation'

export type CameraState = 'off' | 'requesting' | 'connected' | 'error'

export type CameraErrorCode =
  | 'permission-denied'
  | 'blocked-by-frame'
  | 'not-found'
  | 'in-use'
  | 'unsupported'
  | 'insecure'
  | 'disconnected'
  | 'unknown'

export type EngineState = 'idle' | 'loading' | 'running' | 'error'

export type TrackingStatusCode =
  | 'camera-off'
  | 'camera-requesting'
  | 'camera-connected'
  | 'engine-loading'
  | 'calibration-required'
  | 'tracking'
  | 'face-not-detected'
  | 'paused'
  | 'demo'
  | 'error'

export interface ValidationTargetResult {
  x: number
  y: number
  meanErrorPx: number
  biasX: number
  biasY: number
  spreadPx: number
  frames: number
}

export interface ValidationResult {
  details?: ValidationTargetResult[]
  /** Mean distance between validation targets and gaze estimates, in CSS pixels. */
  meanErrorPx: number
  medianErrorPx: number
  /** 90th-percentile error on independent check targets. */
  p90ErrorPx?: number
  targets: number
  validSamples: number
}

export interface CalibrationResult {
  points: number
  samples: number
  simulated: boolean
  refined?: boolean
  /** Training-target cross-validation; not an independent accuracy measurement. */
  fit?: CalibrationFit
  validation: ValidationResult | null
  completedAt: number
}

export interface CalibrationFit {
  samples: number
  points: number
  /** Leave-one-target-out error of the fitted model, in CSS pixels. */
  cvErrorPx: number | null
  modelName?: string
}

export interface FaceMetrics extends RawFaceMetrics {
  eyesClosed: boolean
  /** Strong reflections (e.g. on glasses) around the eyes. */
  glare: boolean
}

export type FacePosition = 'ok' | 'move-left' | 'move-right' | 'move-up' | 'move-down'
export type FaceDistance = 'ok' | 'too-far' | 'too-close'

/** UI-friendly summary of how well the camera can see the user. */
export interface FaceStatus {
  detected: boolean
  facing: boolean
  eyesOpen: boolean
  position: FacePosition
  distance: FaceDistance
  glare: boolean
  /** Camera frames analysed per second (rounded to 5). */
  fps: number
}

export interface GazeServiceState {
  mode: EngineKind | null
  camera: CameraState
  cameraError: CameraErrorCode | null
  cameraErrorDetail: string | null
  deviceId: string | null
  engine: EngineState
  engineError: string | null
  paused: boolean
  /** When paused softly, gaze continues so the user can resume by looking. */
  pausedKeepsGaze: boolean
  faceDetected: boolean | null
  /** Face quality for guidance; null when no camera engine is running. */
  face: FaceStatus | null
  calibrated: boolean
  calibration: CalibrationResult | null
  /** The head has moved noticeably away from where calibration happened. */
  movedSinceCalibration: boolean
}

/** Raw gaze in viewport pixels, or null when the engine has no valid estimate. */
export type RawGaze = { x: number; y: number } | null

export interface CalibrationTargetPx {
  x: number
  y: number
  group: number
}

/** Contract implemented by every gaze engine (webcam, simulation, future hardware). */
export interface GazeAdapter {
  readonly kind: EngineKind
  start(stream: MediaStream | null): Promise<void>
  stop(): void
  pause(): void
  resume(): void
  /** While set, usable frames (face visible, eyes open) become samples for this target. */
  setCalibrationTarget(target: CalibrationTargetPx | null): void
  calibrationSampleCount(): number
  clearCalibrationGroup?(group: number): void
  /** Fits the gaze model from collected samples; null when there isn't enough usable data. */
  fitCalibration(): CalibrationFit | null
  clearCalibration(): void
  /** Learns from a confirmed selection: frames between `from` and `to` were looking at `target`. */
  reinforce(target: { x: number; y: number }, from: number, to: number): void
  onGaze(listener: (gaze: RawGaze) => void): void
  onFace(listener: (detected: boolean) => void): void
  onMetrics(listener: (metrics: FaceMetrics | null) => void): void
  /** Optional engine health details for diagnostics. */
  getStats?(): Record<string, unknown>
}
