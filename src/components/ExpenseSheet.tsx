import { useEffect, useRef, useState } from 'react'
import ExpenseForm from './ExpenseForm'
import type { Group, Expense } from '../types'

type Props = {
  group: Group
  isOpen: boolean
  onClose: () => void
  onSave: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
}

// Zigzag SVG edge at the BOTTOM of the receipt — teeth pointing downward
function ReceiptEdgeBottom() {
  const teeth = 24
  const w = 480
  const h = 22
  const tw = w / teeth
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
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (openTimer.current) clearTimeout(openTimer.current)

    if (isOpen) {
      setMounted(true)
      // Use setTimeout instead of double-RAF — more reliable on mobile Chrome
      openTimer.current = setTimeout(() => setVisible(true), 20)
    } else {
      setVisible(false)
      closeTimer.current = setTimeout(() => setMounted(false), 480)
    }

    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      if (openTimer.current) clearTimeout(openTimer.current)
    }
  }, [isOpen])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      // Prevent body scroll bleed-through on iOS
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-[#2c2520]/60 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Receipt panel — drops down from the top */}
      <div
        className={`absolute inset-x-0 top-0 mx-auto w-full max-w-lg transition-transform duration-[450ms] ease-out ${
          visible ? 'translate-y-0' : '-translate-y-full'
        }`}
        // Isolate GPU layer; no inline transform override so Tailwind classes win
        style={{ willChange: 'transform' }}
        // Stop clicks on the panel from reaching the backdrop below
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable form — "paper" of the receipt */}
        <div
          className="overflow-y-auto bg-[var(--ms-bg)]"
          style={{
            // svh = "small viewport height" — stable, does NOT change when the
            // mobile keyboard opens or the browser chrome shows/hides.
            // dvh was the culprit: it recomputed on every scroll causing constant flashing.
            maxHeight: 'min(85svh, 85vh)',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            // Only allow vertical panning inside the form, not the outer page
            touchAction: 'pan-y',
          }}
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

        {/* Torn receipt edge */}
        <ReceiptEdgeBottom />
      </div>
    </div>
  )
}
