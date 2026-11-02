export type SmoothingLevel = 'off' | 'low' | 'medium' | 'high'

interface Preset {
  minCutoff: number
  beta: number
  maxCutoff: number
  maxSpeed: number
}

// Bound responsiveness: camera noise must not turn smoothing off by masquerading
// as a high-speed eye movement. Settings trade settling time for steadiness.
const PRESETS: Record<Exclude<SmoothingLevel, 'off'>, Preset> = {
  low: { minCutoff: 1.5, beta: 0.002, maxCutoff: 5, maxSpeed: 800 },
  medium: { minCutoff: 0.9, beta: 0.0015, maxCutoff: 3.5, maxSpeed: 500 },
  high: { minCutoff: 0.65, beta: 0.001, maxCutoff: 2.5, maxSpeed: 320 },
}
const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt))
const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1]

export class GazeFilter {
  private preset: Preset | null = PRESETS.high
  private hist: { x: number; y: number }[] = []
  private out: { x: number; y: number } | null = null
  private previous: { x: number; y: number } | null = null
  private speed = 0
  private lastT = 0

  setLevel(level: SmoothingLevel) {
    this.preset = level === 'off' ? null : PRESETS[level]
    this.reset()
  }

  reset() {
    this.hist = []
    this.out = null
    this.previous = null
    this.speed = 0
    this.lastT = 0
  }

  push(x: number, y: number, t: number, limitMotion = true) {
    // Never poison subsequent frames with a malformed estimate.
    if (![x, y, t].every(Number.isFinite)) return this.out ?? { x: 0, y: 0 }
    if (this.lastT && t - this.lastT > 2000) this.reset()
    else if (this.lastT && t - this.lastT > 250) { this.hist = []; this.previous = null; this.speed = 0 }
    const p = this.preset
    if (!p) { this.lastT = t; return this.out = { x, y } }
    this.hist.push({ x, y })
    if (this.hist.length > 5) this.hist.shift()
    const point = { x: median(this.hist.map(h => h.x)), y: median(this.hist.map(h => h.y)) }
    if (!this.out) {
      this.previous = point
      this.lastT = t
      return this.out = point
    }
    this.previous ??= point
    const dt = Math.min(0.1, Math.max(0.001, (t - this.lastT) / 1000))
    this.lastT = t
    // Derivative of consecutive input measurements, not distance from the
    // smoothed output. Output lag must not be mistaken for continuing motion.
    const velocity = Math.min(1200, Math.hypot(point.x - this.previous.x, point.y - this.previous.y) / dt)
    this.previous = point
    this.speed += alpha(1, dt) * (velocity - this.speed)
    const cutoff = Math.min(p.maxCutoff, p.minCutoff + p.beta * this.speed)
    const k = alpha(cutoff, dt)
    let dx = k * (point.x - this.out.x), dy = k * (point.y - this.out.y)
    const distance = Math.hypot(dx, dy)
    const maxStep = p.maxSpeed * dt
    if (limitMotion && distance > maxStep) { dx *= maxStep / distance; dy *= maxStep / distance }
    return this.out = { x: this.out.x + dx, y: this.out.y + dy }
  }
}
