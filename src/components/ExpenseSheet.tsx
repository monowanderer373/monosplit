import { useEffect, useRef, useState } from 'react'
import ExpenseForm from './ExpenseForm'
import type { Group, Expense } from '../types'

type Props = {
  group: Group
  isOpen: boolean
  onClose: () => void
  onSave: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
}

// Zigzag SVG edge at the BOTTOM of the receipt — teeth pointing downward,
// like paper tearing out of a printer from above.
function ReceiptEdgeBottom() {
  const teeth = 24
  const w = 480
  const h = 22
  const tw = w / teeth

  // Shape: top-left → top-right → right zigzag going left → close
  // Even i = valley (h/2), odd i = tooth tip (h)
  const midY = Math.round(h / 2)
  let pts = `0,0 ${w},0`
  for (let i = teeth; i >= 0; i--) {
    const x = Math.round(i * tw)
    const y = i % 2 === 0 ? midY : h
    pts += ` ${x},${y}`
  }
  pts += ' 0,0'

  return (
    <svg
      className="block w-full"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', marginTop: '-1px' }}
    >
      <polygon points={pts} fill="var(--ms-bg)" />
    </svg>
  )
}

export default function ExpenseSheet({ group, isOpen, onClose, onSave }: Props) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)

    if (isOpen) {
      setMounted(true)
      // Double RAF: paint with -translate-y-full first, then trigger transition to 0
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      )
    } else {
      setVisible(false)
      closeTimer.current = setTimeout(() => setMounted(false), 500)
    }

    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [isOpen])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      {/* Backdrop — fades in below the receipt */}
      <div
        className={`absolute inset-0 bg-[#2c2520]/60 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Receipt panel — drops DOWN from the top of the screen */}
      <div
        className={`absolute inset-x-0 top-0 mx-auto w-full max-w-lg transform transition-transform duration-[450ms] ease-out ${
          visible ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ willChange: 'transform' }}
      >
        {/* Scrollable form area — the receipt "paper" */}
        <div
          className="overflow-y-auto bg-[var(--ms-bg)]"
          style={{ maxHeight: '85dvh' }}
        >
          <div className="px-3 pt-4 pb-3">
            <ExpenseForm
              group={group}
              showModeBadge={false}
              onSave={onSave}
              onCancel={onClose}
            />
          </div>
        </div>

        {/* Torn receipt edge at the bottom */}
        <ReceiptEdgeBottom />
      </div>
    </div>
  )
}
