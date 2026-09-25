import type { ReactNode } from 'react'
import ActiveMarker from './ActiveMarker'
import { NavIconContainer } from './NavIcon'

export default function NavItem({
  label,
  active,
  disabled = false,
  onClick,
  icon,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      className="tt-nav-item"
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <NavIconContainer active={active}>{icon}</NavIconContainer>
      <span className="tt-nav-label">{label}</span>
      <ActiveMarker />
    </button>
  )
}
