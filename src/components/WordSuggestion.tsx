import { useGazeTarget } from '../hooks/useGaze'
import { DwellProgress } from './DwellProgress'
import { cx } from './ui'

export function WordSuggestion({ word, index, onSelect }: { word: string; index: number; onSelect: (w: string) => void }) {
  const { progress, hovered, selected, targetProps } = useGazeTarget(`suggestion-${index}`, () => onSelect(word), { learn: true })
  return (
    <button
      type="button"
      {...targetProps}
      onClick={() => onSelect(word)}
      aria-label={`Insert word ${word}`}
      className={cx(
        'relative flex h-16 min-w-0 flex-1 basis-0 select-none [@media(max-height:760px)]:h-14 items-center justify-center rounded-2xl border-2 px-3 text-xl font-semibold transition-colors',
        'border-brand-soft-2 bg-brand-soft text-brand hc:border-line',
        hovered && '!border-key-hover-line',
        !hovered && 'hover:border-brand-2/60',
        selected && '!bg-brand !text-on-brand animate-pop',
      )}
    >
      <DwellProgress progress={progress} />
      <span className="relative truncate">{word}</span>
    </button>
  )
}

export function WordSuggestionBar({ words, onSelect }: { words: string[]; onSelect: (w: string) => void }) {
  return (
    <div role="group" aria-label="Word suggestions" className="flex gap-2.5">
      {Array.from({ length: 5 }, (_, i) =>
        words[i] ? (
          <WordSuggestion key={i} index={i} word={words[i]} onSelect={onSelect} />
        ) : (
          <div key={i} aria-hidden className="h-16 flex-1 basis-0 rounded-2xl border-2 border-dashed border-line [@media(max-height:760px)]:h-14" />
        ),
      )}
    </div>
  )
}
