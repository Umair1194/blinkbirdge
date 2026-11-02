import { ArrowBigUp, CornerDownLeft, Delete, Eraser, Space, type LucideIcon } from 'lucide-react'
import { memo } from 'react'
import { useGazeTarget } from '../hooks/useGaze'
import type { KeyDef } from '../lib/keyboardLayouts'
import type { Settings } from '../lib/settings'
import { DwellProgress } from './DwellProgress'
import { cx } from './ui'

const ICONS: Partial<Record<string, LucideIcon>> = {
  'k-shift': ArrowBigUp,
  'k-backspace': Delete,
  'k-space': Space,
  'k-enter': CornerDownLeft,
  'k-clear': Eraser,
}

const CHAR_TEXT: Record<Settings['keySize'], string> = {
  small: 'text-2xl',
  medium: 'text-[1.75rem]',
  large: 'text-[2.125rem]',
}

interface Props {
  def: KeyDef
  label: string
  scope: string
  size: Settings['keySize']
  active?: boolean
  dimmed?: boolean
  onPress: (def: KeyDef) => void
  onGazePress?: (def: KeyDef) => void
}

export const KeyboardKey = memo(function KeyboardKey({ def, label, scope, size, active, dimmed, onPress, onGazePress }: Props) {
  const { progress, hovered, selected, targetProps } = useGazeTarget(`${scope}-${def.id}`, () => (onGazePress ?? onPress)(def), {
    disabled: def.disabled,
    learn: !onGazePress,
  })
  const Icon = ICONS[def.id]
  const variant = def.variant ?? 'char'
  const isChar = variant === 'char'
  const ariaLabel =
    def.id === 'k-comma' ? 'Comma' : def.id === 'k-period' ? 'Period' : def.id === 'k-backspace' ? 'Delete last character' : label

  return (
    <button
      type="button"
      {...targetProps}
      disabled={def.disabled}
      aria-label={ariaLabel}
      aria-pressed={def.id === 'k-shift' ? !!active : undefined}
      onClick={() => onPress(def)}
      style={{ flexGrow: def.grow ?? 1, flexBasis: 0 }}
      className={cx(
        'relative flex min-w-0 select-none items-center justify-center gap-2 rounded-2xl border-2 font-semibold',
        'transition-[background-color,border-color,box-shadow,color,opacity] duration-100',
        isChar ? CHAR_TEXT[size] : 'text-base',
        // Default
        isChar && 'border-key-line bg-key text-key-ink shadow-[0_1px_0_0_var(--app-border)]',
        variant === 'function' && 'border-key-line bg-key-fn text-key-ink',
        variant === 'primary' && 'border-brand bg-brand text-on-brand',
        variant === 'danger' && 'border-key-line bg-key text-bad',
        active && 'border-brand bg-brand-soft-2 text-brand',
        // Gaze hover
        hovered && variant !== 'primary' && 'border-key-hover-line bg-key-hover',
        hovered && variant === 'primary' && 'shadow-[0_0_0_4px_color-mix(in_oklab,var(--app-primary-2)_35%,transparent)]',
        // Selected
        selected && '!border-brand !bg-brand !text-on-brand animate-pop',
        // Disabled
        def.disabled && '!border-dashed !border-line !bg-transparent !text-muted !shadow-none cursor-not-allowed',
        dimmed && 'opacity-60',
        !hovered && !def.disabled && 'hover:border-line-strong',
      )}
    >
      <DwellProgress progress={progress} />
      {Icon && <Icon aria-hidden className="relative size-6 shrink-0" strokeWidth={2.25} />}
      <span className={cx('relative truncate', !isChar && Icon && 'hidden lg:inline')}>{label}</span>
    </button>
  )
})
