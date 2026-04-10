import { useState, useEffect, useRef } from 'react'
import { formatMoney } from '../lib/format'
import { getCurrencySymbol } from '../lib/currency'
import { getPersonNameStyle } from '../lib/personTheme'
import type { Group, ItemizedInputMode, SplitMode } from '../types'

export type SplitSheetState = {
  splitMode: SplitMode
  splitPersonIds: string[]
  percentageInput: Record<string, string>
  sharesInput: Record<string, string>
  adjustmentInput: Record<string, string>
  itemizedInput: Record<string, string>
  itemizedInputMode: ItemizedInputMode
  serviceTaxPct: string
  salesTaxPct: string
  tipsPct: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (state: SplitSheetState) => void
  group: Group
  totalAmount: number
  paidCurrency: string
  initial: SplitSheetState
}

const TABS: { id: SplitMode; label: string; title: string; desc: string }[] = [
  {
    id: 'equal',
    label: 'Equally',
    title: 'Split equally',
    desc: 'Select which people owe an equal share.',
  },
  {
    id: 'itemized',
    label: 'Unequally',
    title: 'Split by exact amounts',
    desc: 'Specify exactly how much each person owes.',
  },
  {
    id: 'percentage',
    label: 'By percentages',
    title: 'Split by percentages',
    desc: "Enter the percentage split that's fair for your situation.",
  },
  {
    id: 'shares',
    label: 'By shares',
    title: 'Split by shares',
    desc: 'Great for time-based splitting (2 nights → 2 shares) and splitting across families (family of 3 → 3 shares).',
  },
  {
    id: 'adjustment',
    label: 'By adjustment',
    title: 'Split by adjustment',
    desc: 'Enter adjustments to reflect who owes extra; the remainder is distributed equally.',
  },
]

export default function AdjustSplitSheet({
  isOpen,
  onClose,
  onConfirm,
  group,
  totalAmount,
  paidCurrency,
  initial,
}: Props) {
  const [local, setLocal] = useState<SplitSheetState>(initial)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) setLocal(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const sym = getCurrencySymbol(paidCurrency)
  const amount = totalAmount > 0 ? totalAmount : 0
  const tab = TABS.find((t) => t.id === local.splitMode) ?? TABS[0]

  const selectedPeople = group.people.filter((p) => local.splitPersonIds.includes(p.id))

  const totalTaxPct =
    Number(local.serviceTaxPct || 0) + Number(local.salesTaxPct || 0) + Number(local.tipsPct || 0)
  const taxFactor = totalTaxPct / 100

  const togglePerson = (id: string) => {
    setLocal((prev) => ({
      ...prev,
      splitPersonIds: prev.splitPersonIds.includes(id)
        ? prev.splitPersonIds.filter((pid) => pid !== id)
        : [...prev.splitPersonIds, id],
    }))
  }

  // Switch mode — auto-include all people for non-equal modes
  const switchMode = (mode: SplitMode) => {
    setLocal((prev) => ({
      ...prev,
      splitMode: mode,
      splitPersonIds:
        mode === 'equal' ? prev.splitPersonIds : group.people.map((p) => p.id),
    }))
  }

  // ── Footer ──
  const footer = (() => {
    const n = selectedPeople.length
    if (n === 0) return { primary: 'No one selected', warn: true }

    if (local.splitMode === 'equal') {
      const each = amount > 0 ? amount / n : 0
      return { primary: `${sym}${formatMoney(each)}/person (${n} people)`, warn: false }
    }

    if (local.splitMode === 'itemized') {
      let entered = 0
      for (const pid of local.splitPersonIds) {
        const val = Number(local.itemizedInput[pid] || 0)
        if (Number.isFinite(val) && val >= 0) {
          entered += local.itemizedInputMode === 'pretax' ? val * (1 + taxFactor) : val
        }
      }
      const remaining = amount > 0 ? Number((amount - entered).toFixed(2)) : null
      return {
        primary: `${sym}${formatMoney(entered)} of ${sym}${formatMoney(amount)}`,
        secondary: remaining != null ? `${sym}${formatMoney(Math.abs(remaining))} left` : undefined,
        warn: remaining != null && Math.abs(remaining) > 0.5,
      }
    }

    if (local.splitMode === 'percentage') {
      let total = 0
      for (const pid of local.splitPersonIds) {
        const val = Number(local.percentageInput[pid] || 0)
        if (Number.isFinite(val) && val >= 0) total += val
      }
      const left = Number((100 - total).toFixed(1))
      return {
        primary: `${formatMoney(total, 1)}% of 100%`,
        secondary: `${formatMoney(Math.abs(left), 1)}% left`,
        warn: Math.abs(left) > 0.5,
      }
    }

    if (local.splitMode === 'shares') {
      let totalShares = 0
      for (const pid of local.splitPersonIds) {
        const val = Number(local.sharesInput[pid] || 0)
        if (Number.isFinite(val) && val > 0) totalShares += val
      }
      return {
        primary:
          totalShares > 0
            ? `${formatMoney(totalShares, 0)} total shares`
            : '0 total shares',
        warn: totalShares === 0,
      }
    }

    if (local.splitMode === 'adjustment') {
      const totalAdj = local.splitPersonIds.reduce((sum, pid) => {
        const adj = Number(local.adjustmentInput[pid] || 0)
        return sum + (Number.isFinite(adj) ? adj : 0)
      }, 0)
      const baseEach = n > 0 ? amount / n : 0
      return {
        primary: `${sym}${formatMoney(baseEach)} base/person + adjustments`,
        secondary: totalAdj !== 0 ? `Total adjustment: ${sym}${formatMoney(Math.abs(totalAdj))}` : undefined,
        warn: false,
      }
    }

    return { primary: '', warn: false }
  })()

  if (!isOpen) return null

  const allSelected = local.splitPersonIds.length === group.people.length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative flex w-full max-w-lg flex-col rounded-t-2xl bg-[var(--ms-surface)] shadow-2xl" style={{ maxHeight: '92dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--ms-border)] px-4 py-3">
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ms-text-secondary)] hover:bg-[var(--ms-surface-dim)]"
          >
            ←
          </button>
          <h3 className="text-sm font-semibold text-[var(--ms-text)]">Adjust split</h3>
          <button
            onClick={() => { onConfirm(local); onClose() }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ms-accent)] font-bold text-lg hover:bg-[var(--ms-accent-bg)]"
          >
            ✓
          </button>
        </div>

        {/* Tab bar */}
        <div
          ref={tabsRef}
          className="flex overflow-x-auto border-b border-[var(--ms-border)]"
          style={{ scrollbarWidth: 'none' }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => switchMode(t.id)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                local.splitMode === t.id
                  ? 'border-[var(--ms-accent)] text-[var(--ms-accent)]'
                  : 'border-transparent text-[var(--ms-text-secondary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Description */}
          <div className="px-4 pb-2 pt-4 text-center">
            <p className="text-sm font-semibold text-[var(--ms-text)]">{tab.title}</p>
            <p className="mt-1 text-xs text-[var(--ms-text-secondary)]">{tab.desc}</p>
          </div>

          {/* Select All / None row for equal */}
          {local.splitMode === 'equal' && (
            <div className="flex justify-end gap-4 px-4 py-1">
              <button
                className="text-xs font-medium text-[var(--ms-accent)]"
                onClick={() =>
                  setLocal((prev) => ({
                    ...prev,
                    splitPersonIds: group.people.map((p) => p.id),
                  }))
                }
              >
                Select all
              </button>
              <button
                className="text-xs text-[var(--ms-text-muted)]"
                onClick={() => setLocal((prev) => ({ ...prev, splitPersonIds: [] }))}
              >
                None
              </button>
            </div>
          )}

          {/* Person rows */}
          <div className="px-4 pb-2">
            {group.people.map((person) => {
              const isSelected = local.splitPersonIds.includes(person.id)
              const initial = person.name.slice(0, 1).toUpperCase()

              // Per-person amount preview
              const amountPreview = (() => {
                if (!isSelected || amount <= 0) return null
                if (local.splitMode === 'equal') {
                  const n = selectedPeople.length
                  return n > 0 ? `${sym}${formatMoney(amount / n)}` : null
                }
                if (local.splitMode === 'percentage') {
                  const pct = Number(local.percentageInput[person.id] || 0)
                  return `${sym}${formatMoney(amount * pct / 100)}`
                }
                if (local.splitMode === 'shares') {
                  const myShares = Number(local.sharesInput[person.id] || 0)
                  const totalShares = local.splitPersonIds.reduce(
                    (s, pid) => s + Math.max(0, Number(local.sharesInput[pid] || 0)),
                    0,
                  )
                  return totalShares > 0
                    ? `${sym}${formatMoney(amount * myShares / totalShares)}`
                    : `${sym}0.00`
                }
                if (local.splitMode === 'adjustment') {
                  const n = local.splitPersonIds.length
                  const totalAdj = local.splitPersonIds.reduce((s, pid) => {
                    const a = Number(local.adjustmentInput[pid] || 0)
                    return s + (Number.isFinite(a) ? a : 0)
                  }, 0)
                  const baseEach = n > 0 ? (amount - totalAdj) / n : 0
                  const myAdj = Number(local.adjustmentInput[person.id] || 0)
                  const total = baseEach + (Number.isFinite(myAdj) ? myAdj : 0)
                  return `${sym}${formatMoney(total)}`
                }
                if (local.splitMode === 'itemized') {
                  const val = Number(local.itemizedInput[person.id] || 0)
                  if (!Number.isFinite(val) || val < 0) return null
                  const taxedAmount = local.itemizedInputMode === 'pretax' && taxFactor > 0
                    ? val * (1 + taxFactor)
                    : val
                  return taxFactor > 0 && local.itemizedInputMode === 'pretax'
                    ? `→ ${sym}${formatMoney(taxedAmount)}`
                    : null
                }
                return null
              })()

              return (
                <div
                  key={person.id}
                  className="flex items-center gap-3 border-b border-[var(--ms-border)] py-3 last:border-0"
                >
                  {/* Avatar circle */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      background: 'var(--ms-accent-bg)',
                      color: 'var(--ms-accent)',
                      ...(getPersonNameStyle(person) as React.CSSProperties),
                    }}
                  >
                    {initial}
                  </div>

                  {/* Name + preview amount */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-[var(--ms-text)]"
                      style={getPersonNameStyle(person) as React.CSSProperties}
                    >
                      {person.name}
                    </p>
                    {amountPreview && (
                      <p className="text-xs text-[var(--ms-text-muted)]">{amountPreview}</p>
                    )}
                  </div>

                  {/* Right control */}
                  {local.splitMode === 'equal' ? (
                    <button
                      onClick={() => togglePerson(person.id)}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isSelected
                          ? 'border-[var(--ms-accent)] bg-[var(--ms-accent)] text-white'
                          : 'border-[var(--ms-border)]'
                      }`}
                    >
                      {isSelected && <span className="text-xs leading-none">✓</span>}
                    </button>
                  ) : local.splitMode === 'percentage' ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="h-9 w-16 border-b-2 border-[var(--ms-border)] bg-transparent px-1 text-right text-sm text-[var(--ms-text)] outline-none focus:border-[var(--ms-accent)]"
                        placeholder="0"
                        value={local.percentageInput[person.id] ?? ''}
                        onChange={(e) =>
                          setLocal((prev) => ({
                            ...prev,
                            percentageInput: { ...prev.percentageInput, [person.id]: e.target.value },
                          }))
                        }
                      />
                      <span className="text-sm text-[var(--ms-text-muted)]">%</span>
                    </div>
                  ) : local.splitMode === 'shares' ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="h-9 w-16 border-b-2 border-[var(--ms-border)] bg-transparent px-1 text-right text-sm text-[var(--ms-text)] outline-none focus:border-[var(--ms-accent)]"
                        placeholder="0"
                        value={local.sharesInput[person.id] ?? ''}
                        onChange={(e) =>
                          setLocal((prev) => ({
                            ...prev,
                            sharesInput: { ...prev.sharesInput, [person.id]: e.target.value },
                          }))
                        }
                      />
                      <span className="text-xs text-[var(--ms-text-muted)]">shares</span>
                    </div>
                  ) : local.splitMode === 'adjustment' ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-sm font-medium text-[var(--ms-text-muted)]">+</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="h-9 w-20 border-b-2 border-[var(--ms-border)] bg-transparent px-1 text-right text-sm text-[var(--ms-text)] outline-none focus:border-[var(--ms-accent)]"
                        placeholder="0.00"
                        value={local.adjustmentInput[person.id] ?? ''}
                        onChange={(e) =>
                          setLocal((prev) => ({
                            ...prev,
                            adjustmentInput: { ...prev.adjustmentInput, [person.id]: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ) : local.splitMode === 'itemized' ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-[var(--ms-text-muted)]">{sym}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="h-9 w-24 border-b-2 border-[var(--ms-border)] bg-transparent px-1 text-right text-sm text-[var(--ms-text)] outline-none focus:border-[var(--ms-accent)]"
                        placeholder="0.00"
                        value={local.itemizedInput[person.id] ?? ''}
                        onChange={(e) =>
                          setLocal((prev) => ({
                            ...prev,
                            itemizedInput: { ...prev.itemizedInput, [person.id]: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* Itemized tax fields */}
          {local.splitMode === 'itemized' && (
            <div className="mx-4 mb-4 space-y-2 rounded-xl border border-[var(--ms-border)] p-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="h-9 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-surface)] px-2 text-sm text-[var(--ms-text)] outline-none"
                  value={local.itemizedInputMode}
                  onChange={(e) =>
                    setLocal((prev) => ({
                      ...prev,
                      itemizedInputMode: e.target.value as ItemizedInputMode,
                    }))
                  }
                >
                  <option value="pretax">Input pre-tax</option>
                  <option value="total">Input total (incl. tax)</option>
                </select>
                <input
                  className="h-9 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-surface)] px-2 text-sm text-[var(--ms-text)] outline-none"
                  placeholder="Service tax %"
                  value={local.serviceTaxPct}
                  onChange={(e) => setLocal((prev) => ({ ...prev, serviceTaxPct: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-9 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-surface)] px-2 text-sm text-[var(--ms-text)] outline-none"
                  placeholder="Sales tax %"
                  value={local.salesTaxPct}
                  onChange={(e) => setLocal((prev) => ({ ...prev, salesTaxPct: e.target.value }))}
                />
                <input
                  className="h-9 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-surface)] px-2 text-sm text-[var(--ms-text)] outline-none"
                  placeholder="Tips %"
                  value={local.tipsPct}
                  onChange={(e) => setLocal((prev) => ({ ...prev, tipsPct: e.target.value }))}
                />
              </div>
              <p className="text-xs text-[var(--ms-text-muted)]">
                Total tax: {formatMoney(totalTaxPct)}%
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between border-t px-4 py-3 ${
            footer.warn
              ? 'border-[var(--ms-danger)] bg-[var(--ms-danger-bg)]'
              : 'border-[var(--ms-border)]'
          }`}
        >
          <div>
            <p
              className={`text-sm font-semibold ${
                footer.warn ? 'text-[var(--ms-danger)]' : 'text-[var(--ms-text)]'
              }`}
            >
              {footer.primary}
            </p>
            {'secondary' in footer && footer.secondary && (
              <p className="text-xs text-[var(--ms-text-muted)]">{footer.secondary}</p>
            )}
          </div>

          {/* "All" toggle — only for equal mode */}
          {local.splitMode === 'equal' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--ms-text-muted)]">All</span>
              <button
                onClick={() =>
                  setLocal((prev) => ({
                    ...prev,
                    splitPersonIds: allSelected ? [] : group.people.map((p) => p.id),
                  }))
                }
                className={`flex h-6 w-6 items-center justify-center rounded border-2 transition-colors ${
                  allSelected
                    ? 'border-[var(--ms-accent)] bg-[var(--ms-accent)] text-white'
                    : 'border-[var(--ms-border)]'
                }`}
              >
                {allSelected && <span className="text-xs leading-none">✓</span>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
