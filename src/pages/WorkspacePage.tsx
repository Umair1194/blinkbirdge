import {
  AlertTriangle,
  Camera,
  Crosshair,
  Eraser,
  MousePointer2,
  Undo2,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { GazeButton } from "../components/GazeButton"
import { MessageComposer } from "../components/MessageComposer"
import { PauseBanner } from "../components/PauseBanner"
import { SpeechControls } from "../components/SpeechControls"
import {
  VirtualKeyboard,
  keyboardMinHeight,
} from "../components/VirtualKeyboard"
import { WordSuggestionBar } from "../components/WordSuggestion"
import { Modal, buttonClass, cx } from "../components/ui"
import { gazeService } from "../engine/gazeService"
import { useGazeState, useTrackingStatus } from "../hooks/useGaze"
import { buildLayout, type KeyDef } from '../lib/keyboardLayouts'
import { dwell } from '../lib/dwell'
import { nextIsUpper } from "../lib/composer"
import { suggest } from "../lib/predict"
import { navigate } from "../lib/router"
import { useApp } from "../state/AppStore"

function Notice({
  tone,
  icon: Icon,
  title,
  body,
  children,
}: {
  tone: "warn" | "info" | "bad"
  icon: typeof Camera
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <div
      role="status"
      className={cx(
        "flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl border px-5 py-3.5",
        tone === "warn" && "border-warn/30 bg-warn/10",
        tone === "info" && "border-info/25 bg-info/5",
        tone === "bad" && "border-bad/30 bg-bad/10",
      )}
    >
      <Icon
        aria-hidden
        className={cx(
          "size-6 shrink-0",
          tone === "warn" && "text-warn",
          tone === "info" && "text-info",
          tone === "bad" && "text-bad",
        )}
      />
      <div className="mr-auto min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-2 [@media(max-height:760px)]:hidden">
          {body}
        </p>
      </div>
      {children && (
        <div className="flex min-w-0 max-w-full flex-wrap gap-2">
          {children}
        </div>
      )}
    </div>
  )
}

function SessionStats() {
  const { stats } = useApp()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [])
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - stats.startedAt) / 60000),
  )
  return (
    <span className="text-sm text-ink-2" aria-label="Session statistics">
      Session:{" "}
      <strong className="font-semibold tabular-nums text-ink">
        {stats.selections}
      </strong>{" "}
      selections ·{" "}
      <strong className="font-semibold tabular-nums text-ink">
        {stats.keystrokesSaved}
      </strong>{" "}
      saved by suggestions ·{" "}
      <strong className="font-semibold tabular-nums text-ink">
        {minutes < 1 ? "<1" : minutes}
      </strong>{" "}
      min
    </span>
  )
}

export function WorkspacePage() {
  const app = useApp()
  const { settings, text, shift, composer, notify, guideSeen, openGuide } = app
  const s = useGazeState()
  const status = useTrackingStatus()
  const [confirmClear, setConfirmClear] = useState(false)
  const [precision, setPrecision] = useState<{keys:KeyDef[];source:string;page?:number} | null>(null)
  const [precisionArmed, setPrecisionArmed] = useState(false)
  useEffect(() => {
    dwell.reset()
    setPrecisionArmed(false)
    if (!precision) return
    const anchor = gazeService.getGazeCoordinates()
    if (!anchor) return
    let outsideSince: number | null = null
    const timer = setInterval(() => {
      const point = gazeService.getGazeCoordinates()
      const moved = point && Math.hypot((point.x-anchor.x)*window.innerWidth,(point.y-anchor.y)*window.innerHeight)>45
      if (!moved) { outsideSince=null; return }
      outsideSince ??= performance.now()
      if (performance.now()-outsideSince>=180) { setPrecisionArmed(true); clearInterval(timer) }
    },50)
    return () => clearInterval(timer)
  }, [precision !== null])
  const previewLetter = useCallback((def:KeyDef) => {
    if (def.action.type !== 'char') return
    if (!settings.precisionMode || s.mode !== 'webcam') { composer.typeChar(def.action.value); return }
    const selected = document.querySelector<HTMLElement>(`[data-gaze-id="ws-${CSS.escape(def.id)}"]`)
    if (!selected) return
    const rect=selected.getBoundingClientRect(), x=rect.left+rect.width/2, y=rect.top+rect.height/2
    const nearby=buildLayout('letters',settings.layout).flat().filter(key=>key.action.type==='char' && /[a-z]/i.test(key.action.value)).map(key=>{
      const node=document.querySelector<HTMLElement>(`[data-gaze-id="ws-${CSS.escape(key.id)}"]`)
      const r=node?.getBoundingClientRect()
      return {key,x:r?r.left+r.width/2:Infinity,y:r?r.top+r.height/2:Infinity,d:r?Math.hypot(r.left+r.width/2-x,r.top+r.height/2-y):Infinity}
    }).sort((a,b)=>a.d-b.d).slice(0,9).sort((a,b)=>Math.abs(a.y-b.y)>5?a.y-b.y:a.x-b.x).map(item=>item.key)
    setPrecision({keys:nearby,source:def.id})
  },[settings.precisionMode,settings.layout,s.mode,composer])
  const [keyExtent, setKeyExtent] = useState<number | null>(null)
  useEffect(() => {
    const key = document.querySelector<HTMLElement>('[data-gaze-id="ws-k-q"], [data-gaze-id="ws-k-a"]')
    if (!key) return
    const measure = () => { const rect = key.getBoundingClientRect(); setKeyExtent(Math.min(rect.width, rect.height)) }
    const observer = new ResizeObserver(measure)
    observer.observe(key)
    measure()
    return () => observer.disconnect()
  }, [settings.layout, settings.keySize, settings.keySpacing, settings.uiScale])

  // Show the quick guide the first time someone can actually type with gaze.
  useEffect(() => {
    if (
      !guideSeen &&
      (s.mode === "simulation" || (s.mode === "webcam" && s.calibrated))
    )
      openGuide()
  }, [guideSeen, s.mode, s.calibrated, openGuide])

  const suggestions = useMemo(
    () => (settings.suggestions ? suggest(text) : []),
    [settings.suggestions, text],
  )
  const upperNext = nextIsUpper(text, settings.letterCase, shift)

  const requestClear = useCallback(() => {
    if (text) setConfirmClear(true)
  }, [text])
  const onChar = useCallback((c: string) => composer.typeChar(c), [composer])
  const onShift = useCallback(() => composer.toggleShift(), [composer])
  const onBackspace = useCallback(() => composer.backspace(), [composer])
  const onSpace = useCallback(() => composer.space(), [composer])
  const onEnter = useCallback(() => composer.enter(), [composer])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      notify("Message copied")
    } catch {
      notify("Copying isn’t allowed in this browser window", "error")
    }
  }

  // Physical keyboard input, for helpers and testing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (
        e.isComposing ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        confirmClear ||
        app.guideOpen
      )
        return
      if (document.querySelector('[aria-modal="true"]') || el.closest('input, textarea, select, [contenteditable="true"]'))
        return
      if (/^[a-zA-Z0-9.,?!'"\-/:;()&@+=%*]$/.test(e.key)) {
        e.preventDefault()
        composer.typeChar(e.key)
      } else if (e.key === "Backspace") {
        e.preventDefault()
        composer.backspace()
      } else if (
        e.key === "Enter" &&
        el.tagName !== "BUTTON" &&
        el.tagName !== "A"
      ) {
        e.preventDefault()
        composer.enter()
      } else if (
        e.key === " " &&
        el.tagName !== "BUTTON" &&
        el.tagName !== "A"
      ) {
        e.preventDefault()
        composer.space()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [composer, confirmClear, app.guideOpen])

  const large = settings.keySize === "large"

  return (
    <div
      className="workspace mx-auto flex min-h-[520px] max-w-[1680px] flex-col gap-4 px-5 py-5 lg:px-7 [@media(max-height:760px)]:gap-2 [@media(max-height:760px)]:py-2"
      style={{ height: "calc(100dvh - var(--app-header-h, 77px))" }}
    >
      {s.mode === null && s.camera !== "error" && (
        <Notice
          tone="info"
          icon={Camera}
          title="Eye tracking is off"
          body="Set up your camera to type with your eyes, or explore with simulated gaze. You can also click keys directly."
        >
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
            onClick={() => void gazeService.startTracking("simulation")}
          >
            <MousePointer2 className="size-4" /> Start Demo Mode
          </button>
        </Notice>
      )}
      {s.camera === "error" && (
        <Notice
          tone="bad"
          icon={AlertTriangle}
          title={
            s.cameraError === "disconnected"
              ? "Camera disconnected"
              : "Camera unavailable"
          }
          body="Eye tracking stopped. Any pending selection was cancelled; your message is safe."
        >
          <button
            type="button"
            className={buttonClass("primary")}
            onClick={() => navigate("setup")}
          >
            Reconnect camera
          </button>
        </Notice>
      )}
      {status === "calibration-required" && (
        <Notice
          tone="warn"
          icon={Crosshair}
          title="Calibrate to start typing with your eyes"
          body="Detailed calibration and its accuracy check take about a minute and personalise tracking to your eyes and setup."
        >
          <button
            type="button"
            className={buttonClass("primary")}
            onClick={() => navigate("calibrate")}
          >
            <Crosshair className="size-4" /> Calibrate now
          </button>
        </Notice>
      )}
      {status === "tracking" && s.movedSinceCalibration && (
        <Notice
          tone="warn"
          icon={Crosshair}
          title="Tracking position needs checking"
          body="The face measurements differ from the final accuracy check. This can also be tracking noise. Hold still briefly; if the warning remains, check the camera view and recalibrate."
        >
          <button
            type="button"
            className={buttonClass("primary")}
            onClick={() => navigate("calibrate")}
          >
            <Crosshair className="size-4" /> Recalibrate
          </button>
        </Notice>
      )}
      {status === "face-not-detected" && (
        <Notice
          tone="warn"
          icon={AlertTriangle}
          title="Face not detected"
          body="Selections are paused until your face is visible to the camera again."
        />
      )}
      {status === 'tracking' && !s.movedSinceCalibration && keyExtent && (s.calibration?.validation?.meanErrorPx ?? 0) > keyExtent * .5 && (
        <Notice tone="warn" icon={Crosshair} title="Tracking uncertainty is larger than half a key" body={`Your accuracy check averaged ${Math.round(s.calibration!.validation!.meanErrorPx)} px of error. These keys are about ${Math.round(keyExtent)} px across their smaller side. Keep your head still and recalibrate before relying on individual-letter selection.`}>
          <button type="button" className={buttonClass('secondary')} onClick={() => navigate('calibrate')}>Improve calibration</button>
        </Notice>
      )}
      {s.mode === 'webcam' && settings.precisionMode && <p className="shrink-0 text-sm text-ink-2">Precision confirmation is on: look at a key, then choose the exact letter from the enlarged options.</p>}
      <PauseBanner />

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <MessageComposer
          text={text}
          sessionInfo={<SessionStats />}
          large={large}
          canUndo={composer.canUndo()}
          onUndo={composer.undo}
          onCopy={copy}
          onClear={requestClear}
          onSavePhrase={() => {
            app.addPhrase(text)
            notify("Added to Saved messages")
          }}
          onSaveHistory={() => {
            app.addHistory(text, "saved")
            notify("Saved to Typing history")
          }}
        />
        <div className="flex shrink-0 flex-col gap-4 lg:w-[300px] xl:w-[320px]">
          <SpeechControls text={text} />
        </div>
      </div>

      {settings.suggestions && (
        <div className="shrink-0">
          <WordSuggestionBar
            words={suggestions}
            onSelect={composer.applySuggestion}
          />
        </div>
      )}

      <div
        className="flex shrink flex-col"
        style={{ minHeight: keyboardMinHeight(settings.keySpacing) }}
      >
        <VirtualKeyboard
          scope="ws"
          settings={settings}
          shift={shift}
          upperNext={upperNext}
          dimmed={s.paused}
          onChar={onChar}
          onGazeChar={settings.precisionMode && s.mode === 'webcam' ? previewLetter : undefined}
          onShift={onShift}
          onBackspace={onBackspace}
          onSpace={onSpace}
          onEnter={onEnter}
          onClear={requestClear}
        />
      </div>

      <Modal wide open={!!precision} onClose={() => setPrecision(null)} title="Choose your letter" description="Move your eyes to the exact letter to type it. If no letter highlights, look at this heading first, then at your letter.">
        {precision?.page !== undefined && <p aria-live="polite" className="mb-3 text-sm font-semibold text-ink-2">Letters {precision.keys[0]?.label.toUpperCase()}–{precision.keys[precision.keys.length-1]?.label.toUpperCase()}</p>}
        <div className="grid grid-cols-3 gap-3">
          {precision?.keys.map(def=><GazeButton key={def.id} gazeId={`precision-${def.id}`} gazeDisabled={!precisionArmed} variant="secondary" size="xl" style={{height:'min(14dvh,144px)',minHeight:72,fontSize:'2rem'}} onActivate={()=>{
            if(def.action.type==='char')composer.typeChar(def.action.value)
            setPrecision(null)
          }}>{upperNext ? def.label.toUpperCase() : def.label.toLowerCase()}</GazeButton>)}
        </div>
        <GazeButton gazeId="precision-more" variant="secondary" size="lg" className="mt-4 w-full" onActivate={()=>setPrecision(current=>{
          if(!current)return null
          const page=((current.page??-1)+1)%3
          const all=buildLayout('letters',settings.layout).flat().filter(key=>key.action.type==='char'&&/^[a-z]$/i.test(key.action.value)).sort((a,b)=>a.label.localeCompare(b.label))
          return {...current,page,keys:all.slice(page*9,page*9+9)}
        })}>More letters</GazeButton>
        <GazeButton gazeId="precision-back" variant="secondary" size="lg" className="mt-4 w-full" onActivate={()=>setPrecision(null)}>Back to keyboard</GazeButton>
      </Modal>
      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear your message?"
        description="Your message will be removed. You can still bring it back with Undo."
      >
        <div className="grid grid-cols-2 gap-3">
          <GazeButton
            gazeId="confirm-clear-yes"
            variant="danger"
            size="xl"
            icon={Eraser}
            onActivate={() => {
              composer.clear()
              setConfirmClear(false)
            }}
          >
            Yes, clear
          </GazeButton>
          <GazeButton
            gazeId="confirm-clear-no"
            variant="primary"
            size="xl"
            icon={Undo2}
            onActivate={() => setConfirmClear(false)}
          >
            Keep message
          </GazeButton>
        </div>
      </Modal>
    </div>
  )
}
