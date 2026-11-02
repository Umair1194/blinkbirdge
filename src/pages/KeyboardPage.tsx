import { Eraser } from 'lucide-react'
import { useCallback, useState } from 'react'
import { DwellField, KeyboardSettingsFields } from '../components/AccessibilitySettings'
import { VirtualKeyboard } from '../components/VirtualKeyboard'
import { buttonClass } from '../components/ui'
import { nextIsUpper } from '../lib/composer'
import { useApp } from '../state/AppStore'

export function KeyboardPage() {
  const { settings } = useApp()
  const [test, setTest] = useState('')
  const [shift, setShift] = useState(false)

  const onChar = useCallback(
    (c: string) => {
      setTest((t) => {
        const upper = /[a-z]/i.test(c) && nextIsUpper(t, settings.letterCase, shift)
        return t + (upper ? c.toUpperCase() : c.toLowerCase())
      })
      setShift(false)
    },
    [settings.letterCase, shift],
  )
  const onShift = useCallback(() => setShift((v) => !v), [])
  const onBackspace = useCallback(() => setTest((t) => t.slice(0, -1)), [])
  const onSpace = useCallback(() => setTest((t) => t + ' '), [])
  const onEnter = useCallback(() => setTest((t) => t + '\n'), [])
  const onClear = useCallback(() => setTest(''), [])

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-8">
      <div className="mb-6 max-w-2xl">
        <h2 className="text-[28px] font-bold tracking-tight text-ink">Make the keyboard yours</h2>
        <p className="mt-1 text-lg text-ink-2">Changes apply instantly. Try them on the preview keyboard below — it doesn’t affect your message.</p>
      </div>

      <section aria-label="Keyboard preview" className="rounded-3xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-subtle px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">Test area</span>
          <p className="min-h-9 flex-1 truncate whitespace-pre text-2xl font-medium text-ink" aria-live="polite">
            {test || <span className="text-ink-2/70">Type here to try your settings</span>}
          </p>
          <button type="button" className={buttonClass('ghost', 'sm')} onClick={onClear} disabled={!test}>
            <Eraser className="size-4" /> Reset
          </button>
        </div>
        <VirtualKeyboard
          scope="preview"
          settings={settings}
          shift={shift}
          upperNext={nextIsUpper(test, settings.letterCase, shift)}
          onChar={onChar}
          onShift={onShift}
          onBackspace={onBackspace}
          onSpace={onSpace}
          onEnter={onEnter}
          onClear={onClear}
        />
      </section>

      <section aria-label="Keyboard settings" className="mt-6 rounded-3xl border border-line bg-surface px-6 py-1 lg:px-8">
        <KeyboardSettingsFields />
        <DwellField />
      </section>
    </div>
  )
}
