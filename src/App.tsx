import { useEffect, useRef, useState } from "react"
import { ApplicationSidebar } from "./components/ApplicationSidebar"
import { BreakReminder } from "./components/BreakReminder"
import { GazeCursor } from "./components/GazeCursor"
import { QuickGuide } from "./components/QuickGuide"
import { Toasts } from "./components/Toasts"
import { TopNavigation, togglePause } from "./components/TopNavigation"
import { gazeService } from "./engine/gazeService"
import { useGazeState } from "./hooks/useGaze"
import { dwell } from "./lib/dwell"
import { navigate, useRoute, type Route } from "./lib/router"
import { CalibrationPage } from "./pages/CalibrationPage"
import { CameraSetupPage } from "./pages/CameraSetupPage"
import { HelpPage } from "./pages/HelpPage"
import { HistoryPage } from "./pages/HistoryPage"
import { KeyboardPage } from "./pages/KeyboardPage"
import { SavedMessagesPage } from "./pages/SavedMessagesPage"
import { SettingsPage } from "./pages/SettingsPage"
import { WelcomePage } from "./pages/WelcomePage"
import { WorkspacePage } from "./pages/WorkspacePage"
import { AppStoreProvider, useApp } from "./state/AppStore"

const TITLES: Record<Exclude<Route, "welcome" | "calibrate">, [string, string]> =
  {
    workspace: ["Keyboard workspace", "Look at a key to select it"],
    setup: ["Camera setup", "Connect your camera for eye tracking"],
    phrases: ["Saved messages", "Phrases you can speak with one look"],
    history: ["Typing history", "Messages you chose to keep"],
    settings: ["Accessibility settings", "Every option applies immediately"],
    keyboard: ["Keyboard customization", "Size, spacing, layout and case"],
    help: ["Help & tutorials", "Guides, tips and troubleshooting"],
  }

/** Mirrors settings into the document, gaze engine and dwell controller. */
function useApplySettings() {
  const { settings } = useApp()
  useEffect(() => {
    const root = document.documentElement
    root.dataset.contrast = settings.highContrast ? "high" : "normal"
    root.dataset.font = settings.font
    root.dataset.reducedMotion = String(settings.reducedMotion)
    root.style.fontSize = `${settings.uiScale}%`
    root.style.colorScheme = settings.highContrast ? "dark" : "light"
  }, [
    settings.highContrast,
    settings.font,
    settings.reducedMotion,
    settings.uiScale,
  ])
  useEffect(
    () => gazeService.setSmoothing(settings.smoothing),
    [settings.smoothing],
  )
  useEffect(() => {
    dwell.config.dwellMs = settings.dwellMs
    dwell.config.targetAssist = settings.targetAssist
    dwell.config.sound = settings.soundFeedback
    dwell.config.method = settings.selectionMethod
    dwell.config.learn = settings.adaptiveLearning
  }, [
    settings.dwellMs,
    settings.targetAssist,
    settings.soundFeedback,
    settings.selectionMethod,
    settings.adaptiveLearning,
  ])
  useEffect(() => {
    dwell.start()
    return () => dwell.stop()
  }, [])
  // Focus tolerance follows real tracking accuracy: precise for the mouse, wider for webcams.
  const gaze = useGazeState()
  const measured = gaze.calibration?.validation?.meanErrorPx
  useEffect(() => {
    dwell.config.sigmaPx =
      gaze.mode === "simulation"
        ? 10
        : Math.min(24, Math.max(10, (measured ?? 40) * 0.25))
  }, [gaze.mode, measured])
}

/** Counts active (unpaused) tracking time and prompts for an eye break. */
function useBreakReminder() {
  const { settings } = useApp()
  const s = useGazeState()
  const [open, setOpen] = useState(false)
  const active = useRef(0)
  const running = s.engine === "running" && !s.paused
  useEffect(() => {
    if (!running || settings.breakReminderMin === 0) return
    const t = setInterval(() => {
      if (document.hidden) return
      active.current += 5
      if (active.current >= settings.breakReminderMin * 60) {
        active.current = 0
        setOpen(true)
      }
    }, 5000)
    return () => clearInterval(t)
  }, [running, settings.breakReminderMin])
  return {
    open,
    minutes: settings.breakReminderMin,
    rest: () => {
      setOpen(false)
      gazeService.pauseTracking(settings.pauseBehavior === "gaze")
    },
    dismiss: () => setOpen(false),
  }
}

function Shell() {
  const { onboarded, settings, guideOpen, closeGuide } = useApp()
  const route = useRoute(onboarded ? "workspace" : "welcome")
  const s = useGazeState()
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1280)
  const breakReminder = useBreakReminder()
  useApplySettings()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === "KeyP") {
        e.preventDefault()
        togglePause(settings.pauseBehavior === "gaze")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [settings.pauseBehavior])

  useEffect(() => {
    window.scrollTo({ top: 0 })
    dwell.reset()
  }, [route])

  useEffect(() => {
    const check = () => gazeService.checkViewport()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Release the camera when the tab closes.
  useEffect(() => {
    const stop = () => gazeService.stopTracking()
    window.addEventListener("pagehide", stop)
    return () => window.removeEventListener("pagehide", stop)
  }, [])

  const cursorVisible =
    settings.showGazeCursor && s.mode !== null && route !== "calibrate"

  let content
  if (route === "welcome") content = <WelcomePage />
  else if (route === "calibrate") content = <CalibrationPage />
  else {
    const [title, subtitle] = TITLES[route]
    content = (
      <div className="app-shell flex min-h-screen">
        <ApplicationSidebar
          route={route}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNavigation title={title} subtitle={subtitle} />
          <main id="main" tabIndex={-1} className="flex-1">
            {route === "workspace" && <WorkspacePage />}
            {route === "setup" && <CameraSetupPage />}
            {route === "phrases" && <SavedMessagesPage />}
            {route === "history" && <HistoryPage />}
            {route === "settings" && <SettingsPage />}
            {route === "keyboard" && <KeyboardPage />}
            {route === "help" && <HelpPage />}
          </main>
        </div>
      </div>
    )
  }

  return (
    <>
      {route !== 'welcome' && route !== 'calibrate' && <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-surface focus:p-4" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>}
      {content}
      <GazeCursor visible={cursorVisible} />
      <QuickGuide
        open={guideOpen && route !== "calibrate" && route !== "welcome"}
        onClose={closeGuide}
      />
      <BreakReminder
        open={breakReminder.open}
        minutes={breakReminder.minutes}
        onRest={breakReminder.rest}
        onContinue={breakReminder.dismiss}
      />
      <Toasts />
    </>
  )
}

export default function App() {
  return (
    <AppStoreProvider>
      <Shell />
    </AppStoreProvider>
  )
}
