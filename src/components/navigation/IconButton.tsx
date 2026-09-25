import type { ReactNode } from 'react'

export default function IconButton({
  label,
  onClick,
  children,
  disabled = false,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button type="button" className="tt-icon-button" aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
