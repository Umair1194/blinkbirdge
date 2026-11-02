import { useCallback, useEffect, useRef, useState } from "react"

export interface SpeechApi {
  supported: boolean
  voices: SpeechSynthesisVoice[]
  error: string | null
  speaking: boolean
  speak: (text: string) => boolean
  stop: () => void
}

export function useSpeech(voiceURI: string | null, rate: number): SpeechApi {
  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)

  const current = useRef<SpeechSynthesisUtterance | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    const onPageHide = () => {
      current.current = null
      window.speechSynthesis.cancel()
      setSpeaking(false)
    }
    window.addEventListener('pagehide', onPageHide)
    window.speechSynthesis.addEventListener("voiceschanged", load)
    const retry = setTimeout(load, 1000)
    return () => {
      clearTimeout(retry)
      window.removeEventListener('pagehide', onPageHide)
      current.current = null
      window.speechSynthesis.cancel()
      window.speechSynthesis.removeEventListener("voiceschanged", load)
    }
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return false
      const synth = window.speechSynthesis
      current.current = null
      synth.cancel()
      setError(null)
      const u = new SpeechSynthesisUtterance(text)
      current.current = u
      const voice = synth.getVoices().find((v) => v.voiceURI === voiceURI)
      if (voice) {
        u.voice = voice
        u.lang = voice.lang
      }
      u.rate = Number.isFinite(rate) ? Math.min(1.8, Math.max(0.5, rate)) : 1
      u.onstart = () => {
        if (current.current === u) setSpeaking(true)
      }
      u.onend = () => {
        if (current.current === u) {
          current.current = null
          setSpeaking(false)
        }
      }
      u.onerror = (event) => {
        if (current.current !== u) return
        current.current = null
        setSpeaking(false)
        if (event.error !== "canceled" && event.error !== "interrupted")
          setError(
            event.error === "not-allowed"
              ? "Your browser blocked audio. Click Speak directly to allow speech, then try again."
              : "Speech could not play. Try the system default voice and check your device audio.",
          )
      }
      try {
        synth.resume()
        synth.speak(u)
      } catch {
        current.current = null
        setSpeaking(false)
        setError(
          "Speech could not start. Try again or select the system default voice.",
        )
        return false
      }
      setSpeaking(true)
      return true
    },
    [supported, voices, voiceURI, rate],
  )

  const stop = useCallback(() => {
    if (!supported) return
    current.current = null
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  return { supported, voices, speaking, error, speak, stop }
}
