import { BookMarked, Plus } from 'lucide-react'
import { useState } from 'react'
import { SavedPhraseCard } from '../components/SavedPhraseCard'
import { buttonClass } from '../components/ui'
import { navigate } from '../lib/router'
import { useApp } from '../state/AppStore'

export function SavedMessagesPage() {
  const { phrases, addPhrase, updatePhrase, removePhrase, speakText, composer, notify } = useApp()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')

  const create = () => {
    if (!draft.trim()) return
    addPhrase(draft)
    setDraft('')
    setCreating(false)
    notify('Phrase saved')
  }

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-8 lg:px-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Ready-to-use phrases</h2>
          <p className="mt-1 text-lg text-ink-2">Speak a phrase instantly, or insert it into your message to add more. Look at a button to select it.</p>
        </div>
        {!creating && (
          <button type="button" className={buttonClass('primary', 'lg')} onClick={() => setCreating(true)}>
            <Plus className="size-5" /> New phrase
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-6 rounded-3xl border-2 border-brand-2/50 bg-surface p-6">
          <label htmlFor="new-phrase" className="text-sm font-semibold text-ink">
            New phrase
          </label>
          <textarea
            id="new-phrase"
            autoFocus
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                create()
              }
            }}
            placeholder="For example: Could you open the window, please?"
            className="mt-2 w-full resize-none rounded-2xl border-2 border-line-strong bg-surface p-4 text-xl font-medium text-ink placeholder:text-ink-2/60 focus:border-brand focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button type="button" className={buttonClass('primary')} disabled={!draft.trim()} onClick={create}>
              Save phrase
            </button>
            <button type="button" className={buttonClass('ghost')} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phrases.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-line py-20 text-center">
          <BookMarked aria-hidden className="size-10 text-ink-2/60" />
          <p className="mt-4 text-xl font-semibold text-ink">No saved phrases yet</p>
          <p className="mt-1 max-w-md text-ink-2">Create one here, or use “Save phrase” in the keyboard workspace.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {phrases.map((p) => (
            <SavedPhraseCard
              key={p.id}
              phrase={p}
              onSpeak={() => speakText(p.text)}
              onInsert={() => {
                composer.insertText(p.text)
                notify('Inserted into your message')
                navigate('workspace')
              }}
              onSave={(t) => {
                updatePhrase(p.id, t)
                notify('Phrase updated')
              }}
              onDelete={() => {
                removePhrase(p.id)
                notify('Phrase deleted', 'info')
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
