import { AccessibilitySettings, SETTINGS_SECTIONS } from '../components/AccessibilitySettings'

export function SettingsPage() {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-8 px-6 py-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:px-8">
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-28 space-y-1">
          {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-ink-2 hover:bg-subtle hover:text-ink"
              >
                <Icon aria-hidden className="size-4" /> {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <AccessibilitySettings />
    </div>
  )
}
