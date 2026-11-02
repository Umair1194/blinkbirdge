import { BookmarkPlus, Copy, Eraser, History, Undo2 } from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"
import { countWords } from "../lib/composer"
import { GazeButton } from "./GazeButton"
import { cx } from "./ui"

interface Props {
  text: string
  canUndo: boolean
  onUndo: () => void
  onCopy: () => void
  onSavePhrase: () => void
  onSaveHistory: () => void
  onClear: () => void
  large?: boolean
  sessionInfo?: ReactNode
}

export function MessageComposer({
  text,
  canUndo,
  onUndo,
  onCopy,
  onSavePhrase,
  onSaveHistory,
  onClear,
  large,
  sessionInfo,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [text])
  const empty = text.length === 0
  const words = countWords(text)

  return (
    <section
      aria-labelledby="composer-label"
      className="@container flex min-w-0 flex-1 flex-col rounded-3xl border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 pt-4 [@media(max-height:760px)]:hidden">
        <h2
          id="composer-label"
          className="shrink-0 whitespace-nowrap text-sm font-semibold uppercase tracking-[0.08em] text-ink-2"
        >
          Your Message
        </h2>
        <div className="ml-auto hidden min-w-0 truncate 2xl:block">
          {sessionInfo}
        </div>
        <p
          className="ml-auto shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-ink 2xl:ml-0"
          aria-live="polite"
        >
          {words} {words === 1 ? "word" : "words"} · {text.length}{" "}
          {text.length === 1 ? "character" : "characters"}
        </p>
      </div>
      <div
        ref={scroller}
        role="textbox"
        aria-readonly="true"
        aria-multiline="true"
        aria-labelledby="composer-label"
        className={cx(
          "mx-6 mt-2 min-h-0 flex-1 overflow-y-auto [@media(max-height:760px)]:mt-3 whitespace-pre-wrap break-words font-medium leading-snug tracking-tight text-ink",
          large ? "min-h-12 text-[2.25rem]" : "min-h-12 text-[2rem]",
        )}
      >
        {empty ? (
          <span className="text-ink-2/70">
            <span className="animate-caret mr-0.5 inline-block h-[1em] w-[3px] translate-y-[0.15em] rounded-full bg-brand-2" />
            Your words will appear here...
          </span>
        ) : (
          <>
            {text}
            <span className="animate-caret ml-0.5 inline-block h-[1em] w-[3px] translate-y-[0.15em] rounded-full bg-brand-2" />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 [@media(max-height:760px)]:py-2">
        <GazeButton
          gazeId="composer-undo"
          size="md"
          variant="soft"
          icon={Undo2}
          onActivate={onUndo}
          disabled={!canUndo}
        >
          Undo
        </GazeButton>
        <GazeButton
          gazeId="composer-copy"
          size="md"
          variant="soft"
          icon={Copy}
          onActivate={onCopy}
          disabled={empty}
          aria-label="Copy message"
        >
          <span className="hidden @[38rem]:inline">Copy</span>
        </GazeButton>
        <GazeButton
          gazeId="composer-save-phrase"
          size="md"
          variant="soft"
          icon={BookmarkPlus}
          onActivate={onSavePhrase}
          disabled={empty}
          aria-label="Save as phrase"
        >
          <span className="hidden @[38rem]:inline @[52rem]:hidden">Phrase</span>
          <span className="hidden @[52rem]:inline">Save phrase</span>
        </GazeButton>
        <GazeButton
          gazeId="composer-save-history"
          size="md"
          variant="soft"
          icon={History}
          onActivate={onSaveHistory}
          disabled={empty}
          aria-label="Save to history"
        >
          <span className="hidden @[38rem]:inline @[52rem]:hidden">
            History
          </span>
          <span className="hidden @[52rem]:inline">Save to history</span>
        </GazeButton>
        <div className="flex-1" />
        <GazeButton
          gazeId="composer-clear"
          size="md"
          variant="danger"
          icon={Eraser}
          onActivate={onClear}
          disabled={empty}
        >
          Clear
        </GazeButton>
      </div>
    </section>
  )
}
