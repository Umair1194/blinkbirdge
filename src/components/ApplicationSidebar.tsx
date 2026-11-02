import {
  BookMarked,
  Camera,
  ChevronsLeft,
  ChevronsRight,
  Crosshair,
  History,
  Keyboard,
  LayoutGrid,
  LifeBuoy,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react"
import { useGazeTarget } from "../hooks/useGaze"
import { navigate, type Route } from "../lib/router"
import { DwellProgress } from "./DwellProgress"
import { Logo } from "./Logo"
import { cx } from "./ui"

const GROUPS: {
  title: string
  items: { route: Route; label: string; icon: LucideIcon }[]
}[] = [
  {
    title: "Communicate",
    items: [
      { route: "workspace", label: "Workspace", icon: Keyboard },
      { route: "phrases", label: "Saved messages", icon: BookMarked },
      { route: "history", label: "History", icon: History },
    ],
  },
  {
    title: "Setup",
    items: [
      { route: "setup", label: "Camera setup", icon: Camera },
      { route: "calibrate", label: "Calibration", icon: Crosshair },
      { route: "keyboard", label: "Keyboard", icon: LayoutGrid },
      { route: "settings", label: "Settings", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Support",
    items: [{ route: "help", label: "Help & tutorials", icon: LifeBuoy }],
  },
]

function NavItem({
  route,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  route: Route
  label: string
  icon: LucideIcon
  active: boolean
  collapsed: boolean
}) {
  // Nav sits beside the keyboard, so it needs a longer dwell to avoid accidental jumps.
  const { progress, hovered, targetProps } = useGazeTarget(
    `nav-${route}`,
    () => navigate(route),
    { dwellScale: 1.5, disabled: active },
  )
  return (
    <a
      href={`#/${route}`}
      {...targetProps}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cx(
        "relative flex h-12 items-center gap-3 rounded-xl border-2 border-transparent text-[15px] font-semibold transition-colors",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-brand-soft text-brand hc:border-brand"
          : "text-ink-2 hover:bg-subtle hover:text-ink",
        hovered && "border-key-hover-line bg-key-hover text-ink",
      )}
    >
      <DwellProgress progress={progress} />
      <Icon
        aria-hidden
        className="relative size-5 shrink-0"
        strokeWidth={2.25}
      />
      {!collapsed && <span className="relative truncate">{label}</span>}
    </a>
  )
}

export function ApplicationSidebar({
  route,
  collapsed,
  onToggle,
}: {
  route: Route
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <aside
      aria-label="Main navigation"
      className={cx(
        "app-sidebar sticky top-0 flex h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200",
        collapsed ? "w-20 px-3" : "w-[248px] px-4",
      )}
    >
      <div
        className={cx(
          "flex min-h-[76px] shrink-0 items-center py-3",
          collapsed ? "justify-center" : "px-1",
        )}
      >
        <Logo collapsed={collapsed} />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto py-3">
        {GROUPS.map((g) => (
          <div key={g.title}>
            {!collapsed ? (
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink-2/80">
                {g.title}
              </div>
            ) : (
              <div className="mx-auto mb-2 h-px w-8 bg-line" />
            )}
            <div className="space-y-1">
              {g.items.map((it) => (
                <NavItem
                  key={it.route}
                  {...it}
                  active={route === it.route}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line py-4">
        <div
          className={cx(
            "flex items-center gap-3 rounded-xl",
            collapsed ? "justify-center" : "px-2",
          )}
        >
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft-2 text-sm font-bold text-brand"
            aria-hidden
          >
            Me
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-ink">
                Local profile
              </div>
              <a
                href="#/settings"
                className="text-xs font-medium text-brand underline-offset-2 hover:underline"
              >
                Profile & settings
              </a>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cx(
            "flex h-10 w-full items-center gap-2 rounded-xl text-sm font-semibold text-ink-2 hover:bg-subtle hover:text-ink",
            collapsed ? "justify-center" : "px-3",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-5" />
          ) : (
            <ChevronsLeft className="size-5" />
          )}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  )
}
