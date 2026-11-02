import { useEffect, useId, useRef, type ReactNode } from "react"

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cx("rounded-3xl border border-line bg-surface", className)}>
      {children}
    </div>
  )
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger"
export const buttonClass = (
  variant: BtnVariant = "secondary",
  size: "sm" | "md" | "lg" = "md",
) =>
  cx(
    "inline-flex max-w-full items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" && "min-h-9 px-3 py-1.5 text-sm",
    size === "md" && "min-h-11 px-4 py-2 text-[15px]",
    size === "lg" && "min-h-14 px-6 py-2 text-base",
    variant === "primary" && "bg-brand text-on-brand hover:bg-brand-3",
    variant === "secondary" &&
      "border border-line-strong bg-surface text-ink hover:bg-subtle",
    variant === "ghost" && "text-ink-2 hover:bg-subtle hover:text-ink",
    variant === "danger" &&
      "border border-bad/30 bg-surface text-bad hover:bg-bad/5",
  )

export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors",
        checked ? "border-brand bg-brand" : "border-line-strong bg-subtle",
      )}
    >
      <span
        className={cx(
          "inline-block size-6 rounded-full bg-surface shadow-sm transition-transform hc:bg-ink",
          checked ? "translate-x-6 hc:bg-on-brand" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  format,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  label: string
  format?: (v: T) => string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-xl bg-subtle p-1"
    >
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          tabIndex={o === value ? 0 : -1}
          onKeyDown={(e) => {
            const index = options.indexOf(o)
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1
              : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (index + 1) % options.length
              : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (index - 1 + options.length) % options.length : null
            if (next === null) return
            e.preventDefault()
            onChange(options[next])
            const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
            buttons?.[next]?.focus()
          }}
          onClick={() => onChange(o)}
          className={cx(
            "h-10 min-w-12 rounded-lg px-3.5 text-sm font-semibold transition-colors",
            o === value
              ? "bg-surface text-brand shadow-sm ring-1 ring-line hc:bg-brand hc:text-on-brand"
              : "text-ink-2 hover:text-ink",
          )}
        >
          {format ? format(o) : String(o)}
        </button>
      ))}
    </div>
  )
}

export function Select({
  value,
  onChange,
  children,
  label,
  className,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  label: string
  className?: string
  disabled?: boolean
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        "h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[15px] text-ink disabled:opacity-50",
        className,
      )}
    >
      {children}
    </select>
  )
}

export function SettingRow({
  title,
  description,
  children,
  htmlFor,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-5 last:border-b-0 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
      <div className="min-w-0">
        <label
          htmlFor={htmlFor}
          className="block text-base font-semibold text-ink"
        >
          {title}
        </label>
        {description && (
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-2">
            {description}
          </p>
        )}
      </div>
      <div className="min-w-0 max-w-full xl:max-w-[60%]">{children}</div>
    </div>
  )
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  wide?: boolean
  open: boolean
  title: string
  description?: ReactNode
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>("button")?.focus()
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== "Tab") return
      const nodes = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0)
      const first = nodes[0],
        last = nodes[nodes.length - 1]
      if (!first) {
        e.preventDefault()
        ref.current?.focus()
        return
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !ref.current?.contains(document.activeElement))
      ) {
        e.preventDefault()
        last.focus()
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !ref.current?.contains(document.activeElement))
      ) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", onKey)
      prev?.focus()
    }
  }, [open])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-[2px] hc:bg-black/80"
      data-gaze-scope
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("max-h-[90dvh] w-full overflow-y-auto rounded-3xl border border-line bg-surface p-5 sm:p-8 shadow-2xl", wide ? "max-w-5xl" : "max-w-xl")}
      >
        <h2 id={titleId} className="text-2xl font-bold tracking-tight text-ink">
          {title}
        </h2>
        {description && (
          <div className="mt-2 text-base leading-relaxed text-ink-2">
            {description}
          </div>
        )}
        <div className="mt-7">{children}</div>
      </div>
    </div>
  )
}
