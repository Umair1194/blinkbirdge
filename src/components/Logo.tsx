import { cx } from './ui'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cx('shrink-0', className)}>
      <rect width="40" height="40" rx="12" fill="var(--app-primary)" />
      <path
        d="M7 20c3.6-5.6 8-8.4 13-8.4S29.4 14.4 33 20c-3.6 5.6-8 8.4-13 8.4S10.6 25.6 7 20Z"
        fill="none"
        stroke="var(--app-on-primary)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="4.6" fill="var(--app-on-primary)" />
      <circle cx="28.5" cy="11.5" r="2.4" fill="var(--app-primary-2)" />
    </svg>
  )
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-3">
      <LogoMark className="size-10" />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-base font-bold tracking-tight text-ink">Gesture Playground</div>
          <div className="truncate text-xs font-medium text-ink-2">Eye-gaze communication</div>
        </div>
      )}
    </div>
  )
}
