import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react"
import { useApp } from "../state/AppStore"
import { cx } from "./ui"

const ICON = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: XCircle,
}

export function Toasts() {
  const { toasts, dismissToast } = useApp()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[70] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((t) => {
        const Icon = ICON[t.tone]
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[15px] font-medium text-canvas shadow-xl hc:border-2 hc:border-brand hc:bg-black hc:text-white"
          >
            <Icon
              aria-hidden
              className={cx(
                "size-5",
                t.tone === "success" && "text-[#4ade80]",
                t.tone === "info" && "text-[#93c5fd]",
                t.tone === "warning" && "text-[#fbbf24]",
                t.tone === "error" && "text-[#f87171]",
              )}
            />
            <span className="min-w-0 break-words">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="ml-1 rounded-lg px-2 py-1 font-semibold text-[#5eead4] hover:bg-white/10"
                onClick={() => {
                  t.action?.run()
                  dismissToast(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
              onClick={() => dismissToast(t.id)}
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
