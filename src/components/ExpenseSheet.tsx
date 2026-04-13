import { useEffect, useRef, useState } from 'react'
import ExpenseForm from './ExpenseForm'
import type { Group, Expense } from '../types'

type Props = {
  group: Group
  isOpen: boolean
  onClose: () => void
  onSave: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
}

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
  // Prevents the backdrop from being tappable for 500 ms after open.
  // Fixes the "ghost click" bug: on mobile, pointerdown opens the sheet, then the
  // browser fires a click event at the same coordinates which would hit the backdrop
  // and immediately close the sheet — causing the flash/bounce effect.
  const [backdropActive, setBackdropActive] = useState(false)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
    return t
  }

  useEffect(() => {
    clearTimers()
    if (isOpen) {
      setBackdropActive(false)
      setMounted(true)
      later(() => setVisible(true), 20)
      // Only allow backdrop-close after animation completes + a 100 ms buffer
      later(() => setBackdropActive(true), 520)
    } else {
      setBackdropActive(false)
      setVisible(false)
      later(() => setMounted(false), 480)
    }
    return clearTimers
  }, [isOpen])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      // Block all scroll/touch events from reaching the body beneath the overlay
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop — only closes after backdropActive */}
      <div
        className={`absolute inset-0 bg-[#2c2520]/60 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={backdropActive ? onClose : undefined}
      />

      {/* Receipt panel — drops from top.
          Uses translate3d (not Tailwind transform utilities) so iOS Safari
          promotes the layer to a GPU compositor track and animates at 60 fps. */}
      <div
        className="absolute inset-x-0 top-0 mx-auto w-full max-w-lg"
        style={{
          transform: visible ? 'translate3d(0,0,0)' : 'translate3d(0,-100%,0)',
          transition: visible
            ? 'transform 460ms cubic-bezier(0.32,0.72,0,1)'
            : 'transform 400ms cubic-bezier(0.55,0,1,0.45)',
          willChange: 'transform',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable form */}
        <div
          className="overflow-y-auto bg-[var(--ms-bg)]"
          style={{
            // svh = small viewport height — stable, never changes when keyboard
            // opens or browser chrome shows/hides (unlike dvh which caused the flash)
            maxHeight: 'min(92svh, 92vh)',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
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

        <ReceiptEdgeBottom />
      </div>
    </div>
  )
}
