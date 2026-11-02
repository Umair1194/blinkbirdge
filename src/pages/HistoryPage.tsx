import { Copy, History, Lock, Trash2, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { GazeButton } from '../components/GazeButton'
import { Modal, Toggle, buttonClass } from '../components/ui'
import { useApp } from '../state/AppStore'

const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export function HistoryPage() {
  const { history, removeHistory, clearHistory, speakText, notify, settings, updateSettings } = useApp()
  const [confirmAll, setConfirmAll] = useState(false)

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t)
      notify('Copied')
    } catch {
      notify('Copying isn’t allowed in this browser window', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Your saved messages</h2>
          <p className="mt-1 text-lg text-ink-2">Only messages you choose to save appear here. They stay on this device.</p>
        </div>
        {history.length > 0 && (
          <button type="button" className={buttonClass('danger')} onClick={() => setConfirmAll(true)}>
            <Trash2 className="size-4" /> Clear history
          </button>
        )}
      </div>

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
        <Lock aria-hidden className="size-5 shrink-0 text-brand" />
        <p className="flex-1 text-[15px] text-ink">
          <strong className="font-semibold">Also save messages when I speak them</strong>
          <span className="block text-sm text-ink-2">Off by default to protect private conversations.</span>
        </p>
        <Toggle label="Also save messages when I speak them" checked={settings.keepHistory} onChange={(v) => updateSettings({ keepHistory: v })} />
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-line py-20 text-center">
          <History aria-hidden className="size-10 text-ink-2/60" />
          <p className="mt-4 text-xl font-semibold text-ink">No history yet</p>
          <p className="mt-1 max-w-md text-ink-2">In the keyboard workspace, choose “Save to history” to keep a message here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {history.map((h) => (
            <li key={h.id} className="rounded-3xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                <time dateTime={new Date(h.createdAt).toISOString()} className="font-semibold text-ink">
                  {fmt.format(h.createdAt)}
                </time>
                <span aria-hidden>·</span>
                <span>{h.text.length} characters</span>
                <span aria-hidden>·</span>
                <span>{h.source === 'spoken' ? 'Saved when spoken' : 'Saved manually'}</span>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xl font-medium leading-snug text-ink">{h.text}</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <GazeButton gazeId={`history-speak-${h.id}`} size="md" variant="primary" icon={Volume2} onActivate={() => speakText(h.text)}>
                  Speak again
                </GazeButton>
                <GazeButton gazeId={`history-copy-${h.id}`} size="md" variant="secondary" icon={Copy} onActivate={() => void copy(h.text)}>
                  Copy
                </GazeButton>
                <button
                  type="button"
                  className={buttonClass('ghost')}
                  onClick={() => {
                    removeHistory(h.id)
                    notify('Deleted', 'info')
                  }}
                >
                  <Trash2 className="size-4" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={confirmAll} onClose={() => setConfirmAll(false)} title="Clear all history?" description="Every saved message will be removed from this device.">
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClass('secondary', 'lg')} onClick={() => setConfirmAll(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={buttonClass('danger', 'lg')}
            onClick={() => {
              clearHistory()
              setConfirmAll(false)
              notify('History cleared', 'info')
            }}
          >
            Clear history
          </button>
        </div>
      </Modal>
    </div>
  )
}
