import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cx } from './ui'

interface Props {
  x: number
  y: number
  state: 'pending' | 'active' | 'done'
  progress: number
  faceOk?: boolean
  label: string
}

/** A single calibration point positioned in normalized viewport coordinates. */
export function CalibrationTarget({ x, y, state, progress, faceOk = true, label }: Props) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      aria-label={label}
      aria-current={state === 'active' ? 'step' : undefined}
    >
      {state === 'pending' && <div className="size-3 rounded-full bg-line-strong" />}
      {state === 'done' && (
        <div className="flex size-7 items-center justify-center rounded-full bg-brand-soft-2 text-brand">
          <Check className="size-4" strokeWidth={3} />
        </div>
      )}
      {state === 'active' && (
        <div className="animate-target-in relative flex size-20 items-center justify-center">
          <span aria-hidden className={cx('absolute inset-0 rounded-full', faceOk ? 'bg-brand-2/15' : 'bg-warn/20')} />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={
              {
                background: `conic-gradient(${faceOk ? 'var(--app-accent)' : 'var(--app-warning)'} ${progress * 360}deg, transparent 0)`,
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))',
              } as CSSProperties
            }
          />
          <span aria-hidden className={cx('absolute size-9 rounded-full animate-breathe', faceOk ? 'bg-brand-2/40' : 'bg-warn/40')} />
          <span aria-hidden className={cx('relative size-4 rounded-full ring-4 ring-surface', faceOk ? 'bg-brand' : 'bg-warn')} />
        </div>
      )}
    </div>
  )
}
