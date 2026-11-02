import { AlertTriangle, ArrowRight, Camera, ExternalLink, Gauge, CheckCircle2, Eye, Lightbulb, Loader2, MonitorSmartphone, MousePointer2, RefreshCw, ScanFace, ShieldCheck, Sun } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CameraPreview } from '../components/CameraPreview'
import { FaceChecklist } from '../components/FaceCheck'
import { Card, Select, buttonClass, cx } from '../components/ui'
import { CAMERA_ERROR_COPY, cameraBlockedByFrame, isEmbedded, openInNewTab, type CameraDevice } from '../engine/camera'
import { gazeService } from '../engine/gazeService'
import { useGazeState } from '../hooks/useGaze'
import { navigate } from '../lib/router'

const INSTRUCTIONS = [
  { icon: ScanFace, text: 'Position your face comfortably in front of the screen.' },
  { icon: Eye, text: 'Keep your eyes visible.' },
  { icon: Lightbulb, text: 'Make sure your environment has sufficient lighting.' },
  { icon: MonitorSmartphone, text: 'Keep your screen at a comfortable viewing distance.' },
]

function lightingOf(luma: number | null) {
  if (luma === null) return null
  if (luma < 55) return { label: 'Too dark', tone: 'warn', hint: 'Add light in front of you — a lamp behind the screen works well.' } as const
  if (luma > 205) return { label: 'Very bright', tone: 'warn', hint: 'Avoid strong light or a window directly behind you.' } as const
  return { label: 'Good', tone: 'ok', hint: 'Lighting looks suitable for tracking.' } as const
}

function StatusLine({ label, value, tone, icon: Icon }: { label: string; value: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted'; icon: typeof Camera }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <Icon aria-hidden className="size-5 shrink-0 text-ink-2" />
      <span className="flex-1 text-[15px] font-medium text-ink">{label}</span>
      <span
        className={cx(
          'rounded-full px-2.5 py-1 text-sm font-semibold',
          tone === 'ok' && 'bg-ok/10 text-ok',
          tone === 'warn' && 'bg-warn/10 text-warn',
          tone === 'bad' && 'bg-bad/10 text-bad',
          tone === 'info' && 'bg-info/10 text-info',
          tone === 'muted' && 'bg-subtle text-ink-2',
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function CameraSetupPage() {
  const s = useGazeState()
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [luma, setLuma] = useState<number | null>(null)
  const stream = gazeService.getStream()
  const connected = s.camera === 'connected'
  const embedded = useMemo(() => isEmbedded(), [])
  const frameBlocked = useMemo(() => cameraBlockedByFrame(), [])
  const suggestNewTab = embedded && (frameBlocked || s.cameraError === 'blocked-by-frame' || s.cameraError === 'permission-denied')
  const newTabButton = (
    <button type="button" className={cx(buttonClass('primary', 'lg'), 'hc:bg-brand')} onClick={openInNewTab}>
      <ExternalLink className="size-5" /> Open in new tab
    </button>
  )

  const refreshDevices = useCallback(() => {
    void gazeService.listCameras().then(setDevices).catch(() => setDevices([]))
  }, [])

  // Start the eye-tracking engine once the camera is live, so face detection works here.
  useEffect(() => {
    if (!connected) return
    refreshDevices()
    if (s.mode !== 'webcam' && s.engine !== 'loading') void gazeService.startTracking('webcam')
  }, [connected, s.mode, s.engine, refreshDevices])

  useEffect(() => {
    if (!connected) setLuma(null)
  }, [connected])

  const request = (deviceId?: string | null) => void gazeService.initializeCamera(deviceId ?? s.deviceId)
  const lighting = lightingOf(luma)
  const err = s.cameraError ? CAMERA_ERROR_COPY[s.cameraError] : null
  const engineReady = s.mode === 'webcam' && s.engine === 'running'

  const demo = async () => {
    await gazeService.startTracking('simulation')
    navigate('workspace')
  }

  const face =
    !connected || s.mode !== 'webcam'
      ? { value: 'Waiting for camera', tone: 'muted' as const }
      : s.engine === 'loading'
        ? { value: 'Loading engine…', tone: 'info' as const }
        : s.engine === 'error'
          ? { value: 'Unavailable', tone: 'bad' as const }
          : s.faceDetected === true
            ? { value: 'Face detected', tone: 'ok' as const }
            : s.faceDetected === false
              ? { value: 'No face detected', tone: 'warn' as const }
              : { value: 'Looking for face…', tone: 'info' as const }

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-8 lg:px-8">
      <div className="mb-7 max-w-3xl">
        <p className="text-sm font-semibold text-brand">Step 1 of 2</p>
        <h2 className="mt-1 text-[32px] font-bold leading-tight tracking-tight text-ink">Let’s Set Up Your Eye Tracking</h2>
        <p className="mt-2 text-lg text-ink-2">Your camera lets Gesture Playground estimate where you’re looking. Video stays on this device.</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <CameraPreview
            stream={connected ? stream : null}
            state={s.camera}
            faceDetected={s.mode === 'webcam' ? s.faceDetected : null}
            onBrightness={setLuma}
            className="aspect-video w-full"
            placeholder={
              err ? (
                <>
                  <AlertTriangle className="size-10 text-[#fbbf24]" />
                  <p className="text-xl font-semibold">{err.title}</p>
                  <p className="max-w-md text-[15px] text-white/75">{err.body}</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    {suggestNewTab && newTabButton}
                    {s.cameraError !== 'blocked-by-frame' && (
                      <button type="button" className={cx(buttonClass(suggestNewTab ? 'secondary' : 'primary', 'lg'), 'hc:bg-brand')} onClick={() => request()}>
                        <RefreshCw className="size-5" /> Retry camera
                      </button>
                    )}
                    <button type="button" className="inline-flex h-14 items-center gap-2 rounded-xl border border-white/30 px-6 font-semibold text-white hover:bg-white/10" onClick={demo}>
                      <MousePointer2 className="size-5" /> Use Demo Mode
                    </button>
                  </div>
                </>
              ) : frameBlocked ? (
                <>
                  <ExternalLink className="size-10 text-[#5eead4]" />
                  <p className="text-xl font-semibold">{CAMERA_ERROR_COPY['blocked-by-frame'].title}</p>
                  <p className="max-w-md text-[15px] text-white/75">{CAMERA_ERROR_COPY['blocked-by-frame'].body}</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    {newTabButton}
                    <button type="button" className="inline-flex h-14 items-center gap-2 rounded-xl border border-white/30 px-6 font-semibold text-white hover:bg-white/10" onClick={demo}>
                      <MousePointer2 className="size-5" /> Use Demo Mode
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10">
                    <Camera className="size-8 text-[#5eead4]" />
                  </div>
                  <p className="text-xl font-semibold">Your camera is off</p>
                  <p className="max-w-md text-[15px] text-white/75">
                    We’ll only turn it on after you allow it. Nothing is recorded or uploaded — the video is analysed in this browser tab.
                  </p>
                  <button type="button" className={cx(buttonClass('primary', 'lg'), 'mt-2')} onClick={() => request()}>
                    <Camera className="size-5" /> Allow camera access
                  </button>
                </>
              )
            }
          />
          {connected && s.mode === 'webcam' && s.faceDetected === false && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-[15px] text-ink">
              <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warn" />
              <p>
                <strong className="font-semibold">No face detected.</strong> Move into the oval, face the screen and make sure your eyes aren’t covered by glare or hair.
              </p>
            </div>
          )}
          {s.engine === 'error' && s.engineError && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad/10 p-4 text-[15px] text-ink">
              <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-bad" />
              <div>
                <p>
                  <strong className="font-semibold">Eye tracking couldn’t start.</strong> {s.engineError}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => void gazeService.startTracking('webcam')}>
                    <RefreshCw className="size-4" /> Try again
                  </button>
                  <button type="button" className={buttonClass('secondary', 'sm')} onClick={demo}>
                    <MousePointer2 className="size-4" /> Continue in Demo Mode
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-bold tracking-tight text-ink">Status</h3>
            <div className="mt-1 divide-y divide-line">
              <StatusLine
                icon={ShieldCheck}
                label="Camera permission"
                value={
                  connected
                    ? 'Allowed'
                    : frameBlocked || s.cameraError === 'blocked-by-frame'
                      ? 'Blocked by preview'
                      : s.cameraError === 'permission-denied'
                        ? 'Denied'
                        : s.camera === 'requesting'
                          ? 'Asking…'
                          : 'Not requested'
                }
                tone={connected ? 'ok' : frameBlocked || s.cameraError === 'blocked-by-frame' || s.cameraError === 'permission-denied' ? 'bad' : 'muted'}
              />
              <StatusLine
                icon={Camera}
                label="Connection"
                value={connected ? 'Connected' : s.camera === 'error' ? (s.cameraError === 'disconnected' ? 'Disconnected' : 'Not connected') : 'Off'}
                tone={connected ? 'ok' : s.camera === 'error' ? 'bad' : 'muted'}
              />
              <StatusLine icon={ScanFace} label="Face" value={face.value} tone={face.tone} />
              <StatusLine icon={Sun} label="Lighting" value={lighting?.label ?? 'Waiting for camera'} tone={lighting?.tone ?? 'muted'} />
              {engineReady && s.face && (
                <StatusLine
                  icon={Gauge}
                  label="Tracking speed"
                  value={`${s.face.fps} fps`}
                  tone={s.face.fps >= 20 ? 'ok' : s.face.fps >= 10 ? 'warn' : 'bad'}
                />
              )}
            </div>
            {lighting && <p className="mt-1 text-sm text-ink-2">{lighting.hint}</p>}
            {engineReady && s.face && s.face.fps < 20 && (
              <p className="mt-1 text-sm text-ink-2">Tracking is running slowly on this device. Closing other apps and browser tabs makes the cursor smoother.</p>
            )}
            {s.face?.detected && <FaceChecklist face={s.face} className="mt-3" />}

            <div className="mt-5 space-y-2">
              <label htmlFor="camera-select" className="text-sm font-semibold text-ink">
                Camera
              </label>
              <Select
                label="Camera"
                value={s.deviceId ?? ''}
                onChange={(id) => request(id)}
                disabled={!connected || devices.length < 2}
              >
                {devices.length === 0 && <option value="">Allow camera access to choose</option>}
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button type="button" className={buttonClass('primary', 'lg')} disabled={!engineReady} onClick={() => navigate('calibrate')}>
                {s.engine === 'loading' ? (
                  <>
                    <Loader2 className="size-5 animate-spin" /> Starting eye tracking…
                  </>
                ) : (
                  <>
                    Continue to calibration <ArrowRight className="size-5" />
                  </>
                )}
              </button>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button type="button" className={buttonClass('secondary')} onClick={() => request()} disabled={s.camera === 'requesting'}>
                  <RefreshCw className="size-4" /> Retry camera
                </button>
                <button type="button" className={buttonClass('secondary')} onClick={demo}>
                  <MousePointer2 className="size-4" /> Demo Mode
                </button>
              </div>
              {s.engine === 'loading' && <p className="text-sm text-ink-2">The first start loads the face model and can take up to 30 seconds.</p>}
              {embedded && (
                <button type="button" className={buttonClass('ghost', 'sm')} onClick={openInNewTab}>
                  <ExternalLink className="size-4" /> Camera not working here? Open in a new tab
                </button>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold tracking-tight text-ink">Before you begin</h3>
            <ol className="mt-4 space-y-3.5">
              {INSTRUCTIONS.map(({ icon: Icon, text }, i) => (
                <li key={text} className="flex gap-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-start gap-2 pt-1 text-[15px] leading-snug text-ink">
                    {text}
                    <Icon aria-hidden className="ml-auto size-5 shrink-0 text-ink-2/70" />
                  </span>
                </li>
              ))}
            </ol>
            {connected && s.faceDetected && (
              <p className="mt-5 flex items-center gap-2 rounded-xl bg-ok/10 p-3 text-sm font-medium text-ink">
                <CheckCircle2 aria-hidden className="size-5 text-ok" /> Looking good — keep this position for calibration.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
