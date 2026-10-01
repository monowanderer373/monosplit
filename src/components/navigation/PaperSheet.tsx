import type { ReactNode, Ref } from 'react'
import './paper.css'

export default function PaperSheet({
  labelledBy,
  label,
  dialogRef,
  onClose,
  children,
  expanded = false,
}: {
  labelledBy?: string
  label?: string
  dialogRef: Ref<HTMLElement>
  onClose: () => void
  expanded?: boolean
  children: ReactNode
}) {
  return (
    <div className="tt-sheet-backdrop">
      <div className="tt-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <section
        ref={dialogRef}
        className={`tt-paper tt-sheet-panel${expanded ? ' tt-sheet-expanded' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  )
}
