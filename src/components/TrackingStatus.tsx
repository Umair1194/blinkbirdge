import { useGazeState, useTrackingStatus } from '../hooks/useGaze'
import type { TrackingStatusCode } from '../engine/types'
import { cx } from './ui'

const COPY: Record<TrackingStatusCode, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted' }> = {
  'camera-off': { label: 'Camera off', tone: 'muted' },
  'camera-requesting': { label: 'Requesting camera…', tone: 'info' },
  'camera-connected': { label: 'Camera connected', tone: 'info' },
  'engine-loading': { label: 'Starting eye tracking…', tone: 'info' },
  'calibration-required': { label: 'Calibration required', tone: 'warn' },
  tracking: { label: 'Tracking active', tone: 'ok' },
  'face-not-detected': { label: 'Face not detected', tone: 'warn' },
  paused: { label: 'Tracking paused', tone: 'muted' },
  demo: { label: 'Demo mode — Simulated eye tracking', tone: 'info' },
  error: { label: 'Tracking unavailable', tone: 'bad' },
}

export function trackingStatusLabel(code: TrackingStatusCode) {
  return COPY[code].label
}

export function TrackingStatus({ compact = false }: { compact?: boolean }) {
  const code = useTrackingStatus()
  const s = useGazeState()
  const { label, tone } = code === 'tracking' && s.movedSinceCalibration ? { label: 'Position check needed', tone: 'warn' } : COPY[code]
  const errorLabel = s.camera === 'error' ? (s.cameraError === 'disconnected' ? 'Camera disconnected' : 'Camera error') : label
  const text = code === 'error' ? errorLabel : label
  return (
    <div
      role="status"
      aria-live="polite"
      title={text}
      className={cx(
        'inline-flex min-w-0 shrink items-center gap-2 rounded-full border font-semibold',
        compact ? 'h-8 px-2.5 text-xs' : 'h-10 px-3.5 text-sm',
        tone === 'ok' && 'border-ok/30 bg-ok/10 text-ok',
        tone === 'warn' && 'border-warn/30 bg-warn/10 text-warn',
        tone === 'bad' && 'border-bad/30 bg-bad/10 text-bad',
        tone === 'info' && 'border-info/25 bg-info/10 text-info',
        code === 'demo' && 'border-dashed !border-info/50',
        tone === 'muted' && 'border-line bg-subtle text-ink-2',
      )}
    >
      <span className="relative flex size-2.5">
        {tone === 'ok' && <span className="absolute inset-0 rounded-full bg-current animate-breathe" />}
        <span className="relative size-2.5 rounded-full bg-current" />
      </span>
      <span className="truncate whitespace-nowrap">{text}</span>
    </div>
  )
}
