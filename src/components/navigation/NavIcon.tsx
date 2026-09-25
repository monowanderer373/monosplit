import type { ReactNode } from 'react'
import type { GlobalDestination } from '../../lib/moneyContext'

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export function NavIcon({ id }: { id: GlobalDestination }) {
  if (id === 'daily') {
    return (
      <Svg>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3.5v3M16 3.5v3M4 10h16" />
      </Svg>
    )
  }
  if (id === 'insights') {
    return (
      <Svg>
        <path d="M12 4a8 8 0 1 0 8 8h-8V4z" />
        <path d="M13.5 3.6A8 8 0 0 1 20.4 10.5H13.5V3.6z" />
      </Svg>
    )
  }
  if (id === 'shared') {
    return (
      <Svg>
        <rect x="7" y="6" width="12" height="14" rx="1.5" />
        <path d="M5 16V5.5A1.5 1.5 0 0 1 6.5 4H16" />
      </Svg>
    )
  }
  return (
    <Svg>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 19.5c1.2-3 3.3-4.5 6-4.5s4.8 1.5 6 4.5" />
    </Svg>
  )
}

export function NavIconContainer({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className="tt-icon-plate" data-active={active ? 'true' : 'false'}>{children}</span>
}
