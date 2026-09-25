import type { ReactNode } from 'react'

export default function PaperChip({ children }: { children: ReactNode }) {
  return <span className="tt-chip">{children}</span>
}
