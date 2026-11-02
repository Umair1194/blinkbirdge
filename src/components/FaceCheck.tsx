import { Check, Info, X } from 'lucide-react'
import { gazeService } from '../engine/gazeService'
import type { FaceStatus } from '../engine/types'
import { useGazeState } from '../hooks/useGaze'
import { CameraPreview } from './CameraPreview'
import { cx } from './ui'

/** The user is visible, facing the screen, with eyes open. */
export function attentionReady(face: FaceStatus | null) {
  return !!face && face.detected && face.facing && face.eyesOpen
}

const POSITION_TIP: Record<Exclude<FaceStatus['position'], 'ok'>, string> = {
  'move-left': 'Move a little to the left',
  'move-right': 'Move a little to the right',
  'move-up': 'Raise your head a little, or lower the camera',
  'move-down': 'Lower your head a little, or raise the camera',
}

export function FaceChecklist({ face, className }: { face: FaceStatus | null; className?: string }) {
  const detected = !!face?.detected
  const rows = [
    { ok: detected, label: 'Face in view', fix: 'Sit in front of the camera, inside the oval' },
    { ok: detected && !!face?.facing, label: 'Looking at the screen', fix: 'Turn your head towards the screen' },
    { ok: detected && !!face?.eyesOpen, label: 'Eyes open and visible', fix: 'Keep your eyes open; avoid glare on glasses' },
  ]
  const tips = [
    face?.detected && face.distance === 'too-far' && 'Move a little closer to the screen',
    face?.detected && face.distance === 'too-close' && 'Sit back a little',
    face?.detected && face.position !== 'ok' && POSITION_TIP[face.position as Exclude<FaceStatus['position'], 'ok'>],
    face?.detected && face.glare && 'Reflections on your glasses — tilt them slightly down, or dim lights in front of you',
  ].filter(Boolean) as string[]

  return (
    <div className={className}>
      <ul className="space-y-2" aria-live="polite">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3">
            <span
              className={cx(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                r.ok ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn',
              )}
            >
              {r.ok ? <Check aria-hidden className="size-4" strokeWidth={3} /> : <X aria-hidden className="size-4" strokeWidth={3} />}
            </span>
            <span className="text-[15px] leading-snug text-ink">
              <span className="font-semibold">{r.label}</span>
              {!r.ok && <span className="block text-sm text-ink-2">{r.fix}</span>}
              <span className="sr-only">{r.ok ? ' — ok' : ' — not yet'}</span>
            </span>
          </li>
        ))}
      </ul>
      {tips.map((t) => (
        <p key={t} className="mt-2 flex items-center gap-2 text-sm text-ink-2">
          <Info aria-hidden className="size-4 shrink-0 text-info" /> {t}
        </p>
      ))}
    </div>
  )
}

/** Live mirrored camera view with the face oval, using the tracking stream. */
export function FacePreview({ className }: { className?: string }) {
  const s = useGazeState()
  const live = s.camera === 'connected'
  return (
    <CameraPreview
      stream={live ? gazeService.getStream() : null}
      state={s.camera}
      faceDetected={s.face ? attentionReady(s.face) : s.faceDetected}
      className={className}
    />
  )
}
