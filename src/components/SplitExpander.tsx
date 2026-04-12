import { useState } from 'react'
import { formatMoney } from '../lib/format'
import { getCurrencySymbol } from '../lib/currency'
import { getPersonNameStyle } from '../lib/personTheme'
import type { Group, ItemizedInputMode, SplitMode } from '../types'
import type { SplitSheetState } from './AdjustSplitSheet'

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
    label: 'By %',
    title: 'Split by percentages',
    desc: "Enter the percentage split for each person.",
  },
  {
    id: 'shares',
    label: 'By shares',
    title: 'Split by shares',
    desc: 'Great for time-based or family-size splitting.',
  },
  {
    id: 'adjustment',
    label: 'Adjust',
    title: 'Split by adjustment',
    desc: 'Equal base + per-person adjustments for extras.',
  },
]

const SPLIT_LABELS: Record<SplitMode, string> = {
  equal: 'Equally',
  itemized: 'Unequally',
  percentage: 'By percentages',
  shares: 'By shares',
  adjustment: 'By adjustment',
}

type Props = {
  state: SplitSheetState
  onChange: (next: SplitSheetState) => void
  group: Group
  totalAmount: number
  paidCurrency: string
}

export default function SplitExpander({
  state,
  onChange,
  group,
  totalAmount,
  paidCurrency,
}: Props) {
  const [open, setOpen] = useState(false)

  const sym = getCurrencySymbol(paidCurrency)
  const amount = totalAmount > 0 ? totalAmount : 0
  const currentTab = TABS.find((t) => t.id === state.splitMode) ?? TABS[0]

  const totalTaxPct =
    Number(state.serviceTaxPct || 0) +
    Number(state.salesTaxPct || 0) +
    Number(state.tipsPct || 0)
  const taxFactor = totalTaxPct / 100

  const selectedPeople = group.people.filter((p) =>
    state.splitPersonIds.includes(p.id),
  )
  const allSelected = state.splitPersonIds.length === group.people.length

  const set = (patch: Partial<SplitSheetState>) =>
    onChange({ ...state, ...patch })

  const switchMode = (mode: SplitMode) =>
    set({
      splitMode: mode,
      splitPersonIds:
        mode === 'equal' ? state.splitPersonIds : group.people.map((p) => p.id),
    })

  const togglePerson = (id: string) =>
    set({
      splitPersonIds: state.splitPersonIds.includes(id)
        ? state.splitPersonIds.filter((pid) => pid !== id)
        : [...state.splitPersonIds, id],
    })

  // ── Footer summary ──────────────────────────────────────────────────────────
  const footer = (() => {
    const n = selectedPeople.length
    if (n === 0) return { text: 'No one selected', warn: true, sub: '' }

    if (state.splitMode === 'equal') {
      const each = amount > 0 ? amount / n : 0
      return {
        text: `${sym}${formatMoney(each)} / person`,
        sub: `${n} people`,
        warn: false,
      }
    }
    if (state.splitMode === 'itemized') {
      let entered = 0
      for (const pid of state.splitPersonIds) {
        const val = Number(state.itemizedInput[pid] || 0)
        if (Number.isFinite(val) && val >= 0)
          entered +=
            state.itemizedInputMode === 'pretax' ? val * (1 + taxFactor) : val
      }
      const remaining = amount > 0 ? Number((amount - entered).toFixed(2)) : null
      return {
        text: `${sym}${formatMoney(entered)} of ${sym}${formatMoney(amount)}`,
        sub:
          remaining != null
            ? `${sym}${formatMoney(Math.abs(remaining))} remaining`
            : '',
        warn: remaining != null && Math.abs(remaining) > 0.5,
      }
    }
    if (state.splitMode === 'percentage') {
      let total = 0
      for (const pid of state.splitPersonIds)
        total += Number(state.percentageInput[pid] || 0)
      const left = Number((100 - total).toFixed(1))
      return {
        text: `${formatMoney(total, 1)}% of 100%`,
        sub: `${formatMoney(Math.abs(left), 1)}% remaining`,
        warn: Math.abs(left) > 0.5,
      }
    }
    if (state.splitMode === 'shares') {
      let totalShares = 0
      for (const pid of state.splitPersonIds)
        totalShares += Math.max(0, Number(state.sharesInput[pid] || 0))
      return {
        text:
          totalShares > 0
            ? `${formatMoney(totalShares, 0)} total shares`
            : '0 total shares',
        sub: `${n} people`,
        warn: totalShares === 0,
      }
    }
    if (state.splitMode === 'adjustment') {
      const totalAdj = state.splitPersonIds.reduce((sum, pid) => {
        const a = Number(state.adjustmentInput[pid] || 0)
        return sum + (Number.isFinite(a) ? a : 0)
      }, 0)
      const baseEach = n > 0 ? amount / n : 0
      return {
        text: `${sym}${formatMoney(baseEach)} base / person`,
        sub:
          totalAdj !== 0
            ? `+ ${sym}${formatMoney(Math.abs(totalAdj))} adjustments`
            : `${n} people`,
        warn: false,
      }
    }
    return { text: '', sub: '', warn: false }
  })()

  return (
    <div className="lg:col-span-2">
      {/* ── Trigger row ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`ms-key flex h-11 w-full items-center justify-between px-4 text-sm transition-colors ${
          open ? 'ms-nav-active' : ''
        }`}
      >
        <span>
          <span className={open ? 'text-[#faf8f4]/70' : 'text-[var(--ms-text-muted)]'}>
            Split:{' '}
          </span>
          <span className={`font-semibold ${open ? 'text-[#faf8f4]' : 'text-[var(--ms-text)]'}`}>
            {SPLIT_LABELS[state.splitMode]}
          </span>
        </span>
        <span className={`text-xs font-medium ${open ? 'text-[#faf8f4]/80' : 'text-[var(--ms-text-muted)]'}`}>
          {open ? '▴ Done' : '▾ Adjust'}
        </span>
      </button>

      {/* ── Expanding panel (CodePen grid trick) ────────────────────────────── */}
      <div className={`ms-split-grid ${open ? 'ms-split-grid--open' : ''}`}>
        <div className="ms-split-inner">
          <div className="ms-split-content">

            {/* Tab bar */}
            <div
              className="flex overflow-x-auto border-b border-[var(--ms-border)]"
              style={{ scrollbarWidth: 'none' }}
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => switchMode(t.id)}
                  className={`ms-split-tab ${state.splitMode === t.id ? 'active' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Mode description */}
            <div className="px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text)]">
                {currentTab.title}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--ms-text-muted)]">
                {currentTab.desc}
              </p>
            </div>

            {/* Select all / None (equal mode only) */}
            {state.splitMode === 'equal' && (
              <div className="flex justify-end gap-4 px-4 pb-1">
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--ms-accent)]"
                  onClick={() =>
                    set({ splitPersonIds: group.people.map((p) => p.id) })
                  }
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-xs text-[var(--ms-text-muted)]"
                  onClick={() => set({ splitPersonIds: [] })}
                >
                  None
                </button>
              </div>
            )}

            {/* People rows */}
            <div className="px-4 pb-1">
              {group.people.map((person) => {
                const isSelected = state.splitPersonIds.includes(person.id)
                const initial = person.name.slice(0, 1).toUpperCase()

                const amountPreview = (() => {
                  if (!isSelected || amount <= 0) return null
                  if (state.splitMode === 'equal') {
                    const n = selectedPeople.length
                    return n > 0 ? `${sym}${formatMoney(amount / n)}` : null
                  }
                  if (state.splitMode === 'percentage') {
                    const pct = Number(state.percentageInput[person.id] || 0)
                    return `${sym}${formatMoney((amount * pct) / 100)}`
                  }
                  if (state.splitMode === 'shares') {
                    const my = Number(state.sharesInput[person.id] || 0)
                    const tot = state.splitPersonIds.reduce(
                      (s, pid) =>
                        s + Math.max(0, Number(state.sharesInput[pid] || 0)),
                      0,
                    )
                    return tot > 0
                      ? `${sym}${formatMoney((amount * my) / tot)}`
                      : `${sym}0.00`
                  }
                  if (state.splitMode === 'adjustment') {
                    const n = state.splitPersonIds.length
                    const totalAdj = state.splitPersonIds.reduce((s, pid) => {
                      const a = Number(state.adjustmentInput[pid] || 0)
                      return s + (Number.isFinite(a) ? a : 0)
                    }, 0)
                    const base = n > 0 ? (amount - totalAdj) / n : 0
                    const myAdj = Number(state.adjustmentInput[person.id] || 0)
                    return `${sym}${formatMoney(base + (Number.isFinite(myAdj) ? myAdj : 0))}`
                  }
                  if (state.splitMode === 'itemized') {
                    const val = Number(state.itemizedInput[person.id] || 0)
                    if (!Number.isFinite(val) || val < 0) return null
                    if (taxFactor > 0 && state.itemizedInputMode === 'pretax')
                      return `→ ${sym}${formatMoney(val * (1 + taxFactor))}`
                    return null
                  }
                  return null
                })()

                return (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 border-b border-[var(--ms-border)] py-2.5 last:border-0"
                  >
                    {/* Avatar */}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold"
                      style={{
                        background: 'var(--ms-accent-bg)',
                        color: 'var(--ms-accent)',
                        ...(getPersonNameStyle(person) as React.CSSProperties),
                      }}
                    >
                      {initial}
                    </div>

                    {/* Name + preview */}
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium text-[var(--ms-text)]"
                        style={getPersonNameStyle(person) as React.CSSProperties}
                      >
                        {person.name}
                      </p>
                      {amountPreview && (
                        <p className="text-[11px] text-[var(--ms-text-muted)]">
                          {amountPreview}
                        </p>
                      )}
                    </div>

                    {/* Right control */}
                    {state.splitMode === 'equal' ? (
                      <button
                        type="button"
                        onClick={() => togglePerson(person.id)}
                        className={`ms-key flex h-6 w-6 shrink-0 items-center justify-center border-2 transition-colors ${
                          isSelected
                            ? 'border-[var(--ms-accent)] bg-[var(--ms-accent)] text-white'
                            : 'border-[var(--ms-border)]'
                        }`}
                      >
                        {isSelected && (
                          <span className="text-[10px] leading-none">✓</span>
                        )}
                      </button>
                    ) : state.splitMode === 'percentage' ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="h-8 w-14 border-b-2 border-[var(--ms-border)] bg-transparent px-1 text-right text-sm text-[var(--ms-text)] outline-none focus:border-[var(--ms-accent)]"
                          placeholder="0"
                          value={state.percentageInput[person.id] ?? ''}
                          onChange={(e) =>
                            set({
                              percentageInput: {
                                ...state.percentageInput,
                                [person.id]: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="text-xs text-[var(--ms-text-muted)]">%</span>
                      </div>
                    ) : state.splitMode === 'shares' ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="h-8 w-14 border-b-2 border-[var(--ms-border)] bg-transparent px-1 text-right text-sm text-[var(--ms-text)] outline-none focus:border-[var(--ms-accent)]"
                          placeholder="0"
                          value={state.sharesInput[person.id] ?? ''}
                          onChange={(e) =>
                            set({
                              sharesInput: {
                                ...state.sharesInput,
                                [person.id]: e.target.value,
                              },
                            })
                          }
                        />
                        <span className="text-[10px] text-[var(--ms-text-muted)]">
                          shares
                        </span>
                      </div>
                    ) : state.splitMode === 'adjustment' ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-sm text-[var(--ms-text-muted)]">+</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="h-8 w-18 border-b-2 border-[var(--ms-border)] bg-transparent px-1 text-right text-sm text-[var(--ms-text)] outline-none focus:border-[var(--ms-accent)]"
                          placeholder="0.00"
                          value={state.adjustmentInput[person.id] ?? ''}
                          onChange={(e) =>
                            set({
                              adjustmentInput: {
                                ...state.adjustmentInput,
                                [person.id]: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    ) : state.splitMode === 'itemized' ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs text-[var(--ms-text-muted)]">{sym}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="h-8 w-20 border-b-2 border-[var(--ms-border)] bg-transparent px-1 text-right text-sm text-[var(--ms-text)] outline-none focus:border-[var(--ms-accent)]"
                          placeholder="0.00"
                          value={state.itemizedInput[person.id] ?? ''}
                          onChange={(e) =>
                            set({
                              itemizedInput: {
                                ...state.itemizedInput,
                                [person.id]: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {/* Itemized tax fields */}
            {state.splitMode === 'itemized' && (
              <div className="mx-4 mb-3 space-y-2 border border-[var(--ms-border)] p-3">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="ms-input text-xs"
                    value={state.itemizedInputMode}
                    onChange={(e) =>
                      set({
                        itemizedInputMode: e.target.value as ItemizedInputMode,
                      })
                    }
                  >
                    <option value="pretax">Pre-tax input</option>
                    <option value="total">Total (incl. tax)</option>
                  </select>
                  <input
                    className="ms-input text-xs"
                    placeholder="Service tax %"
                    value={state.serviceTaxPct}
                    onChange={(e) => set({ serviceTaxPct: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="ms-input text-xs"
                    placeholder="Sales tax %"
                    value={state.salesTaxPct}
                    onChange={(e) => set({ salesTaxPct: e.target.value })}
                  />
                  <input
                    className="ms-input text-xs"
                    placeholder="Tips %"
                    value={state.tipsPct}
                    onChange={(e) => set({ tipsPct: e.target.value })}
                  />
                </div>
                <p className="text-[11px] text-[var(--ms-text-muted)]">
                  Total tax: {formatMoney(totalTaxPct)}%
                </p>
              </div>
            )}

            {/* Footer summary row */}
            <div
              className={`flex items-center justify-between border-t px-4 py-2.5 ${
                footer.warn
                  ? 'border-[var(--ms-danger,#c0392b)] bg-[rgba(192,57,43,0.06)]'
                  : 'border-[var(--ms-border)]'
              }`}
            >
              <div>
                <p
                  className={`text-xs font-semibold ${
                    footer.warn
                      ? 'text-[var(--ms-danger,#c0392b)]'
                      : 'text-[var(--ms-text)]'
                  }`}
                >
                  {footer.text}
                </p>
                {footer.sub && (
                  <p className="text-[11px] text-[var(--ms-text-muted)]">
                    {footer.sub}
                  </p>
                )}
              </div>

              {/* All toggle for equal mode */}
              {state.splitMode === 'equal' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--ms-text-muted)]">All</span>
                  <button
                    type="button"
                    onClick={() =>
                      set({
                        splitPersonIds: allSelected
                          ? []
                          : group.people.map((p) => p.id),
                      })
                    }
                    className={`ms-key flex h-6 w-6 items-center justify-center border-2 transition-colors ${
                      allSelected
                        ? 'border-[var(--ms-accent)] bg-[var(--ms-accent)] text-white'
                        : 'border-[var(--ms-border)]'
                    }`}
                  >
                    {allSelected && (
                      <span className="text-[10px] leading-none">✓</span>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
