import { spawnRipple } from '../lib/ripple'

type Props = {
  active: 'summary' | 'dashboard' | 'settle' | 'profile'
  onChange: (tab: 'summary' | 'dashboard' | 'settle' | 'profile') => void
  onAddExpenseClick: () => void
}

export default function BottomTabs({ active, onChange, onAddExpenseClick }: Props) {
  const tabs: Array<{ id: Props['active']; label: string }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'dashboard', label: 'Dash\nBoard' },
    { id: 'settle', label: 'Settle' },
    { id: 'profile', label: 'Profile' },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 bg-transparent pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="ms-sketch-bar relative mx-auto bg-[var(--ms-bg)]">
        <div className="flex h-[78px] items-center justify-center gap-[6px] px-2">
          {tabs.slice(0, 2).map((tab) => (
            <button
              key={tab.id}
              className={`ms-key flex-1 h-[48px] text-[13px] font-semibold leading-tight tracking-[0.01em] whitespace-pre-line ${
                active === tab.id ? 'ms-key-active text-[var(--ms-accent-hover)]' : 'text-[var(--ms-text-muted)]'
              }`}
              onPointerDown={(e) => {
                spawnRipple(e)
                onChange(tab.id)
              }}
            >
              {tab.label}
            </button>
          ))}

          <button
            className="ms-key ms-key-round h-[54px] w-[54px] shrink-0"
            aria-label="Add expense"
            onPointerDown={(e) => {
              spawnRipple(e)
              onAddExpenseClick()
            }}
          >
            <span className="-translate-y-[1px] text-[28px] font-light leading-none text-[var(--ms-text)]">+</span>
          </button>

          {tabs.slice(2).map((tab) => (
            <button
              key={tab.id}
              className={`ms-key flex-1 h-[48px] text-[13px] font-semibold leading-tight tracking-[0.01em] whitespace-pre-line ${
                active === tab.id ? 'ms-key-active text-[var(--ms-accent-hover)]' : 'text-[var(--ms-text-muted)]'
              }`}
              onPointerDown={(e) => {
                spawnRipple(e)
                onChange(tab.id)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
