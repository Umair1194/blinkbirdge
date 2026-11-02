import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Crosshair,
  Eye,
  Keyboard,
  MousePointer2,
  Play,
  RotateCcw,
  SkipForward,
  TriangleAlert,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { CalibrationTarget } from "../components/CalibrationTarget"
import {
  FaceChecklist,
  FacePreview,
  attentionReady,
} from "../components/FaceCheck"
import { GazeButton } from "../components/GazeButton"
import { TrackingStatus } from "../components/TrackingStatus"
import { buttonClass, cx } from "../components/ui"
import {
  AttentionLostError,
  CalibrationCaptureError,
  gazeService,
  summarizeValidation,
} from "../engine/gazeService"
import { calibrationUsable } from '../engine/trackingQuality'
import type { ValidationResult } from "../engine/types"
import { useGazeState } from "../hooks/useGaze"
import { navigate } from "../lib/router"
import { useApp } from "../state/AppStore"

const XS = [0.07, 0.5, 0.93]
const YS = [0.15, 0.5, 0.88]
const GRID = YS.flatMap((y) => XS.map((x) => ({ x, y })))
// Start at the centre and alternate across the screen to reduce order bias.
const POINTS = [...[4, 0, 8, 2, 6, 1, 7, 3, 5].map(index => GRID[index]),
  {x:.28,y:.3}, {x:.72,y:.7}, {x:.72,y:.3}, {x:.28,y:.7}]
const FINAL_CHECK = [{x:.4,y:.3},{x:.6,y:.3},{x:.5,y:.67},{x:.28,y:.6},{x:.72,y:.6}]
const VALIDATION = [
  { x: 0.3, y: 0.32 },
  { x: 0.7, y: 0.32 },
  { x: 0.5, y: 0.55 },
  { x: 0.3, y: 0.78 },
  { x: 0.7, y: 0.78 },
]
const AUTO_START_S = 5
const AUTO_RESTART_S = 3

type Phase = "intro" | "running" | "refining" | "validating" | "interrupted" | "failed" | "done"

function quality(v: ValidationResult) {
  if (!calibrationUsable(v)) return { label: 'Needs retry', tone: 'bad', advice: 'The check did not establish reliable tracking. Eye selections stay off until a new calibration passes.' } as const
  const e = v.meanErrorPx
  if (e < 45)
    return {
      label: "Good",
      tone: "ok",
      advice: "The check was steadier. Try large keys first and look for a stable highlight before selecting.",
    } as const
  if (e < 85)
    return {
      label: "Fair",
      tone: "warn",
      advice: "Some position error remains. Use large keys, keep your head in place and check the highlighted key before selecting.",
    } as const
  return {
    label: "Low",
    tone: "bad",
    advice:
      "Try recalibrating with brighter, even lighting and your head kept still.",
  } as const
}

const Kbd = ({ children }: { children: string }) => (
  <kbd className="rounded border border-line bg-surface px-1.5 font-sans text-xs">
    {children}
  </kbd>
)

export function CalibrationPage() {
  const s = useGazeState()
  const { updateSettings, settings, notify } = useApp()
  const [phase, setPhase] = useState<Phase>("intro")
  const [index, setIndex] = useState(0)
  const [checkPoints, setCheckPoints] = useState(VALIDATION)
  const [refined, setRefined] = useState(false)
  const [progress, setProgress] = useState(0)
  const [attention, setAttention] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [autoCancelled, setAutoCancelled] = useState(false)
  const [restartIn, setRestartIn] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)

  const simulated = s.mode === "simulation"
  const ready = s.engine === "running" && (simulated || s.mode === "webcam")
  const faceReady = simulated || attentionReady(s.face)

  const run = useCallback(async () => {
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setCountdown(null)
    setRestartIn(null)
    const sim = gazeService.getState().mode === "simulation"
    // Every run starts from a clean model, so data from different head positions never mixes.
    gazeService.resetCalibration()
    setPhase("running")
    setAttention(true)
    const onProgress = (p: number, ok: boolean) => {
      setProgress(p)
      setAttention(ok)
    }
    try {
      let samples = 0
      let usedRefinement = false
      setRefined(false)
      const visibleTarget = async (fallback: {x:number;y:number}) => {
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        const target = document.querySelector<HTMLElement>('.calibration-page [aria-current="step"]')
        if (!target) return fallback
        const rect = target.getBoundingClientRect()
        return {x:(rect.left + rect.width/2)/window.innerWidth, y:(rect.top + rect.height/2)/window.innerHeight}
      }
      const train = async (points: {x:number;y:number}[], base: number) => {
        for (let i = 0; i < points.length; i++) {
          setIndex(i)
          for (let attempt = 0; attempt < 2; attempt++) {
            setProgress(0)
            try {
              samples += await gazeService.calibrate(await visibleTarget(points[i]), {group:base+i, settleMs:1200,
                durationMs:2000, signal:ac.signal, onProgress})
              break
            } catch (error) {
              if (!(error instanceof CalibrationCaptureError) || attempt === 1) throw error
              notify('We need clearer eye frames at this dot. Keep looking while we retry it.', 'info')
            }
          }
        }
      }
      const check = async (points: {x:number;y:number}[]) => {
        setCheckPoints(points)
        gazeService.beginValidation()
        setPhase('validating')
        const errors: number[][] = []
        for (let i=0; i<points.length; i++) {
          setIndex(i); setProgress(0)
          errors.push(await gazeService.validate(await visibleTarget(points[i]), {group:200+i, settleMs:1400,
            durationMs:1600, signal:ac.signal, onProgress}))
        }
        return summarizeValidation(errors, gazeService.getValidationDetails())
      }
      await train(POINTS, 0)
      let validation: ValidationResult | null = null
      if (!sim) {
        if (!gazeService.fitCalibration()) { setPhase('failed'); return }
        validation = await check(VALIDATION)
        if (!calibrationUsable(validation)) {
          // These are explicit new training visits, followed by a fresh set of
          // check locations. Never present reused training errors as validation.
          usedRefinement = true
          setRefined(true)
          setPhase('refining')
          await train(VALIDATION, 100)
          if (!gazeService.fitCalibration()) { setPhase('failed'); return }
          validation = await check(FINAL_CHECK)
        }
      }
      gazeService.completeCalibration({
        points: POINTS.length + (usedRefinement ? VALIDATION.length : 0),
        samples,
        simulated: sim,
        validation,
        refined: usedRefinement,
      })
      setPhase("done")
    } catch (e) {
      if (e instanceof AttentionLostError) {
        if (abort.current === ac) setPhase("interrupted")
        return
      }
      if ((e as DOMException).name === "AbortError") return
      if (abort.current === ac) {
        setPhase("failed")
        notify("Calibration could not finish. Please try again.", "error")
      }
    }
  }, [notify])

  const stop = useCallback(() => {
    abort.current?.abort()
    setPhase("intro")
    setCountdown(null)
    setRestartIn(null)
    setAutoCancelled(true)
  }, [])

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    if (phase === 'done' && !s.calibration) { setPhase('intro'); setAutoCancelled(true) }
  }, [phase, s.calibration])
  useEffect(() => {
    if (phase !== 'running' && phase !== 'refining' && phase !== 'validating' && phase !== 'interrupted') return
    const onResize = () => { stop(); notify('The screen size changed. Restart calibration at this size.', 'info') }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [phase, stop, notify])

  // Auto-start once the user is in position, so no one needs to press a button.
  useEffect(() => {
    if (phase !== "intro") return
    if (ready && !autoCancelled && faceReady)
      setCountdown((c) => c ?? AUTO_START_S)
    else setCountdown(null)
  }, [phase, ready, autoCancelled, faceReady])
  useEffect(() => {
    if (phase !== "intro" || countdown === null) return
    if (countdown <= 0) {
      void run()
      return
    }
    const t = setTimeout(
      () => setCountdown((c) => (c === null ? null : c - 1)),
      1000,
    )
    return () => clearTimeout(t)
  }, [phase, countdown, run])

  // After an interruption, restart automatically once the user looks back at the screen.
  useEffect(() => {
    if (phase !== "interrupted") return
    setRestartIn((c) => (faceReady && ready ? (c ?? AUTO_RESTART_S) : null))
  }, [phase, faceReady, ready])
  useEffect(() => {
    if (phase !== "interrupted" || restartIn === null) return
    if (restartIn <= 0) {
      void run()
      return
    }
    const t = setTimeout(
      () => setRestartIn((c) => (c === null ? null : c - 1)),
      1000,
    )
    return () => clearTimeout(t)
  }, [phase, restartIn, run])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        (phase === "running" ||
          phase === "refining" ||
          phase === "validating" ||
          phase === "interrupted")
      )
        stop()
      if (
        e.key === " " &&
        ready &&
        (phase === "intro" || (phase === "interrupted" && faceReady))
      ) {
        e.preventDefault()
        void run()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [phase, ready, faceReady, run, stop])

  const validating = phase === "validating"
  const refining = phase === 'refining'
  const shownPoints = validating ? checkPoints : refining ? VALIDATION : POINTS
  const total = shownPoints.length
  const overall =
    phase === "running" || refining || phase === "interrupted"
      ? (index + progress) / total
      : validating
        ? (index + progress) / checkPoints.length
        : 0
  const active = phase === "running" || refining || validating || phase === "interrupted"
  const result = s.calibration
  const q = result?.validation ? quality(result.validation) : null
  const worst = result?.validation?.details?.slice().sort((a,b) => b.meanErrorPx - a.meanErrorPx)[0]
  const region = (point: {x:number;y:number}) => `${point.y < .45 ? 'upper' : point.y > .65 ? 'lower' : 'middle'} ${point.x < .45 ? 'left' : point.x > .55 ? 'right' : 'centre'}`

  return (
    <div className="calibration-page fixed inset-0 z-40 overflow-y-auto bg-canvas">
      {/* Slim header */}
      <header data-calibration-active={active} className="absolute inset-x-0 top-0 z-10 flex h-16 items-center gap-4 px-6">
        {active ? (
          <>
            <div className="hidden items-center gap-3 text-[15px] font-semibold text-ink sm:flex">
              <Crosshair aria-hidden className="size-5 text-brand" />
              {validating ? refined ? "Rechecking accuracy" : "Checking accuracy" : refining ? "Refining calibration" : "Calibrating"}
            </div>
            <div className="mx-auto flex min-w-0 flex-1 max-w-md items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-subtle"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(overall * 100)}
                aria-label="Calibration progress"
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-100"
                  style={{ width: `${overall * 100}%` }}
                />
              </div>
              <span className="w-16 text-right text-sm font-bold tabular-nums text-ink">
                {index + 1} of {total}
              </span>
            </div>
            <button
              type="button"
              className={cx(buttonClass("ghost", "sm"), "hidden sm:inline-flex")}
              onClick={() => void run()}
            >
              <RotateCcw className="size-4" /> Restart
            </button>
            <button
              type="button"
              className={buttonClass("ghost", "sm")}
              onClick={stop}
            >
              Stop <Kbd>Esc</Kbd>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={buttonClass("ghost")}
              onClick={() => navigate("workspace")}
            >
              <ArrowLeft className="size-4" /> Back to workspace
            </button>
            <div className="ml-auto flex items-center gap-3">
              <TrackingStatus />
            </div>
          </>
        )}
      </header>

      {(phase === "running" || refining || validating) && (
        <>
          <p
            data-calibration-instructions
            className="pointer-events-none absolute inset-x-0 top-16 text-center text-base font-medium text-ink-2"
            aria-live="polite"
          >
            {!attention ? (
              <span className="font-semibold text-warn">
                Look back at the screen to continue
              </span>
            ) : validating ? (
              "Keep looking at each dot — we’re measuring how accurate tracking is"
            ) : (
              refining ? "We’re adding detail where the first check was inaccurate. Keep looking at the dot." : "Look only at the small centre dot. Its ring waits until enough eye frames are captured."
            )}
          </p>
          <div className="absolute inset-0">
            {shownPoints.map((p, i) => i === index && (
              <CalibrationTarget
                key={`${phase}-${i}`}
                x={p.x}
                y={p.y}
                label={`Target ${i + 1} of ${total}`}
                state={i < index ? "done" : i === index ? "active" : "pending"}
                progress={i === index ? progress : 0}
                faceOk={attention}
              />
            ))}
          </div>
        </>
      )}

      {phase === "interrupted" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/45 p-6 backdrop-blur-sm hc:bg-black/85">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="look-title"
            aria-describedby="look-body"
            className="grid w-full max-w-4xl items-center gap-7 rounded-3xl border border-line bg-surface p-7 shadow-2xl md:grid-cols-2 lg:p-9"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-warn/10 text-warn">
                <Eye aria-hidden className="size-6" />
              </div>
              <h2
                id="look-title"
                className="mt-4 text-[28px] font-bold leading-tight tracking-tight text-ink"
              >
                Please look at the camera
              </h2>
              <p
                id="look-body"
                className="mt-2 text-base leading-relaxed text-ink-2"
              >
                We lost sight of your eyes, so calibration stopped. Face the
                screen with your face inside the oval — calibration will start
                again from the first dot by itself.
              </p>
              {s.camera === "error" ? (
                <p className="mt-5 rounded-xl bg-bad/10 p-3 text-[15px] text-ink">
                  The camera disconnected.{" "}
                  <button
                    type="button"
                    className="font-semibold text-brand underline"
                    onClick={() => navigate("setup")}
                  >
                    Reconnect camera
                  </button>
                </p>
              ) : (
                <FaceChecklist face={s.face} className="mt-5" />
              )}
              <p
                aria-live="assertive"
                className={cx(
                  "mt-5 rounded-xl px-4 py-3 text-base font-semibold",
                  restartIn !== null
                    ? "bg-ok/10 text-ok"
                    : "bg-subtle text-ink-2",
                )}
              >
                {restartIn !== null
                  ? `Great — restarting calibration in ${restartIn}…`
                  : "Waiting for you to look at the screen…"}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  className={buttonClass("primary", "lg")}
                  disabled={!faceReady || !ready}
                  onClick={() => void run()}
                >
                  <Play className="size-5" /> Restart now
                </button>
                <button
                  type="button"
                  className={buttonClass("ghost", "lg")}
                  onClick={stop}
                >
                  Stop calibration
                </button>
              </div>
            </div>
            <FacePreview className="aspect-[4/3] w-full" />
          </div>
        </div>
      )}

      {phase === "intro" && (
        <div className="flex min-h-full items-center justify-center px-6 pt-16 pb-6">
          <div
            className={cx(
              "grid w-full items-center gap-10",
              s.mode === "webcam" && ready
                ? "max-w-5xl lg:grid-cols-[1.1fr_1fr]"
                : "max-w-2xl",
            )}
          >
            <div
              className={cx(!(s.mode === "webcam" && ready) && "text-center")}
            >
              <div
                className={cx(
                  "flex size-16 items-center justify-center rounded-3xl bg-brand-soft text-brand",
                  !(s.mode === "webcam" && ready) && "mx-auto",
                )}
              >
                <Crosshair aria-hidden className="size-8" />
              </div>
              <p className="mt-6 text-sm font-semibold text-brand">
                Step 2 of 2
              </p>
              <h1 className="mt-1 text-[40px] font-bold leading-tight tracking-tight text-ink">
                Calibrate Your Eye Movement
              </h1>
              <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-2">
                Follow the targets with your eyes. This helps personalize the
                keyboard to your gaze.
              </p>

              <ul className="mt-7 grid max-w-xl gap-3 text-left sm:grid-cols-3">
                {[
                  "13 targets appear one at a time",
                  "Look at each until its ring fills",
                  "Keep your head still — move only your eyes",
                ].map((t, i) => (
                  <li
                    key={t}
                    className="rounded-2xl border border-line bg-surface p-4 text-[15px] font-medium leading-snug text-ink"
                  >
                    <span className="mb-2 block text-sm font-bold text-brand">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ul>

              {!ready ? (
                <div className="mt-8 max-w-xl rounded-2xl border border-warn/30 bg-warn/10 p-5 text-left">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <TriangleAlert aria-hidden className="size-5 text-warn" />
                    {s.engine === "loading"
                      ? "Eye tracking is still starting…"
                      : "Eye tracking isn’t running yet"}
                  </p>
                  <p className="mt-1 text-[15px] text-ink-2">
                    Connect your camera first, or try the calibration flow in
                    Demo Mode.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonClass("primary")}
                      onClick={() => navigate("setup")}
                    >
                      <Camera className="size-4" /> Set up camera
                    </button>
                    <button
                      type="button"
                      className={buttonClass("secondary")}
                      onClick={() =>
                        void gazeService.startTracking("simulation")
                      }
                    >
                      <MousePointer2 className="size-4" /> Use Demo Mode
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={cx(
                    "mt-8 flex flex-col gap-3",
                    simulated && "items-center",
                  )}
                >
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className={cx(
                        buttonClass("primary", "lg"),
                        "h-16 px-8 text-lg",
                      )}
                      onClick={() => void run()}
                    >
                      <Play className="size-5" />{" "}
                      {countdown !== null
                        ? `Starting in ${countdown}…`
                        : "Start calibration"}
                    </button>
                    {countdown !== null && (
                      <button
                        type="button"
                        className={cx(buttonClass("secondary", "lg"), "h-16")}
                        onClick={() => {
                          setAutoCancelled(true)
                          setCountdown(null)
                        }}
                      >
                        Wait
                      </button>
                    )}
                    {simulated && (
                      <button
                        type="button"
                        className={cx(buttonClass("ghost", "lg"), "h-16")}
                        onClick={() => {
                          gazeService.completeCalibration({
                            points: 0,
                            samples: 0,
                            simulated: true,
                            validation: null,
                          })
                          navigate("workspace")
                        }}
                      >
                        <SkipForward className="size-5" /> Skip (Demo Mode)
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-ink-2">
                    {!faceReady
                      ? "Calibration starts by itself as soon as we can see you looking at the screen."
                      : "Allow about 60 seconds. We’ll add a short refinement pass automatically if needed."}{" "}
                    Press <Kbd>Space</Kbd> to start, <Kbd>Esc</Kbd> to stop.
                  </p>
                </div>
              )}
            </div>

            {s.mode === "webcam" && ready && (
              <div className="rounded-3xl border border-line bg-surface p-5">
                <FacePreview className="aspect-[4/3] w-full" />
                <FaceChecklist face={s.face} className="mt-5 px-1" />
              </div>
            )}
          </div>
        </div>
      )}

      {phase === "failed" && (
        <div className="flex min-h-full items-center justify-center px-6 pb-8 pt-20">
          <div className="w-full max-w-xl text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-warn/10 text-warn">
              <TriangleAlert aria-hidden className="size-8" />
            </div>
            <h1 className="mt-6 text-[32px] font-bold leading-tight tracking-tight text-ink">
              We couldn’t capture enough eye data
            </h1>
            <p className="mt-3 text-lg text-ink-2">
              Your eyes weren’t clearly visible for long enough. Check the
              lighting, face the screen and try again.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <button
                type="button"
                className={buttonClass("primary", "lg")}
                onClick={() => void run()}
              >
                <RotateCcw className="size-5" /> Try again
              </button>
              <button
                type="button"
                className={buttonClass("secondary", "lg")}
                onClick={stop}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className="flex min-h-full items-center justify-center px-6 pb-8 pt-20">
          <div className="w-full max-w-2xl text-center">
            <div className={cx('mx-auto flex size-16 items-center justify-center rounded-full', s.calibrated ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn')}>
              {s.calibrated ? <CheckCircle2 aria-hidden className="size-9" /> : <TriangleAlert aria-hidden className="size-9" />}
            </div>
            <h1 className="mt-6 text-[40px] font-bold leading-tight tracking-tight text-ink">
              {s.calibrated ? "Calibration complete" : "Calibration needs improvement"}
            </h1>

            <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-line bg-surface p-6 text-left">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-2">
                Accuracy summary
              </h2>
              {result.simulated ? (
                <p className="mt-3 text-[15px] leading-relaxed text-ink">
                  <strong className="font-semibold">
                    Not measured in Demo Mode.
                  </strong>{" "}
                  The simulated cursor follows your mouse, so there’s no eye
                  data to validate.
                </p>
              ) : result.validation && q ? (
                <>
                  <div className="mt-4 flex flex-wrap items-end gap-4">
                    <div>
                      <div className="text-4xl font-bold tabular-nums tracking-tight text-ink">
                        {Math.round(result.validation.meanErrorPx)} px
                      </div>
                      <div className="text-sm text-ink-2">
                        average distance from target
                      </div>
                    </div>
                    <span
                      className={cx(
                        "mb-1 rounded-full px-3 py-1 text-sm font-bold",
                        q.tone === "ok" && "bg-ok/10 text-ok",
                        q.tone === "warn" && "bg-warn/10 text-warn",
                        q.tone === "bad" && "bg-bad/10 text-bad",
                      )}
                    >
                      {q.label}
                    </span>
                  </div>
                  {worst && <p className="mt-3 text-sm text-ink-2">Largest error: {region(worst)} ({Math.round(worst.meanErrorPx)} px). {Math.hypot(worst.biasX, worst.biasY) > worst.spreadPx * 2 ? 'Estimates were consistently displaced at that target.' : 'Estimates varied while looking at that target.'}</p>}
                  {result.refined && <p className="mt-3 text-sm text-ink-2">One targeted refinement was completed before this fresh accuracy check.</p>}
                  {result.validation.p90ErrorPx !== undefined && <p className="mt-3 text-sm text-ink-2">Median error: {Math.round(result.validation.medianErrorPx)} px · 90% of check estimates within {Math.round(result.validation.p90ErrorPx)} px.</p>}
                  <p className="mt-3 text-[15px] text-ink">{q.advice}</p>
                  <p className="mt-1 text-sm text-ink-2">
                    Measured on {result.validation.targets} check targets from{" "}
                    {result.validation.validSamples} distinct camera frames. These check targets were not used to train the model.
                  </p>
                  {q.tone !== "ok" && settings.keySize !== "large" && (
                    <button
                      type="button"
                      className={cx(buttonClass("secondary", "sm"), "mt-4")}
                      onClick={() => {
                        updateSettings({
                          keySize: "large",
                          keySpacing: "spacious",
                        })
                        notify("Switched to large, spaciously spaced keys")
                      }}
                    >
                      <Keyboard className="size-4" /> Use large keys
                    </button>
                  )}
                </>
              ) : (
                <p className="mt-3 text-[15px] leading-relaxed text-ink">
                  <strong className="font-semibold">
                    We couldn’t measure accuracy
                  </strong>{" "}
                  because there weren’t enough gaze estimates during the check.
                  Gaze selections stay off. You can type by clicking, or recalibrate.
                </p>
              )}
            </div>

            {!s.calibrated && <p role="alert" className="mt-5 rounded-2xl bg-warn/10 p-4 text-ink">Eye selections are off because the final check was incomplete or too far from the targets. A refinement was already attempted; this can also reflect limits of the camera or model. Clicking and physical typing still work.</p>}
            <p className="mx-auto mt-6 max-w-xl text-[15px] text-ink-2">
              Your calibration is personal to your setup. You can recalibrate
              whenever you need.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <GazeButton
                gazeId="calibration-start-typing"
                variant="primary"
                size="xl"
                icon={Keyboard}
                onActivate={() => navigate("workspace")}
                className="w-full sm:w-auto sm:min-w-64"
              >
                {s.calibrated ? "Start typing" : "Use clicks"}
              </GazeButton>
              <GazeButton
                gazeId="calibration-redo"
                variant="secondary"
                size="xl"
                icon={RotateCcw}
                onActivate={() => void run()}
              >
                Recalibrate
              </GazeButton>
            </div>
            {!result.simulated && !s.calibrated && <div className="mt-5">
              <button type="button" className={buttonClass('secondary')} onClick={() => {
                const report = {version:2, calibration:result, engine:gazeService.getDiagnostics(),
                  viewport:{width:window.innerWidth,height:window.innerHeight,pixelRatio:window.devicePixelRatio},
                  browser:navigator.userAgent}
                const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)], {type:'application/json'}))
                const link = document.createElement('a'); link.href=url; link.download='blinkbridge-tracking-report.json'
                document.body.appendChild(link); link.click(); link.remove()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}>Save tracking report</button>
              <p className="mt-2 text-sm text-ink-2">Saves error measurements and browser setup without camera images.</p>
            </div>}
            {!result.simulated && s.calibrated && (
              <p className="mt-3 text-sm text-ink-2">
                Tip: you can select these buttons with your eyes.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
