/** Require several agreeing camera frames before labelling a frame with a dot.
 * Coordinates are iris displacement in eye-width units, not screen pixels. */
export class CalibrationStability {
  private recent: {u:number;v:number}[] = []
  reset() { this.recent = [] }
  push(u:number,v:number) {
    if (!Number.isFinite(u) || !Number.isFinite(v)) { this.reset(); return false }
    this.recent.push({u,v})
    if (this.recent.length > 5) this.recent.shift()
    if (this.recent.length < 5) return false
    const us = this.recent.map(point=>point.u), vs=this.recent.map(point=>point.v)
    return Math.max(...us)-Math.min(...us)<=.025 && Math.max(...vs)-Math.min(...vs)<=.018
  }
}
