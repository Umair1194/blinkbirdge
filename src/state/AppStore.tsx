import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { gazeService } from "../engine/gazeService"
import { useSpeech, type SpeechApi } from "../hooks/useSpeech"
import { correctLastWord } from "../lib/autocorrect"
import { applyCase, isSentenceStart, nextIsUpper } from "../lib/composer"
import { clearLearnedWords, currentPartial, learnWords } from "../lib/predict"
import {
  DEFAULT_SETTINGS,
  sanitizeSettings,
  type Settings,
} from "../lib/settings"
import { load, save } from "../lib/storage"

export interface Phrase {
  id: string
  text: string
  createdAt: number
}
export interface HistoryEntry {
  id: string
  text: string
  createdAt: number
  source: "saved" | "spoken"
}
export interface Toast {
  id: number
  message: string
  tone: "success" | "info" | "warning" | "error"
  action?: { label: string; run: () => void }
}
export interface SessionStats {
  startedAt: number
  selections: number
  characters: number
  words: number
  suggestionsUsed: number
  keystrokesSaved: number
}

const uid = () => Math.random().toString(36).slice(2, 10)

const SAMPLE_PHRASES: Phrase[] = [
  "Hello, how are you?",
  "I need some assistance.",
  "Please give me a moment.",
  "I would like some water.",
  "I am feeling comfortable.",
].map((text, i) => ({
  id: `sample-${i}`,
  text,
  createdAt: Date.now() - (5 - i) * 60000,
}))

const newStats = (): SessionStats => ({
  startedAt: Date.now(),
  selections: 0,
  characters: 0,
  words: 0,
  suggestionsUsed: 0,
  keystrokesSaved: 0,
})

function loadMessages<T extends Phrase>(key: string, fallback: T[]): T[] {
  const raw = load<unknown>(key, fallback)
  if (!Array.isArray(raw)) return fallback
  return raw
    .filter(
      (item): item is T =>
        !!item &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        !!item.text.trim() &&
        typeof item.createdAt === "number" &&
        Number.isFinite(item.createdAt) &&
        Math.abs(item.createdAt) <= 8640000000000000 &&
        (key !== "history" ||
          item.source === "saved" ||
          item.source === "spoken"),
    )
    .slice(0, 200)
}

function useStore() {
  // ---- Persistent data -----------------------------------------------------
  const [settings, setSettings] = useState<Settings>(() =>
    (() => {
      const raw = load<Record<string, unknown>>('settings', {})
      const next = sanitizeSettings(raw)
      if (load('steadyTrackingVersion', 0) < 2) {
        next.smoothing = 'high'
        if (next.dwellMs < 1200) next.dwellMs = 1200
        next.adaptiveLearning = false
        if (next.keySize === 'medium') next.keySize = 'large'
      }
      return next
    })(),
  )
  const [phrases, setPhrases] = useState<Phrase[]>(() =>
    loadMessages<Phrase>("phrases", SAMPLE_PHRASES),
  )
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    loadMessages<HistoryEntry>("history", []),
  )
  const [onboarded, setOnboarded] = useState<boolean>(
    () => load<unknown>("onboarded", false) === true,
  )
  const [guideSeen, setGuideSeen] = useState<boolean>(
    () => load<unknown>("guideSeen", false) === true,
  )
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => { save("settings", settings); save("steadyTrackingVersion", 2) }, [settings])
  useEffect(() => save("phrases", phrases), [phrases])
  useEffect(() => save("history", history), [history])
  useEffect(() => save("onboarded", onboarded), [onboarded])
  useEffect(() => save("guideSeen", guideSeen), [guideSeen])
  const openGuide = useCallback(() => setGuideOpen(true), [])
  const closeGuide = useCallback(() => {
    setGuideOpen(false)
    setGuideSeen(true)
  }, [])
  useEffect(() => phrases.forEach((p) => learnWords(p.text)), [phrases])

  const updateSettings = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((s) => sanitizeSettings({ ...s, ...patch })),
    [],
  )

  // ---- Toasts ----------------------------------------------------------------
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const dismissToast = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  )
  const notify = useCallback(
    (
      message: string,
      tone: Toast["tone"] = "success",
      action?: Toast["action"],
    ) => {
      const id = ++toastId.current
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }])
      setTimeout(() => dismissToast(id), action ? 6000 : 3200)
    },
    [dismissToast],
  )

  // ---- Composer (memory only: messages are never stored automatically) -----
  const [text, setTextState] = useState("")
  const [shift, setShift] = useState(false)
  const [stats, setStats] = useState<SessionStats>(newStats)
  const undoStack = useRef<string[]>([])
  const textRef = useRef(text)
  textRef.current = text
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const commit = useCallback(
    (next: string, statPatch?: (s: SessionStats) => Partial<SessionStats>) => {
      if (next === textRef.current) return
      undoStack.current = [...undoStack.current.slice(-99), textRef.current]
      textRef.current = next
      setTextState(next)
      setStats((s) => ({
        ...s,
        selections: s.selections + 1,
        ...statPatch?.(s),
      }))
    },
    [],
  )

  /** Runs autocorrect on the word just finished, before a boundary is typed. */
  const finishWord = useCallback(
    (t: string) => {
      const partial = currentPartial(t)
      if (!partial) return t
      learnWords(partial)
      if (!settingsRef.current.autocorrect) return t
      const fix = correctLastWord(t)
      if (!fix) return t
      notify(`Corrected “${fix.from}” to “${fix.to}”`, "info")
      return fix.text
    },
    [notify],
  )

  const composer = useMemo(
    () => ({
      typeChar(c: string) {
        const t = textRef.current
        const isLetter = /[a-z]/i.test(c)
        if (isLetter) {
          const upper = nextIsUpper(t, settingsRef.current.letterCase, shift)
          commit(t + (upper ? c.toUpperCase() : c.toLowerCase()), (s) => ({
            characters: s.characters + 1,
          }))
          if (shift) setShift(false)
          return
        }
        const isPunct = /[.,!?;:]/.test(c)
        const base = isPunct ? finishWord(t).replace(/ $/, "") : t
        const isWordEnd = isPunct && /[A-Za-z']$/.test(base)
        // Smart punctuation: after a word, add the following space automatically.
        commit(base + c + (isWordEnd ? " " : ""), (s) => ({
          characters: s.characters + 1,
          words: s.words + (currentPartial(t) ? 1 : 0),
        }))
      },
      space() {
        const t = textRef.current
        const ended = currentPartial(t) !== ""
        commit(finishWord(t) + " ", (s) => ({
          characters: s.characters + 1,
          words: s.words + (ended ? 1 : 0),
        }))
      },
      enter() {
        const t = textRef.current
        commit(finishWord(t) + "\n", (s) => ({ characters: s.characters + 1 }))
      },
      backspace() {
        commit(textRef.current.slice(0, -1))
      },
      clear() {
        if (!textRef.current) return
        commit("")
        notify("Message cleared", "info", {
          label: "Undo",
          run: () => composer.undo(),
        })
      },
      undo() {
        const prev = undoStack.current.pop()
        if (prev === undefined) return
        textRef.current = prev
        setTextState(prev)
      },
      canUndo: () => undoStack.current.length > 0,
      toggleShift() {
        setShift((v) => !v)
        setStats((s) => ({ ...s, selections: s.selections + 1 }))
      },
      applySuggestion(word: string) {
        const t = textRef.current
        const partial = currentPartial(t)
        const base = t.slice(0, t.length - partial.length)
        const needsSpace = base !== "" && !/[\s(]$/.test(base)
        const prefix = needsSpace && !partial ? base + " " : base
        const upperFirst = partial
          ? partial[0] === partial[0].toUpperCase()
          : isSentenceStart(prefix)
        const cased = applyCase(
          word.toLowerCase(),
          upperFirst,
          settingsRef.current.letterCase,
        )
        learnWords(cased)
        commit(prefix + cased + " ", (s) => ({
          suggestionsUsed: s.suggestionsUsed + 1,
          words: s.words + 1,
          characters: s.characters + cased.length - partial.length + 1,
          keystrokesSaved:
            s.keystrokesSaved +
            Math.max(0, cased.length + 1 - partial.length - 1),
        }))
        setShift(false)
      },
      insertText(phrase: string) {
        const t = textRef.current
        const sep = t && !/\s$/.test(t) ? " " : ""
        commit(t + sep + phrase)
      },
    }),
    [commit, finishWord, notify, shift],
  )

  // ---- Speech ----------------------------------------------------------------
  const speech: SpeechApi = useSpeech(settings.voiceURI, settings.speechRate)

  useEffect(() => {
    if (!settings.speechEnabled) speech.stop()
  }, [settings.speechEnabled, speech.stop])
  useEffect(() => {
    if (speech.error) notify(speech.error, "error")
  }, [speech.error, notify])

  const addHistory = useCallback(
    (t: string, source: HistoryEntry["source"]) => {
      if (!t.trim()) return
      setHistory((h) =>
        [
          { id: uid(), text: t.trim(), createdAt: Date.now(), source },
          ...h,
        ].slice(0, 200),
      )
    },
    [],
  )

  const speakText = useCallback(
    (t: string) => {
      if (!settingsRef.current.speechEnabled) {
        notify("Text-to-speech is turned off in Settings", "warning")
        return
      }
      if (!speech.supported) {
        notify("Speech isn’t supported in this browser", "error")
        return
      }
      if (
        speech.speak(t) &&
        settingsRef.current.keepHistory
      )
        addHistory(t, "spoken")
    },
    [speech, notify, addHistory],
  )

  return {
    settings,
    updateSettings,
    resetSettings: () => setSettings(DEFAULT_SETTINGS),
    phrases,
    addPhrase: (t: string) =>
      setPhrases((p) => [
        { id: uid(), text: t.trim(), createdAt: Date.now() },
        ...p,
      ]),
    updatePhrase: (id: string, t: string) =>
      setPhrases((p) =>
        p.map((x) => (x.id === id ? { ...x, text: t.trim() } : x)),
      ),
    removePhrase: (id: string) =>
      setPhrases((p) => p.filter((x) => x.id !== id)),
    history,
    addHistory,
    removeHistory: (id: string) =>
      setHistory((h) => h.filter((x) => x.id !== id)),
    clearHistory: () => setHistory([]),
    onboarded,
    setOnboarded,
    guideSeen,
    guideOpen,
    openGuide,
    closeGuide,
    toasts,
    notify,
    dismissToast,
    text,
    shift,
    composer,
    stats,
    resetStats: () => setStats(newStats()),
    speech,
    speakText,
    resetAllLocal: () => {
      speech.stop()
      clearLearnedWords()
      gazeService.stopTracking()
      textRef.current = ""
      setTextState("")
      undoStack.current = []
      setShift(false)
      setStats(newStats())
      setGuideOpen(false)
      setSettings(DEFAULT_SETTINGS)
      setPhrases(SAMPLE_PHRASES)
      setHistory([])
      setOnboarded(false)
      setGuideSeen(false)
    },
  }
}

export type AppStore = ReturnType<typeof useStore>
const Ctx = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const store = useStore()
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useApp must be used inside AppStoreProvider")
  return v
}
