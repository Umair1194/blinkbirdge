import type { GazeAdapter, RawGaze } from './types'

/**
 * Demo Mode engine. Uses the mouse/trackpad pointer as a stand-in for gaze.
 * This is NOT eye tracking and must always be labeled as simulated in the UI.
 */
export class SimulationAdapter implements GazeAdapter {
  readonly kind = 'simulation' as const
  private gazeListener: (g: RawGaze) => void = () => {}
  private faceListener: (d: boolean) => void = () => {}
  private paused = false
  private last: { x: number; y: number } | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  private onMove = (e: PointerEvent) => {
    if (this.paused) return
    this.last = { x: e.clientX, y: e.clientY }
    this.gazeListener(this.last)
  }
  private onLeave = (e: MouseEvent) => {
    if (e.relatedTarget) return
    this.last = null
    this.gazeListener(null)
  }
  private onBlur = () => {
    this.last = null
    this.gazeListener(null)
  }

  async start() {
    window.addEventListener('pointermove', this.onMove, { passive: true })
    document.addEventListener('mouseout', this.onLeave)
    window.addEventListener('blur', this.onBlur)
    // Like a real tracker, keep streaming estimates (~30 Hz) while the pointer rests.
    this.timer = setInterval(() => {
      if (this.last && !this.paused) this.gazeListener(this.last)
    }, 33)
    this.faceListener(true)
  }
  stop() {
    window.removeEventListener('pointermove', this.onMove)
    document.removeEventListener('mouseout', this.onLeave)
    window.removeEventListener('blur', this.onBlur)
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.last = null
    this.gazeListener(null)
  }
  pause() {
    this.paused = true
    this.gazeListener(null)
  }
  resume() {
    this.paused = false
  }
  setCalibrationTarget() {}
  calibrationSampleCount() {
    return 0
  }
  fitCalibration() {
    return null
  }
  clearCalibration() {}
  reinforce() {}
  onGaze(listener: (g: RawGaze) => void) {
    this.gazeListener = listener
  }
  onFace(listener: (d: boolean) => void) {
    this.faceListener = listener
  }
  onMetrics() {}
}
