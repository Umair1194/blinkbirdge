/** Selection requires a short, spatially stable fixation using distinct camera frames. */
export class FixationTracker {
  private point: { x: number; y: number } | null = null
  center() { return this.point }
  private samples: { x: number; y: number; t: number }[] = []
  reset() { this.samples = []; this.point = null }
  push(x: number, y: number, t: number, radius: number) {
    if (![x, y, t, radius].every(Number.isFinite)) { this.reset(); return false }
    const last = this.samples[this.samples.length - 1]
    if (last && t - last.t > 200) this.reset()
    if (!last || t > last.t) this.samples.push({ x, y, t })
    while (this.samples.length && t - this.samples[0].t > 320) this.samples.shift()
    if (this.samples.length < 4 || t - this.samples[0].t < 220) return false
    const median = (values: number[]) => values.sort((a,b) => a-b)[values.length >> 1]
    const mx = median(this.samples.map(s => s.x)), my = median(this.samples.map(s => s.y))
    this.point = { x: mx, y: my }
    const distances = this.samples.map(s => Math.hypot(s.x - mx, s.y - my)).sort((a,b) => a-b)
    return distances[Math.floor(distances.length * .9)] <= radius && distances[distances.length - 1] <= radius * 2
  }
}
