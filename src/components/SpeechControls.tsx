import { Square, Volume2 } from "lucide-react"
import { useApp } from "../state/AppStore"
import { GazeButton } from "./GazeButton"
import { Select } from "./ui"

export function VoiceSelect() {
  const { speech, settings, updateSettings } = useApp()
  return (
    <Select
      label="Voice"
      value={settings.voiceURI ?? ""}
      onChange={(v) => updateSettings({ voiceURI: v || null })}
      disabled={!speech.supported || speech.voices.length === 0}
    >
      <option value="">System default voice</option>
      {speech.voices.map((v) => (
        <option key={v.voiceURI} value={v.voiceURI}>
          {v.name} ({v.lang})
        </option>
      ))}
    </Select>
  )
}

export function RateSlider({ id = "speech-rate" }: { id?: string }) {
  const { settings, updateSettings } = useApp()
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={0.5}
        max={1.8}
        step={0.1}
        value={settings.speechRate}
        onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
        className="h-2 w-full cursor-pointer accent-[var(--app-primary)]"
        aria-label="Speech rate"
        aria-valuetext={`${settings.speechRate.toFixed(1)} times`}
      />
      <span className="w-11 text-right text-sm font-semibold tabular-nums text-ink">
        {settings.speechRate.toFixed(1)}×
      </span>
    </div>
  )
}

export function SpeechControls({ text }: { text: string }) {
  const { speech, speakText, settings } = useApp()
  const unavailable = !speech.supported
  return (
    <section
      aria-label="Speech"
      className="flex w-full flex-col gap-3.5 rounded-3xl border border-line bg-surface p-4"
    >
      {speech.speaking ? (
        <GazeButton
          gazeId="speech-stop"
          size="xl"
          variant="secondary"
          icon={Square}
          onActivate={speech.stop}
          className="w-full"
        >
          Stop speaking
        </GazeButton>
      ) : (
        <GazeButton
          gazeId="speech-speak"
          size="xl"
          variant="primary"
          icon={Volume2}
          onActivate={() => speakText(text)}
          disabled={!text.trim() || unavailable || !settings.speechEnabled}
          className="w-full"
        >
          Speak
        </GazeButton>
      )}
      {speech.error && (
        <p role="alert" className="rounded-xl bg-bad/10 p-3 text-sm text-ink">
          {speech.error}
        </p>
      )}
      {unavailable ? (
        <p className="rounded-xl bg-warn/10 p-3 text-sm text-ink">
          Speech isn’t available in this browser. Try Chrome, Edge or Safari to
          hear your messages.
        </p>
      ) : !settings.speechEnabled ? (
        <p className="rounded-xl bg-subtle p-3 text-sm text-ink-2">
          Text-to-speech is turned off in Settings.
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          <VoiceSelect />
          <div className="flex items-center gap-3">
            <label
              htmlFor="speech-rate"
              className="shrink-0 text-sm font-semibold text-ink-2"
            >
              Rate
            </label>
            <RateSlider />
          </div>
        </div>
      )}
    </section>
  )
}
