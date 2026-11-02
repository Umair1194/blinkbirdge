export type KeyAction =
  | { type: 'char'; value: string }
  | { type: 'shift' }
  | { type: 'backspace' }
  | { type: 'space' }
  | { type: 'enter' }
  | { type: 'clear' }
  | { type: 'mode'; to: 'letters' | 'symbols' }

export interface KeyDef {
  id: string
  label: string
  action: KeyAction
  /** Relative width within its row. */
  grow?: number
  variant?: 'char' | 'function' | 'primary' | 'danger'
  disabled?: boolean
}

const ch = (c: string): KeyDef => ({ id: `k-${c}`, label: c, action: { type: 'char', value: c } })

const FN = {
  shift: { id: 'k-shift', label: 'Shift', action: { type: 'shift' }, grow: 1.5, variant: 'function' } as KeyDef,
  backspace: { id: 'k-backspace', label: 'Delete', action: { type: 'backspace' }, grow: 1.5, variant: 'function' } as KeyDef,
  space: { id: 'k-space', label: 'Space', action: { type: 'space' }, grow: 4, variant: 'function' } as KeyDef,
  clear: { id: 'k-clear', label: 'Clear', action: { type: 'clear' }, grow: 1.25, variant: 'danger' } as KeyDef,
  enter: { id: 'k-enter', label: 'Enter', action: { type: 'enter' }, grow: 1.25, variant: 'primary' } as KeyDef,
  toSymbols: { id: 'k-mode', label: '123', action: { type: 'mode', to: 'symbols' }, grow: 1.5, variant: 'function' } as KeyDef,
  toLetters: { id: 'k-mode', label: 'ABC', action: { type: 'mode', to: 'letters' }, grow: 1.5, variant: 'function' } as KeyDef,
}

const bottomRow = (mode: KeyDef): KeyDef[] => [mode, FN.space, { ...ch(','), id: 'k-comma' }, { ...ch('.'), id: 'k-period' }, FN.clear, FN.enter]

const rows = (r1: string, r2: string, r3: string) => [r1.split(''), r2.split(''), r3.split('')]

export const LETTER_ROWS = {
  qwerty: rows('qwertyuiop', 'asdfghjkl', 'zxcvbnm'),
  abc: rows('abcdefghij', 'klmnopqrs', 'tuvwxyz'),
}

export function buildLayout(mode: 'letters' | 'symbols', layout: 'qwerty' | 'abc'): KeyDef[][] {
  if (mode === 'symbols') {
    return [
      '1234567890'.split('').map(ch),
      ['-', '/', ':', ';', '(', ')', '&', '@', '"'].map(ch),
      [{ ...FN.shift, disabled: true }, ...['?', '!', "'", '+', '=', '%', '*'].map(ch), FN.backspace],
      bottomRow(FN.toLetters),
    ]
  }
  const [r1, r2, r3] = LETTER_ROWS[layout]
  return [r1.map(ch), r2.map(ch), [FN.shift, ...r3.map(ch), FN.backspace], bottomRow(FN.toSymbols)]
}
