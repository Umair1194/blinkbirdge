import {
  BookOpen,
  Camera,
  ChevronDown,
  Crosshair,
  Keyboard,
  ShieldCheck,
  Volume2,
} from "lucide-react"
import type { ReactNode } from "react"
import { buttonClass } from "../components/ui"
import { navigate } from "../lib/router"
import { useApp } from "../state/AppStore"

const STEPS = [
  {
    icon: Camera,
    title: "Set up your camera",
    body: "Allow camera access, sit about an arm’s length from the screen, and check that your face fits inside the oval.",
    route: "setup" as const,
  },
  {
    icon: Crosshair,
    title: "Calibrate",
    body: "Look at thirteen dots in turn. A check measures accuracy, and a short refinement pass runs automatically if needed.",
    route: "calibrate" as const,
  },
  {
    icon: Keyboard,
    title: "Type with dwell",
    body: "Rest your gaze on a key. A ring fills around it; when it completes, the key is selected. Look away to cancel.",
    route: "workspace" as const,
  },
  {
    icon: Volume2,
    title: "Speak and save",
    body: "Look at Speak to read your message aloud. Save phrases you use often for one-look access.",
    route: "phrases" as const,
  },
]

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Keys are selected before I mean to",
    a: "Increase the dwell duration in Settings → Eye tracking (for example to 1000 or 1200 ms). Turning on more key spacing also helps.",
  },
  {
    q: "The cursor jumps around or drifts",
    a: "Recalibrate after changing position, improve lighting in front of you (not behind), and raise gaze smoothing to High in Settings. Larger keys tolerate drift better, and the app also corrects small drifts automatically from the keys you select.",
  },
  {
    q: "“Face not detected” keeps appearing",
    a: "Make sure your whole face is visible, avoid strong backlight, and remove reflective glare from glasses if possible. Selections pause automatically while your face isn’t visible.",
  },
  {
    q: "The camera won’t start",
    a: "Check the camera icon in your browser’s address bar and allow access. Close video-call apps that may be using the camera. Then choose Retry camera on the Camera setup page.",
  },
  {
    q: "How do I rest without typing by accident?",
    a: "Look at Pause tracking in the top bar. While paused, nothing is selected. With “Resume by looking”, look at Resume to continue.",
  },
  {
    q: "How do I click and delete with my eyes?",
    a: "Look at a key and keep looking until the ring around it fills — that is a click. Delete (backspace) is a key too: look at Delete at the end of the third row and hold. Optionally, turn on blink to select in Settings to click by closing your eyes for about half a second.",
  },
  {
    q: "I wear glasses — will it work?",
    a: "Yes. Tracking follows the iris inside each eye, which works through most glasses. Calibrate while wearing the glasses you’ll type in. If the camera page warns about reflections, tilt your glasses slightly down, dim lights that shine into them (or onto the screen behind you), and keep the lenses clean. Very strong glare can still hide your eyes; larger keys and higher smoothing help.",
  },
  {
    q: "What is Demo Mode?",
    a: "Demo Mode replaces eye tracking with your mouse pointer so you can try every feature without a camera. It is clearly labelled and is not eye tracking.",
  },
]

const SHORTCUTS = [
  ["Alt + P", "Pause or resume tracking"],
  [
    "Letters, Space, Backspace, Enter",
    "Type on the workspace with a physical keyboard",
  ],
  ["Space", "Start calibration"],
  ["Esc", "Stop calibration or close a dialog"],
]

export function HelpPage() {
  const { openGuide } = useApp()
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 lg:px-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-bold tracking-tight text-ink">
            Getting started
          </h2>
          <p className="mt-1 text-lg text-ink-2">
            Four steps from first setup to speaking your first message.
          </p>
        </div>
        <button
          type="button"
          className={buttonClass("primary", "lg")}
          onClick={openGuide}
        >
          <BookOpen className="size-5" /> Open the quick guide
        </button>
      </div>
      <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, body, route }, i) => (
          <li
            key={title}
            className="flex flex-col rounded-3xl border border-line bg-surface p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <Icon aria-hidden className="size-5" />
              </div>
              <span className="text-sm font-bold text-ink-2">Step {i + 1}</span>
            </div>
            <h3 className="mt-5 text-lg font-bold tracking-tight text-ink">
              {title}
            </h3>
            <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-2">
              {body}
            </p>
            <button
              type="button"
              className={`${buttonClass("secondary", "sm")} mt-5 self-start`}
              onClick={() => navigate(route)}
            >
              Open
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="faq-title" className="min-w-0">
          <h2
            id="faq-title"
            className="text-xl font-bold tracking-tight text-ink"
          >
            Troubleshooting
          </h2>
          <div className="mt-4 divide-y divide-line rounded-3xl border border-line bg-surface">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-6 py-1">
                <summary className="flex min-h-14 py-3 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-ink">
                  {q}
                  <ChevronDown
                    aria-hidden
                    className="size-5 shrink-0 text-ink-2 transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="pb-5 text-[15px] leading-relaxed text-ink-2">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <section
            aria-labelledby="shortcuts-title"
            className="rounded-3xl border border-line bg-surface p-6"
          >
            <h2
              id="shortcuts-title"
              className="text-xl font-bold tracking-tight text-ink"
            >
              Shortcuts for helpers
            </h2>
            <dl className="mt-4 space-y-3">
              {SHORTCUTS.map(([k, d]) => (
                <div
                  key={k}
                  className="flex flex-wrap items-start justify-between gap-4"
                >
                  <dt>
                    <kbd className="rounded-lg border border-line bg-subtle px-2 py-1 font-sans text-sm font-semibold text-ink">
                      {k}
                    </kbd>
                  </dt>
                  <dd className="text-right text-[15px] text-ink-2">{d}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section
            aria-labelledby="privacy-title"
            className="rounded-3xl border border-line bg-surface p-6"
          >
            <h2
              id="privacy-title"
              className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink"
            >
              <ShieldCheck aria-hidden className="size-5 text-brand" /> Privacy
              & limitations
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-2">
              <li>
                Video is processed in your browser and is never recorded or
                uploaded.
              </li>
              <li>Messages are only stored when you save them.</li>
              <li>
                Webcam gaze estimation is less precise than dedicated
                eye-tracking hardware, and accuracy varies with lighting,
                glasses and head movement.
              </li>
              <li>
                Gesture Playground is a prototype and not a medical device.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
