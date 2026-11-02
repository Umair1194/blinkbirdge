import type { SmoothingLevel } from "../engine/smoothing"
import type { SelectionMethod } from "./dwell"

export const DWELL_OPTIONS = [500, 700, 800, 1000, 1200, 1500] as const
export type DwellMs = typeof DWELL_OPTIONS[number]

export interface Settings {
  // Eye tracking
  /** How a look turns into a click: hold your gaze, blink deliberately, or either. */
  selectionMethod: SelectionMethod
  dwellMs: DwellMs
  showGazeCursor: boolean
  smoothing: SmoothingLevel
  targetAssist: boolean
  pauseBehavior: "gaze" | "manual"
  /** Confirmed selections refine the personal gaze model during use. */
  adaptiveLearning: boolean
  // Keyboard
  keySize: "small" | "medium" | "large"
  keySpacing: "compact" | "comfortable" | "spacious"
  layout: "qwerty" | "abc"
  letterCase: "sentence" | "lower" | "upper"
  highContrast: boolean
  precisionMode: boolean
  // Communication
  suggestions: boolean
  autocorrect: boolean
  speechEnabled: boolean
  voiceURI: string | null
  speechRate: number
  keepHistory: boolean
  // Comfort
  breakReminderMin: 0 | 15 | 20 | 30 | 45
  reducedMotion: boolean
  soundFeedback: boolean
  uiScale: 100 | 112 | 125 | 150
  font: "inter" | "atkinson"
}

export const DEFAULT_SETTINGS: Settings = {
  selectionMethod: "dwell",
  dwellMs: 1200,
  showGazeCursor: true,
  smoothing: "high",
  targetAssist: true,
  pauseBehavior: "gaze",
  adaptiveLearning: false,
  keySize: "large",
  keySpacing: "comfortable",
  layout: "qwerty",
  letterCase: "sentence",
  highContrast: false,
  precisionMode: true,
  suggestions: true,
  autocorrect: true,
  speechEnabled: true,
  voiceURI: null,
  speechRate: 1,
  keepHistory: false,
  breakReminderMin: 20,
  reducedMotion: false,
  soundFeedback: true,
  uiScale: 100,
  font: "inter",
}

/** Treat persisted preferences as untrusted input, including older app versions. */
export function sanitizeSettings(value: unknown): Settings {
  const result = { ...DEFAULT_SETTINGS }
  if (!value || typeof value !== "object" || Array.isArray(value)) return result
  const raw = value as Record<string, unknown>
  const choices: Record<string, readonly unknown[]> = {
    selectionMethod: ["dwell", "blink", "both"],
    dwellMs: DWELL_OPTIONS,
    smoothing: ["off", "low", "medium", "high"],
    pauseBehavior: ["gaze", "manual"],
    keySize: ["small", "medium", "large"],
    keySpacing: ["compact", "comfortable", "spacious"],
    layout: ["qwerty", "abc"],
    letterCase: ["sentence", "lower", "upper"],
    breakReminderMin: [0, 15, 20, 30, 45],
    uiScale: [100, 112, 125, 150],
    font: ["inter", "atkinson"],
  }
  for (const key of Object.keys(result) as Array<keyof Settings>) {
    const candidate = raw[key]
    const valid = choices[key]
      ? choices[key].includes(candidate)
      : key === "voiceURI"
        ? candidate === null || typeof candidate === "string"
        : key === "speechRate"
          ? typeof candidate === "number" &&
            Number.isFinite(candidate) &&
            candidate >= 0.5 &&
            candidate <= 1.8
          : typeof candidate === "boolean"
    if (valid) Object.assign(result, { [key]: candidate })
  }
  return result
}
