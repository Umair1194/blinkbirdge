import { useEffect, useRef } from 'react'
import { gazeService } from '../engine/gazeService'

/** How quickly the drawn cursor glides to the latest gaze estimate. */
const GLIDE_MS = 30

/**
 * Visible gaze estimate. Gaze arrives at the camera's frame rate (~15–30 Hz);
 * the cursor is animated at display rate so it glides instead of stepping.
 * Positioned imperatively to avoid re-rendering React at frame rate.
 */
export function GazeCursor({ visible }: { visible: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!visible) return
    let raf = 0
    let last = performance.now()
    let pos: { x: number; y: number } | null = null
    let shown = false
    const tick = (now: number) => {
      const dt = Math.min(100, now - last)
      last = now
      const el = ref.current
      const g = gazeService.getGazeCoordinates()
      if (el) {
        if (g) {
          const target = { x: g.x * window.innerWidth, y: g.y * window.innerHeight }
          if (!pos || !shown) pos = target // reappear in place rather than sweeping across
          else {
            const k = 1 - Math.exp(-dt / GLIDE_MS)
            pos = { x: pos.x + (target.x - pos.x) * k, y: pos.y + (target.y - pos.y) * k }
          }
          el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
          if (!shown) {
            el.style.opacity = '1'
            shown = true
          }
        } else if (shown) {
          el.style.opacity = '0'
          shown = false
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible])

  if (!visible) return null
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] opacity-0 transition-opacity duration-150"
      style={{ willChange: 'transform' }}
    >
      <div className="-translate-x-1/2 -translate-y-1/2">
        <div
          className="flex size-11 items-center justify-center rounded-full border-[2.5px]"
          style={{
            borderColor: 'var(--cursor)',
            background: 'color-mix(in oklab, var(--cursor) 14%, transparent)',
            boxShadow: '0 0 0 1.5px color-mix(in oklab, var(--app-surface) 85%, transparent)',
          }}
        >
          <div className="size-2.5 rounded-full" style={{ background: 'var(--cursor)', boxShadow: '0 0 0 2px var(--app-surface)' }} />
        </div>
      </div>
    </div>
  )
}
