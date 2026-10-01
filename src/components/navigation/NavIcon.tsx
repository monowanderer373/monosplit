import type { ReactNode } from 'react'
import type { GlobalDestination } from '../../lib/moneyContext'

function Svg({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{children}</svg>
}

export function NavIcon({ id }: { id: GlobalDestination }) {
  if (id === 'daily') return <Svg>
    <path fillRule="evenodd" d="M7 2a1 1 0 0 1 1 1v2h8V3a1 1 0 1 1 2 0v2h1a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1ZM5 11v8h14v-8H5Zm2 2h3v2H7v-2Zm5 0h3v2h-3v-2Zm-5 4h3v1H7v-1Z" />
  </Svg>
  if (id === 'insights') return <Svg>
    <path d="M10.8 2.5a9.5 9.5 0 1 0 10.7 10.7H10.8V2.5Z" />
    <path d="M12.5 1.5v10h10a10 10 0 0 0-10-10Z" />
  </Svg>
  if (id === 'shared') return <Svg>
    <circle cx="8" cy="7" r="4" /><circle cx="18" cy="8" r="3.3" />
    <path d="M.8 21v-3a7.2 7.2 0 0 1 14.4 0v3H.8Zm16 0v-3c0-1.8-.5-3.4-1.5-4.8A6 6 0 0 1 24 18.5V21h-7.2Z" />
  </Svg>
  return <Svg><circle cx="12" cy="6.5" r="4.5" /><path d="M4 22v-3a8 8 0 0 1 16 0v3H4Z" /></Svg>
}

export function NavIconContainer({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className="tt-icon-plate" data-active={active ? 'true' : 'false'}>{children}</span>
}
