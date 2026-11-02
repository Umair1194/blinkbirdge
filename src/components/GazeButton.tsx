import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useGazeTarget } from '../hooks/useGaze'
import { DwellProgress } from './DwellProgress'
import { cx } from './ui'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  gazeId: string
  onActivate: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'soft'
  size?: 'md' | 'lg' | 'xl'
  icon?: LucideIcon
  gazeDisabled?: boolean
  allowWhenPaused?: boolean
  dwellScale?: number
  children?: ReactNode
}

/** A button that can be activated by click, keyboard, or gaze dwell. */
export function GazeButton({
  gazeId,
  onActivate,
  variant = 'secondary',
  size = 'lg',
  icon: Icon,
  allowWhenPaused,
  dwellScale,
  disabled,
  gazeDisabled,
  className,
  children,
  ...rest
}: Props) {
  const { progress, hovered, selected, targetProps } = useGazeTarget(gazeId, onActivate, {
    disabled: disabled || gazeDisabled,
    allowWhenPaused,
    dwellScale,
  })
  return (
    <button
      type="button"
      {...rest}
      {...targetProps}
      disabled={disabled}
      onClick={onActivate}
      className={cx(
        'relative inline-flex select-none items-center justify-center gap-2.5 rounded-2xl border-2 font-semibold transition-[background-color,border-color,box-shadow,color] disabled:cursor-not-allowed disabled:opacity-45',
        size === 'md' && 'h-12 px-4 text-[15px]',
        size === 'lg' && 'h-14 px-5 text-base',
        size === 'xl' && 'h-16 px-6 text-lg',
        variant === 'primary' && 'border-brand bg-brand text-on-brand',
        variant === 'primary' && hovered && 'border-brand-2 shadow-[0_0_0_4px_color-mix(in_oklab,var(--app-primary-2)_30%,transparent)]',
        variant === 'secondary' && 'border-line bg-surface text-ink',
        variant === 'secondary' && hovered && 'border-key-hover-line bg-key-hover',
        variant === 'soft' && 'border-transparent bg-subtle text-ink',
        variant === 'soft' && hovered && 'border-key-hover-line bg-key-hover',
        variant === 'danger' && 'border-line bg-surface text-bad',
        variant === 'danger' && hovered && 'border-bad bg-bad/5',
        !hovered && !disabled && variant !== 'primary' && 'hover:border-line-strong',
        selected && 'animate-pop',
        className,
      )}
    >
      <DwellProgress progress={progress} />
      {Icon && <Icon aria-hidden className={cx('relative shrink-0', size === 'xl' ? 'size-6' : 'size-5')} strokeWidth={2.25} />}
      {children && <span className="relative">{children}</span>}
    </button>
  )
}
