import React from 'react'
import { useT } from '../lib/i18n'
import { spawnRipple } from '../lib/ripple'

// ── Nav tab icons — SVG paths exported from design ──────────────────────────

function SummaryIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-[18px] w-[18px] shrink-0 transition-colors duration-100 ${active ? 'text-[#faf8f4]' : 'text-[var(--ms-text-muted)]'}`}
      viewBox="0 0 720 800"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 798.65997l0-798.65997 60 60 60-60 60 60 60-60 60 60 60-60 60 60 60-60 60 60 60-60 60 60 60-60 0 798.65997-60-60-60 60-60-60-60 60-60-60-60 60-60-59.89996-60 59.89996-60-59.89996-60 59.89996-60-59.89996-60 59.89996z m118-210l486.67004 0 0-66.65997-486.67004 0 0 66.65997z m0-156l486.67004 0 0-66.65997-486.67004 0 0 66.65997z m0-156.65997l486.67004 0 0-66.67004-486.67004 0 0 66.67004z m-51.33 416.66003l586.65996 0 0-586.66003-586.65996 0 0 586.66003z" />
    </svg>
  )
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-[18px] w-[18px] shrink-0 transition-colors duration-100 ${active ? 'text-[#faf8f4]' : 'text-[var(--ms-text-muted)]'}`}
      viewBox="0 0 766 800"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M159.32999 562l66.67001 0 0-404-66.66998 0-0.00003 404z m334.67001-80l66.66998 0 0-324-66.66998 0 0 324z m-167.32999-120l66.66001 0 0-204-66.66001 0 0 204z m-260 358q-27 0-46.83999-19.83002-19.83002-19.83996-19.83002-46.83996l0-586.65998q0-27 19.83-46.84002 19.84-19.83002 46.84-19.83002l586.65996 0q27 0 46.84002 19.83002 19.83002 19.83997 19.83002 46.83996l0 586.65998q0 27-19.83002 46.83996-19.83996 19.83008-46.83996 19.83008l-586.66001 0z m0-66.66998l586.65995 0 0-586.65998-586.65996 0 0.00001 586.65998z" />
    </svg>
  )
}

function SettleIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-[18px] w-[18px] shrink-0 transition-colors duration-100 ${active ? 'text-[#faf8f4]' : 'text-[var(--ms-text-muted)]'}`}
      viewBox="0 0 800 720"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M66.67 160l666.65996 0 0-93.33002-666.65996 0 0 93.33002z m-66.67-93.33002q0-27 19.83-46.84002 19.84-19.82996 46.84-19.82996l666.65996 0q27 0 46.84002 19.83002 19.83002 19.83997 19.83002 46.83996l0 239.33002-733.33 0 0 267.32996 209.99998 0 0 66.67004-210 0q-27 0-46.83999-19.83002-19.82999-19.83996-19.82999-46.83996l0-506.66004z m518 653.33002l-170-170 47.33002-47.33002 122.66998 122 235.33002-235.33999 46.66998 48.67001-282 282z" />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-[18px] w-[18px] shrink-0 transition-colors duration-100 ${active ? 'text-[#faf8f4]' : 'text-[var(--ms-text-muted)]'}`}
      viewBox="0 0 800 800"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M146 618q59-42.33002 121.33002-65.5 62.33999-23.17004 132.66998-23.17004 70.32996 0 133 23.17004 62.67004 23.17004 121.66998 65.5 41-49.66998 59.83002-103.66998 18.83002-54 18.83002-114.33002 0-141-96.15998-237.16998-96.17004-96.16004-237.17004-96.16004-141 0-237.17 96.15998-96.16 96.17004-96.16 237.17004 0 60.33002 19.16 114.33002 19.17 53.99994 60.17 103.66998m155.83002-224.5q-39.83002-39.83002-39.83002-98.16998 0-58.33002 39.83002-98.15998 39.83999-39.84002 98.16998-39.84002 58.32996 0 98.16998 39.84002 39.83002 39.82996 39.83002 98.15998 0 58.34002-39.83002 98.16998-39.84002 39.83002-98.16998 39.83002-58.32996 0-98.16998-39.83002m98.16998 406.5q-82.33002 0-155.33002-31.5-73-31.5-127.33999-85.83002-54.32999-54.33996-85.82999-127.34002-31.5-73-31.5-155.32996 0-83 31.5-155.66998 31.5-72.65998 85.83-127 54.34-54.33002 127.34001-85.83002 73.00003-31.5 155.32999-31.5 83 0 155.66998 31.5 72.65998 31.5 127 85.83002 54.33002 54.34002 85.83002 127 31.5 72.66998 31.5 155.66998 0 82.33002-31.5 155.33002-31.5 73-85.83002 127.34002-54.34002 54.32996-127 85.82996-72.66998 31.5-155.66998 31.5m105-82.5q50.66998-15.83002 97.66998-52.16998-47-33.66004-98-51.5-51-17.83002-104.66998-17.83002-53.66998 0-104.66998 17.82996-51 17.84002-98 51.5 47 36.34002 97.66998 52.17004 50.66998 15.82996 105 15.82996 54.33002 0 105-15.82996m-53.66998-370.83002q20-20 20-51.34002 0-31.33002-20-51.33002-20-20-51.33002-19.99994-31.33002 0.00006-51.33002 20-20 19.99994-20 51.33002 0 31.34002 20 51.34002 20 20 51.33002 20 31.33002 0 51.33002-20" />
    </svg>
  )
}

// FAB icon — ZUDI7 design (circle with pointed corner + plus)
function AddExpenseIcon() {
  return (
    <svg
      className="h-[30px] w-[30px] text-[#faf8f4]"
      viewBox="0 0 800 800"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
    >
      <path d="M366.67001 601.32996l66.66001 0 0-165.32996 165.34002 0 0-66.66998-165.34002 0 0-165.33002-66.66001 0 0 165.33002-165.34002 0 0 66.66998 165.33999 0 0.00003 165.32996z m33.06 198.67004q-82.73001 0-155.73001-31.5-73-31.5-127-85.5-54-54-85.5-127-31.5-73-31.5-156 0-83 31.5-156 31.5-73 85.5-127 54-54 127-85.5 73-31.5 156-31.5 83 0 156 31.5 73 31.5 127 85.5 54 54 85.5 127 31.5 73 31.5 156l0 318.67004q0 33.54999-23.89001 57.43995-23.89002 23.89001-57.44001 23.89001l-318.93997 0z m0.26999-66.66998q139.58002 0 236.46002-96.87006 96.87-96.88 96.87-236.45996 0-139.57996-96.87-236.46002-96.88-96.87-236.46002-96.87-139.58002 0-236.46001 96.87-96.86999 96.88-96.86999 236.46002 0 139.58002 96.87001 236.46002 96.88 96.87 236.45999 96.87" />
    </svg>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

type Props = {
  active: 'summary' | 'dashboard' | 'settle' | 'profile'
  onChange: (tab: 'summary' | 'dashboard' | 'settle' | 'profile') => void
  onAddExpenseClick: () => void
}

export default function BottomTabs({ active, onChange, onAddExpenseClick }: Props) {
  const t = useT()

  const tabs: Array<{
    id: Props['active']
    label: string
    Icon: (props: { active: boolean }) => React.ReactElement
  }> = [
    { id: 'summary', label: t('tab.summary'), Icon: SummaryIcon },
    { id: 'dashboard', label: t('tab.dashboard'), Icon: DashboardIcon },
    { id: 'settle', label: t('tab.settle'), Icon: SettleIcon },
    { id: 'profile', label: t('tab.profile'), Icon: ProfileIcon },
  ]

  return (
    <>
      {/* Floating Action Button — fixed above nav bar, bottom-right */}
      <button
        className="ms-fab"
        aria-label={t('tab.addExpense')}
        onPointerDown={(e) => {
          spawnRipple(e)
          onAddExpenseClick()
        }}
      >
        <AddExpenseIcon />
      </button>

      {/* Bottom nav pill */}
      <nav className="fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
        <div className="ms-sketch-bar relative mx-auto max-w-2xl bg-[var(--ms-bg)]">
          <div className="flex h-[78px] items-center justify-center px-[21px]">
            {/* Pill container */}
            <div className="flex h-[54px] w-full gap-[3px] bg-[var(--ms-surface)] p-1">
              {tabs.map((tab) => {
                const isActive = active === tab.id
                return (
                  <button
                    key={tab.id}
                    className={`ms-key flex flex-1 flex-col items-center justify-center gap-[4px] ${isActive ? 'ms-nav-active' : ''}`}
                    onPointerDown={(e) => {
                      spawnRipple(e)
                      onChange(tab.id)
                    }}
                  >
                    <tab.Icon active={isActive} />
                    <span
                      className={`text-[9px] font-semibold leading-none tracking-[0.04em] transition-colors duration-100 ${
                        isActive ? 'text-[#faf8f4]' : 'text-[var(--ms-text-muted)]'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
