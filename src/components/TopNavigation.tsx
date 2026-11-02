import { BookOpen, Crosshair, Pause, Play, Settings2 } from "lucide-react"
import { useEffect, useRef } from "react"
import { gazeService } from "../engine/gazeService"
import { useGazeState } from "../hooks/useGaze"
import { navigate } from "../lib/router"
import { useApp } from "../state/AppStore"
import { GazeButton } from "./GazeButton"
import { TrackingStatus } from "./TrackingStatus"
import { buttonClass, cx } from "./ui"

export function togglePause(keepGaze: boolean) {
  const s = gazeService.getState()
  if (s.paused) gazeService.resumeTracking()
  else gazeService.pauseTracking(keepGaze)
}

export function TopNavigation({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  const s = useGazeState()
  const { settings, openGuide } = useApp()
  const hasEngine = s.engine === "running"
  const ref = useRef<HTMLElement>(null)
  // Publish the header's real height so full-height pages (the workspace) fit exactly.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () =>
      document.documentElement.style.setProperty(
        "--app-header-h",
        `${el.offsetHeight}px`,
      )
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <header
      ref={ref}
      className="app-header sticky top-0 z-30 flex flex-wrap min-h-[76px] items-center gap-3 border-b border-line bg-canvas/90 px-5 py-3 backdrop-blur xl:gap-4 lg:px-8"
    >
      <div className="mr-auto min-w-0 max-w-full flex-[1_0_16rem]">
        <h1 className="truncate text-[22px] font-bold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-sm text-ink-2 [@media(max-height:700px)]:hidden">
            {subtitle}
          </p>
        )}
      </div>
      <TrackingStatus />
      <button
        type="button"
        className={buttonClass("ghost")}
        onClick={openGuide}
        aria-label="Quick guide"
        title="Quick guide"
      >
        <BookOpen className="size-4" />{" "}
        <span className="hidden xl:inline">Guide</span>
      </button>
      <button
        type="button"
        className={buttonClass("secondary")}
        onClick={() => navigate("calibrate")}
        aria-label="Calibrate"
        title="Calibrate"
      >
        <Crosshair className="size-4" />{" "}
        <span className="hidden lg:inline">Calibrate</span>
      </button>
      <GazeButton
        gazeId="header-pause"
        size="md"
        variant={s.paused ? "primary" : "secondary"}
        icon={s.paused ? Play : Pause}
        onActivate={() => togglePause(settings.pauseBehavior === "gaze")}
        disabled={!hasEngine}
        allowWhenPaused
        dwellScale={1.5}
        aria-keyshortcuts="Alt+P"
        className="!h-11 shrink-0 !rounded-xl"
        aria-label={s.paused ? "Resume tracking" : "Pause tracking"}
      >
        {s.paused ? (
          "Resume"
        ) : (
          <>
            <span className="xl:hidden">Pause</span>
            <span className="hidden xl:inline">Pause tracking</span>
          </>
        )}
      </GazeButton>
      <button
        type="button"
        className={cx(buttonClass("ghost"), "shrink-0")}
        onClick={() => navigate("settings")}
        aria-label="Accessibility settings"
        title="Settings"
      >
        <Settings2 className="size-5" />
      </button>
    </header>
  )
}
