import type { Category, NormalizedLandmark } from '@mediapipe/tasks-vision'

/**
 * Face, head and eye measurements derived from MediaPipe Face Landmarker
 * (478 landmarks incl. irises, blendshapes and the facial transformation matrix).
 */
export interface RawFaceMetrics {
  /** Average eye aspect ratio (eyelid opening relative to eye width). */
  ear: number
  /** Blendshape eye-blink score 0..1 (both eyes averaged); null if unavailable. */
  blink: number | null
  /** Head rotation relative to the camera, degrees. 0/0 = facing the camera. */
  yawDeg: number
  pitchDeg: number
  /** Face centre in the mirrored (selfie) view, 0..1. */
  cx: number
  cy: number
  /** Face width relative to the frame width. */
  size: number
}

export interface HeadPose {
  yaw: number
  pitch: number
  roll: number
}

export type Pt = { x: number; y: number }

// Six-point eye outlines: corner, two upper-lid points, corner, two lower-lid points.
const EYE_A_EAR = [33, 160, 158, 133, 153, 144]
const EYE_B_EAR = [362, 385, 387, 263, 373, 380]
// Eye frames, left → right in the image. A = subject's right eye, B = subject's left eye.
const EYE_A = { left: 33, right: 133, upper: 159, lower: 145 }
const EYE_B = { left: 362, right: 263, upper: 386, lower: 374 }
const IRIS_CENTERS = [468, 473]

const deg = (r: number) => (r * 180) / Math.PI
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

export function toPixels(lm: NormalizedLandmark[], w: number, h: number): Pt[] {
  return lm.map((p) => ({ x: p.x * w, y: p.y * h }))
}

function eyeAspect(p: Pt[], idx: number[]) {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => p[i])
  const horizontal = dist(p1, p4)
  return horizontal > 0 ? (dist(p2, p6) + dist(p3, p5)) / (2 * horizontal) : 0
}

/** Head pose (radians) from the facial transformation matrix, or from landmarks as a fallback. */
export function headPose(matrix: number[] | undefined, p: Pt[]): HeadPose {
  const a = p[33]
  const b = p[263]
  const roll = Math.atan2(b.y - a.y, b.x - a.x)
  if (matrix && matrix.length === 16) {
    // Face "forward" axis in camera space; abs() makes this independent of the z convention.
    const fx = matrix[8]
    const fy = matrix[9]
    const fz = Math.abs(matrix[10]) || 1e-6
    return { yaw: Math.atan2(fx, fz), pitch: Math.atan2(fy, fz), roll }
  }
  const left = p[234]
  const right = p[454]
  const faceW = Math.abs(right.x - left.x) || 1
  const ratio = (p[1].x - Math.min(left.x, right.x)) / faceW
  const pitchRatio = (p[1].y - p[10].y) / (p[152].y - p[10].y || 1)
  return { yaw: (ratio - 0.5) * 1.6, pitch: (pitchRatio - 0.57) * 1.6, roll }
}

function blendshapeMap(blend: Category[] | undefined) {
  const m: Record<string, number> = {}
  blend?.forEach((c) => {
    m[c.categoryName] = c.score
  })
  return m
}

export function computeFaceMetrics(p: Pt[], width: number, height: number, head: HeadPose, blend: Category[] | undefined): RawFaceMetrics {
  const left = p[234]
  const right = p[454]
  const bs = blendshapeMap(blend)
  const hasBlink = 'eyeBlinkLeft' in bs && 'eyeBlinkRight' in bs
  return {
    ear: (eyeAspect(p, EYE_A_EAR) + eyeAspect(p, EYE_B_EAR)) / 2,
    blink: hasBlink ? (bs.eyeBlinkLeft + bs.eyeBlinkRight) / 2 : null,
    yawDeg: deg(head.yaw),
    pitchDeg: deg(head.pitch),
    cx: 1 - (left.x + right.x) / 2 / width,
    cy: (p[10].y + p[152].y) / 2 / height,
    size: Math.abs(right.x - left.x) / width,
  }
}

/** Whether the head is turned towards the screen. Tolerates natural posture and off-centre webcams. */
export function isFacing(m: Pick<RawFaceMetrics, 'yawDeg' | 'pitchDeg'>) {
  return Math.abs(m.yawDeg) < 32 && Math.abs(m.pitchDeg) < 35
}

// ---- Gaze features ---------------------------------------------------------

/** Feature layout; see gazeFeatures(). */
export const FEATURE_NAMES = [
  'uA', 'vA', 'openA', 'lidA',
  'uB', 'vB', 'openB', 'lidB',
  'u', 'v',
  'lookH_L', 'lookH_R', 'lookV_L', 'lookV_R',
  'yaw', 'pitch', 'roll',
  'cx', 'cy', 'size',
  'u2', 'v2', 'uv', 'uYaw', 'vPitch',
  'apertureVA', 'apertureVB', 'apertureV',
] as const
export const U_INDEX = FEATURE_NAMES.indexOf('u')
export const V_INDEX = FEATURE_NAMES.indexOf('v')

/**
 * Smallest spread assumed per feature when standardising, so features that
 * barely changed during calibration (e.g. head position) can't blow up later.
 */
export const FEATURE_SCALE_FLOORS = Float64Array.from([
  0.01, 0.006, 0.01, 0.006,
  0.01, 0.006, 0.01, 0.006,
  0.01, 0.006,
  0.03, 0.03, 0.03, 0.03,
  0.035, 0.035, 0.035,
  0.02, 0.02, 0.01,
  0.001, 0.0005, 0.0005, 0.001, 0.0005,
  0.12, 0.12, 0.1,
])

interface EyeFrame {
  ox: number
  oy: number
  ux: number
  uy: number
  width: number
}

function eyeFrame(left: Pt, right: Pt): EyeFrame | null {
  const dx = right.x - left.x
  const dy = right.y - left.y
  const width = Math.hypot(dx, dy)
  if (!(width >= 12)) return null
  return { ox: (left.x + right.x) / 2, oy: (left.y + right.y) / 2, ux: dx / width, uy: dy / width, width }
}

/** Point in eye coordinates: u along the corner line, v perpendicular (down), both in eye widths. */
function local(f: EyeFrame, q: Pt) {
  const rx = q.x - f.ox
  const ry = q.y - f.oy
  return { u: (rx * f.ux + ry * f.uy) / f.width, v: (-rx * f.uy + ry * f.ux) / f.width }
}

/**
 * Builds the gaze feature vector: iris position inside each eye (normalised by
 * the eye's own size and tilt, so it's stable across distance and head roll),
 * eyelid position (a strong vertical cue), MediaPipe's gaze blendshapes, head
 * pose and position, plus a few second-order terms for screen curvature.
 */
export function gazeFeatures(p: Pt[], blend: Category[] | undefined, head: HeadPose, face: Pick<RawFaceMetrics, 'cx' | 'cy' | 'size'>): Float64Array | null {
  if (p.length < 478) return null
  const fA = eyeFrame(p[EYE_A.left], p[EYE_A.right])
  const fB = eyeFrame(p[EYE_B.left], p[EYE_B.right])
  if (!fA || !fB) return null
  // Assign iris centres to eyes by proximity, independent of landmark-order conventions.
  const [i1, i2] = IRIS_CENTERS.map((i) => p[i])
  const aFirst = Math.hypot(i1.x - fA.ox, i1.y - fA.oy) <= Math.hypot(i1.x - fB.ox, i1.y - fB.oy)
  const irisA = local(fA, aFirst ? i1 : i2)
  const irisB = local(fB, aFirst ? i2 : i1)
  // Gross disagreement between eyes or an iris outside the eye frame is not
  // useful gaze evidence. Pause rather than project that frame onto the UI.
  if (Math.abs(irisA.u) > .65 || Math.abs(irisB.u) > .65
    || Math.abs(irisA.v) > .35 || Math.abs(irisB.v) > .35
    || Math.abs(irisA.u - irisB.u) > .25 || Math.abs(irisA.v - irisB.v) > .18) return null
  const upA = local(fA, p[EYE_A.upper]).v
  const loA = local(fA, p[EYE_A.lower]).v
  const upB = local(fB, p[EYE_B.upper]).v
  const loB = local(fB, p[EYE_B.lower]).v
  const apertureA = (irisA.v - (upA + loA) / 2) / Math.max(.025, loA - upA)
  const apertureB = (irisB.v - (upB + loB) / 2) / Math.max(.025, loB - upB)
  const u = (irisA.u + irisB.u) / 2
  const v = (irisA.v + irisB.v) / 2
  const bs = blendshapeMap(blend)
  const g = (k: string) => bs[k] ?? 0
  const f = Float64Array.from([
    irisA.u, irisA.v, loA - upA, (upA + loA) / 2,
    irisB.u, irisB.v, loB - upB, (upB + loB) / 2,
    u, v,
    g('eyeLookOutLeft') - g('eyeLookInLeft'),
    g('eyeLookInRight') - g('eyeLookOutRight'),
    g('eyeLookUpLeft') - g('eyeLookDownLeft'),
    g('eyeLookUpRight') - g('eyeLookDownRight'),
    head.yaw, head.pitch, head.roll,
    face.cx, face.cy, face.size,
    u * u, v * v, u * v, u * head.yaw, v * head.pitch,
    apertureA, apertureB, (apertureA + apertureB) / 2,
  ])
  return f.every(Number.isFinite) ? f : null
}
