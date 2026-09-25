import type { ReactNode } from 'react'
import './paper.css'

type Variant = 'flat' | 'raised' | 'floating'

export default function PaperSurface({
  variant = 'flat',
  className = '',
  children,
}: {
  variant?: Variant
  className?: string
  children: ReactNode
}) {
  const variantClass = variant === 'flat' ? '' : ` tt-paper--${variant}`
  return <div className={`tt-paper${variantClass}${className ? ` ${className}` : ''}`}>{children}</div>
}
