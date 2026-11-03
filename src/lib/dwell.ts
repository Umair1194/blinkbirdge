import { gazeService, type BlinkEvent } from '../engine/gazeService'
import { FixationTracker } from '../engine/fixation'
import { playSelectSound } from './sound'

/** Gaze may briefly wander off a target for this long without resetting progress. */
const GRACE_MS = 220
/** If gaze is lost entirely, the re-selection lock is only released after this long. */
const LOST_RELEASE_MS = 600
/** Minimum time between two selections, to prevent bursts from noisy input. */
const REFRACTORY_MS = 350
/** How quickly a target's focus evidence follows the gaze. */
const FOCUS_TAU_MS = 120
/** Evidence needed to focus a target, to keep it, and the margin needed to switch. */
const FOCUS_MIN = 0.45
const FOCUS_KEEP = 0.25
const FOCUS_SWITCH_MARGIN = 0.08
/** Spatial spread used when Target assist is off: essentially exact hits only. */
const EXACT_SIGMA_PX = 8
/** A selection only teaches the gaze model if it isn't corrected within this time. */
const LEARN_CONFIRM_MS = 2500
const CORRECTION_TARGET = /(backspace|undo|clear)/

export type SelectionMethod = 'dwell' | 'blink' | 'both'

interface TargetAction {
  onSelect: () => void
  allowWhenPaused?: boolean
  /** Multiplier on the dwell time, e.g. 1.5 for consequential actions. */
  dwellScale?: number
}

interface Snapshot {
  activeId: string | null
  progress: number
  hoverId: string | null
}

function queryTarget(scope: ParentNode, id: string) {
  return scope.querySelector<HTMLElement>(`[data-gaze-id="${CSS.escape(id)}"]`)
}

/**
 * Turns a stream of gaze coordinates into selections.
 * - Dwell: progress accumulates only while gaze stays on one target.
 * - Short jitter (< GRACE_MS) away from the target pauses rather than resets,
 *   and the current target is "sticky" just beyond its edges.
 * - After a selection the target is locked until gaze leaves it.
 * - Missing gaze, tracking loss or pause cancels pending selections.
 * - Optional: a deliberate blink selects the target being looked at.
 * - Confirmed selections teach the gaze model where the user was looking.
 */
class DwellController {
  private actions = new Map<string, TargetAction>()
  private listeners = new Set<() => void>()
  private selectListeners = new Set<(id: string) => void>()
  private snap: Snapshot = { activeId: null, progress: 0, hoverId: null }
  private current: { id: string; acc: number; since: number } | null = null
  private candidate: { id: string | null; since: number } | null = null
  private locked: { id: string; leftAt: number | null } | null = null
  private hover: { id: string; since: number; lastSeen: number } | null = null
  private pendingLearn: { x: number; y: number; from: number; to: number; deadline: number } | null = null
  private lastSelectAt = 0
  private last = 0
  private raf = 0
  private offBlink: (() => void) | null = null
  private evidence = new Map<string, number>()
  private focusId: string | null = null
  private fixation = new FixationTracker()
  private fixationId: string | null = null
  private stableTarget: { id: string; at: number } | null = null
  config = {
    dwellMs: 1200,
    targetAssist: true,
    sound: true,
    method: 'dwell' as SelectionMethod,
    learn: false,
    /** Expected gaze error (px): measured accuracy for webcam tracking, small for Demo Mode. */
    sigmaPx: 40,
  }

  register(id: string, action: TargetAction) {
    this.actions.set(id, action)
    return () => {
      if (this.actions.get(id) === action) this.actions.delete(id)
    }
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }
  onSelected(l: (id: string) => void) {
    this.selectListeners.add(l)
    return () => {
      this.selectListeners.delete(l)
    }
  }
  /** -1 idle, 0 hovered (no progress), (0..1] dwell progress. */
  stateFor(id: string) {
    if (this.snap.activeId === id && this.snap.progress > 0) return this.snap.progress
    if (this.snap.hoverId === id || this.snap.activeId === id) return 0
    return -1
  }
  getSnapshot = () => this.snap

  start() {
    if (this.raf) return
    this.last = performance.now()
    const loop = (now: number) => {
      this.frame(now)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
    this.offBlink = gazeService.subscribeBlink((e) => this.onBlink(e))
  }
  stop() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.offBlink?.()
    this.offBlink = null
  }
  reset() {
    this.current = null
    this.candidate = null
    this.locked = null
    this.pendingLearn = null
    this.hover = null
    this.evidence.clear()
    this.focusId = null
    this.fixation.reset()
    this.fixationId = null
    this.stableTarget = null
    this.publish(null, 0, null)
  }

  private scope(): ParentNode {
    const scopes = document.querySelectorAll<HTMLElement>('[data-gaze-scope]')
    return scopes.length ? scopes[scopes.length - 1] : document
  }

  /**
   * Focus by accumulated evidence rather than a single noisy point: every frame,
   * each target gains evidence by how close the gaze is (relative to the
   * expected tracking error) and loses it otherwise. The focused target only
   * changes when another one clearly wins, so the highlight stays on the key
   * the user means instead of flickering between neighbours.
   */
  private focusTarget(x: number | null, y: number | null, dt: number): HTMLElement | null {
    const scope = this.scope()
    const sigma = this.config.targetAssist ? this.config.sigmaPx : EXACT_SIGMA_PX
    const k = 1 - Math.exp(-dt / FOCUS_TAU_MS)
    const elements = new Map<string, HTMLElement>()
    let directHit: string | null = null
    scope.querySelectorAll<HTMLElement>('[data-gaze-id]').forEach((el) => {
      const id = el.dataset.gazeId
      if (!id || el.dataset.gazeDisabled === 'true') return
      // A coarse fit never arms ordinary letter keys or small toolbar buttons.
      if (gazeService.getState().calibration?.assisted && el.dataset.gazeAssisted !== 'true') return
      let like = 0
      if (x !== null && y !== null) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return
        const dx = Math.max(r.left - x, 0, x - r.right)
        const dy = Math.max(r.top - y, 0, y - r.bottom)
        const d2 = dx * dx + dy * dy
        // Assist only across a narrow gap, never a whole neighbouring key.
        const localSigma = Math.min(sigma, Math.min(r.width, r.height) * .18)
        if (d2 === 0) directHit = id
        like = d2 === 0 ? 1 : !this.config.targetAssist || d2 > 4 * localSigma * localSigma ? 0 : .7 * Math.exp(-d2 / (2 * localSigma * localSigma))
      }
      const prev = this.evidence.get(id) ?? 0
      const next = prev + k * (like - prev)
      if (next > 0.01) {
        this.evidence.set(id, next)
        elements.set(id, el)
      } else this.evidence.delete(id)
    })
    for (const id of [...this.evidence.keys()]) if (!elements.has(id)) this.evidence.delete(id)

    let best: string | null = null
    let bestE = 0
    this.evidence.forEach((e, id) => {
      if (e > bestE) {
        best = id
        bestE = e
      }
    })
    if (directHit && (this.evidence.get(directHit) ?? 0) >= FOCUS_MIN) best = directHit
    const cur = this.focusId ? (this.evidence.get(this.focusId) ?? 0) : 0
    if (!directHit && this.focusId && cur >= FOCUS_KEEP && (best === this.focusId || bestE < cur + FOCUS_SWITCH_MARGIN)) best = this.focusId
    else if (bestE < FOCUS_MIN) best = null
    // Ignore targets covered by something else (e.g. scrolled under a sticky header).
    const el = best ? elements.get(best) : undefined
    if (el && !this.visible(el)) best = null
    this.focusId = best
    return best ? (elements.get(best) ?? null) : null
  }

  private visible(el: HTMLElement) {
    const r = el.getBoundingClientRect()
    const cx = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2))
    const cy = Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2))
    const top = document.elementFromPoint(cx, cy)
    return !top || el.contains(top) || top.contains(el)
  }

  private frame(now: number) {
    const dt = Math.min(100, now - this.last)
    this.last = now
    const s = gazeService.getState()
    const gaze = gazeService.getGazeCoordinates()

    let rawId: string | null = null
    const active = !document.hidden && !!gaze && gazeService.canSelect()
    const el = this.focusTarget(active ? gaze.x * window.innerWidth : null, active ? gaze.y * window.innerHeight : null, dt)
    if (active && el) {
      const id = el.dataset.gazeId
      const action = id ? this.actions.get(id) : undefined
      if (id && action && (!s.paused || action.allowWhenPaused)) rawId = id
    }

    let stable = s.mode !== 'webcam'
    if (s.mode === 'webcam') {
      if (rawId !== this.fixationId || !active) {
        this.fixation.reset()
        this.fixationId = rawId
      }
      const raw = gazeService.getRawGazeCoordinates()
      if (rawId && raw && el) {
        const rect = el.getBoundingClientRect()
        stable = this.fixation.push(raw.x * window.innerWidth, raw.y * window.innerHeight,
          raw.timestamp, Math.min(45, Math.max(12, Math.min(rect.width, rect.height) * .45)))
        const center = this.fixation.center()
        stable = stable && !!center && center.x >= rect.left && center.x <= rect.right && center.y >= rect.top && center.y <= rect.bottom
        if (stable) this.stableTarget = { id: rawId, at: now }
      }
    }

    // Hover history, used to resolve blink selections.
    if (rawId) {
      if (this.hover?.id === rawId) this.hover.lastSeen = now
      else this.hover = { id: rawId, since: now, lastSeen: now }
    }

    // Re-selection lock: gaze must move off the selected target first. A tracking
    // dropout doesn't count as leaving unless it lasts a while (looking away).
    if (this.locked) {
      if (rawId === this.locked.id) this.locked.leftAt = null
      else {
        this.locked.leftAt ??= now
        if (now - this.locked.leftAt >= (gaze ? GRACE_MS : LOST_RELEASE_MS)) this.locked = null
      }
    }
    const id = !stable || (this.locked && rawId === this.locked.id) ? null : rawId

    if (this.current && id === this.current.id) {
      this.current.acc += dt
      this.candidate = null
    } else {
      if (!this.candidate || this.candidate.id !== id) this.candidate = { id, since: now }
      if (!this.current || now - this.candidate.since >= GRACE_MS) {
        const c = this.candidate
        this.current = c.id ? { id: c.id, acc: now - c.since, since: c.since } : null
        this.candidate = null
      }
    }

    const dwellEnabled = this.config.method !== 'blink'
    let progress = 0
    if (this.current) {
      const action = this.actions.get(this.current.id)
      if (!action) this.current = null
      else {
        const needed = this.config.dwellMs * (action.dwellScale ?? 1)
        progress = Math.min(1, this.current.acc / needed)
        if (dwellEnabled && active && id === this.current.id && this.current.acc >= needed && now - this.lastSelectAt >= REFRACTORY_MS) {
          const { id: selected, since } = this.current
          this.select(selected, now, Math.max(since + 200, now - 900), now)
          progress = 0
        }
      }
    }

    if (this.pendingLearn && now > this.pendingLearn.deadline) this.commitLearn()
    this.publish(this.current?.id ?? null, dwellEnabled ? progress : 0, rawId)
  }

  /** A deliberate blink selects whatever the user was looking at when they closed their eyes. */
  private onBlink(e: BlinkEvent) {
    if (this.config.method === 'dwell') return
    const s = gazeService.getState()
    const h = this.hover
    if (document.hidden || !gazeService.canSelect() || !h) return
    if (s.mode === 'webcam' && (!this.stableTarget || this.stableTarget.id !== h.id || this.stableTarget.at < e.start - 250)) return
    if (h.lastSeen < e.start - 250 || e.start - h.since < 150) return
    const action = this.actions.get(h.id)
    if (!action || (s.paused && !action.allowWhenPaused)) return
    const el = queryTarget(this.scope(), h.id)
    if (!el || el.dataset.gazeDisabled === 'true' || !this.visible(el) || this.locked?.id === h.id) return
    const now = performance.now()
    if (now - this.lastSelectAt < REFRACTORY_MS) return
    this.select(h.id, now, e.start - 800, e.start - 80)
  }

  private select(id: string, now: number, lookedFrom: number, lookedTo: number) {
    const action = this.actions.get(id)
    if (!action) return

    // A correction right after a selection means it was wrong: don't learn from it.
    if (this.pendingLearn) {
      if (CORRECTION_TARGET.test(id)) this.pendingLearn = null
      else this.commitLearn()
    }
    if (this.config.learn) {
      const el = queryTarget(this.scope(), id)
      if (el?.dataset.gazeLearn === 'true') {
        const r = el.getBoundingClientRect()
        this.pendingLearn = {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          from: lookedFrom,
          to: lookedTo,
          deadline: now + LEARN_CONFIRM_MS,
        }
      }
    }

    this.current = null
    this.candidate = null
    this.locked = { id, leftAt: null }
    this.lastSelectAt = now
    if (this.config.sound) playSelectSound()
    this.selectListeners.forEach((l) => l(id))
    action.onSelect()
  }

  private commitLearn() {
    const p = this.pendingLearn
    this.pendingLearn = null
    if (p && this.config.learn && gazeService.canSelect()) gazeService.reinforce({ x: p.x, y: p.y }, p.from, p.to)
  }

  private publish(activeId: string | null, progress: number, hoverId: string | null) {
    const q = Math.round(progress * 100) / 100
    const p = this.snap
    if (p.activeId === activeId && p.progress === q && p.hoverId === hoverId) return
    this.snap = { activeId, progress: q, hoverId }
    this.listeners.forEach((l) => l())
  }
}

export const dwell = new DwellController()
