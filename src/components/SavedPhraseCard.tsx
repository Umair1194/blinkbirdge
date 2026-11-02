import { Check, CornerDownLeft, Pencil, Trash2, Volume2, X } from 'lucide-react'
import { useState } from 'react'
import type { Phrase } from '../state/AppStore'
import { GazeButton } from './GazeButton'
import { buttonClass } from './ui'

interface Props {
  phrase: Phrase
  onSpeak: () => void
  onInsert: () => void
  onSave: (text: string) => void
  onDelete: () => void
}

export function SavedPhraseCard({ phrase, onSpeak, onInsert, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(phrase.text)
  const [confirming, setConfirming] = useState(false)

  return (
    <article className="flex flex-col rounded-3xl border border-line bg-surface p-6">
      {editing ? (
        <div className="flex-1">
          <label htmlFor={`edit-${phrase.id}`} className="text-sm font-semibold text-ink-2">
            Edit phrase
          </label>
          <textarea
            id={`edit-${phrase.id}`}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-2xl border-2 border-line-strong bg-surface p-4 text-xl font-medium text-ink focus:border-brand focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={buttonClass('primary')}
              disabled={!draft.trim()}
              onClick={() => {
                onSave(draft)
                setEditing(false)
              }}
            >
              <Check className="size-4" /> Save changes
            </button>
            <button
              type="button"
              className={buttonClass('ghost')}
              onClick={() => {
                setDraft(phrase.text)
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="flex-1 text-2xl font-semibold leading-snug tracking-tight text-ink">{phrase.text}</p>
      )}

      {!editing && (
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <GazeButton gazeId={`phrase-speak-${phrase.id}`} variant="primary" icon={Volume2} onActivate={onSpeak}>
            Speak
          </GazeButton>
          <GazeButton gazeId={`phrase-insert-${phrase.id}`} variant="secondary" icon={CornerDownLeft} onActivate={onInsert}>
            Insert
          </GazeButton>
          <div className="flex-1" />
          {confirming ? (
            <div className="flex items-center gap-1.5" role="group" aria-label="Confirm delete">
              <button type="button" className={buttonClass('danger', 'sm')} onClick={onDelete}>
                <Trash2 className="size-4" /> Delete
              </button>
              <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setConfirming(false)} aria-label="Cancel delete">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setEditing(true)} aria-label={`Edit “${phrase.text}”`}>
                <Pencil className="size-4" /> Edit
              </button>
              <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setConfirming(true)} aria-label={`Delete “${phrase.text}”`}>
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      )}
    </article>
  )
}
