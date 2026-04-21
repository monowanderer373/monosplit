import { useEffect, useState } from 'react'
import { formatMoney } from '../lib/format'
import { getCurrencySymbol } from '../lib/currency'
import { getPersonNameStyle } from '../lib/personTheme'
import { calcReceiptGrandTotal, calcReceiptSubtotal, getReceiptItemAmount } from '../lib/splitCalc'
import { useT } from '../lib/i18n'
import type { Group, ItemizedInputMode, SplitMode } from '../types'
import type { ReceiptItemInput, SplitSheetState } from './AdjustSplitSheet'

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
  {
    id: 'receipt',
    label: 'Receipt',
    title: 'Split by receipt',
    desc: 'Add line items and choose who owes each item.',
  },
]

const SPLIT_LABELS: Record<SplitMode, string> = {
  equal: 'Equally',
  itemized: 'Unequally',
  percentage: 'By percentages',
  shares: 'By shares',
  adjustment: 'By adjustment',
  receipt: 'By receipt',
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
  const t = useT()
  const [open, setOpen] = useState(false)
  const [openReceiptItemId, setOpenReceiptItemId] = useState<string | null>(null)
  const [peoplePickerItemId, setPeoplePickerItemId] = useState<string | null>(null)

  const sym = getCurrencySymbol(paidCurrency)
  const amount = totalAmount > 0 ? totalAmount : 0
  const currentTab = TABS.find((t) => t.id === state.splitMode) ?? TABS[0]

  const totalTaxPct =
    Number(state.serviceTaxPct || 0) +
    Number(state.salesTaxPct || 0) +
    Number(state.tipsPct || 0)
  const taxFactor = totalTaxPct / 100
  const receiptItems = state.receiptItems ?? []
  const parsedReceiptItems = receiptItems.map((item) => {
    const unitPrice = item.unitPrice.trim() === '' ? null : Number(item.unitPrice)
    const quantity = item.quantity.trim() === '' ? null : Number(item.quantity)
    return {
      ...item,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
      quantity: Number.isFinite(quantity) ? quantity : null,
    }
  })
  const receiptSubtotal = calcReceiptSubtotal(
    parsedReceiptItems.map((item) => ({
      ...item,
      amount: null,
    })),
  )
  const receiptTaxAmountRaw = Number(state.receiptTaxAmount || 0)
  const receiptTaxAmount = Number.isFinite(receiptTaxAmountRaw) && receiptTaxAmountRaw > 0 ? receiptTaxAmountRaw : 0
  const receiptGrandTotal = calcReceiptGrandTotal(
    parsedReceiptItems.map((item) => ({
      ...item,
      amount: null,
    })),
    receiptTaxAmount,
  )

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

  const updateReceiptItem = (itemId: string, patch: Partial<ReceiptItemInput>) =>
    set({
      receiptItems: state.receiptItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    })

  const toggleReceiptDebtor = (itemId: string, personId: string) => {
    const item = state.receiptItems.find((entry) => entry.id === itemId)
    if (!item) return
    const has = item.debtorIds.includes(personId)
    updateReceiptItem(itemId, {
      debtorIds: has ? item.debtorIds.filter((id) => id !== personId) : [...item.debtorIds, personId],
    })
  }

  useEffect(() => {
    if (state.splitMode !== 'receipt') {
      setOpenReceiptItemId(null)
      setPeoplePickerItemId(null)
      return
    }

    const firstItemId = state.receiptItems[0]?.id ?? null
    setOpenReceiptItemId((prev) =>
      prev && state.receiptItems.some((item) => item.id === prev) ? prev : firstItemId,
    )
    setPeoplePickerItemId((prev) =>
      prev && state.receiptItems.some((item) => item.id === prev) ? prev : null,
    )
  }, [state.receiptItems, state.splitMode])

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
    if (state.splitMode === 'receipt') {
      const remaining = amount > 0 ? Number((amount - receiptGrandTotal).toFixed(2)) : null
      return {
        text: `${sym}${formatMoney(receiptGrandTotal)} ${t('expense.receiptGrandTotal').toLowerCase()}`,
        sub:
          receiptItems.length > 0
            ? `${receiptItems.length} item(s) · ${sym}${formatMoney(receiptTaxAmount)} tax`
            : '',
        warn: remaining != null && Math.abs(remaining) > 0.5,
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
            {state.splitMode !== 'receipt' && (
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
                  if (state.splitMode === 'receipt') return null
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
                    ) : state.splitMode === 'receipt' ? null : null}
                  </div>
                )
              })}
            </div>
            )}

            {state.splitMode === 'receipt' && (
              <div className="mx-4 mb-3 space-y-3">
                {state.receiptItems.map((item, index) => {
                  const parsedItem = parsedReceiptItems.find((entry) => entry.id === item.id)
                  const lineAmount = parsedItem
                    ? getReceiptItemAmount({
                        unitPrice: parsedItem.unitPrice,
                        quantity: parsedItem.quantity,
                        amount: null,
                      })
                    : 0
                  const isOpen = openReceiptItemId === item.id
                  const pickerOpen = peoplePickerItemId === item.id
                  const debtorNames = item.debtorIds
                    .map((personId) => group.people.find((person) => person.id === personId)?.name)
                    .filter(Boolean)
                    .join(', ')
                  const title = item.name.trim() || t('expense.receiptUntitled')
                  const isComplete = item.name.trim() !== '' && lineAmount > 0 && item.debtorIds.length > 0

                  return (
                    <div key={item.id} className="border border-[var(--ms-border)] bg-[var(--ms-surface)]">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
                        onClick={() => {
                          setOpenReceiptItemId((prev) => (prev === item.id ? null : item.id))
                          if (isOpen) setPeoplePickerItemId(null)
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">
                            {t('expense.receiptItem')} {index + 1}
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-[var(--ms-text)]">
                            {title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--ms-text-muted)]">
                            <span>{t('expense.receiptLineTotal')}: {sym}{formatMoney(lineAmount)}</span>
                            <span>{item.debtorIds.length} {t('expense.persons')}</span>
                            {debtorNames ? <span className="truncate">{debtorNames}</span> : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isComplete ? (
                            <span className="text-[10px] font-semibold text-[var(--ms-success)]">✓</span>
                          ) : null}
                          <span className="text-xs text-[var(--ms-text-muted)]">{isOpen ? '▴' : '▾'}</span>
                        </div>
                      </button>

                      {isOpen ? (
                        <div className="space-y-3 border-t border-[var(--ms-border)] px-3 py-3">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              className="text-xs text-[var(--ms-danger,#c0392b)]"
                              onClick={() => {
                                set({
                                  receiptItems:
                                    state.receiptItems.length > 1
                                      ? state.receiptItems.filter((entry) => entry.id !== item.id)
                                      : state.receiptItems.map((entry) =>
                                          entry.id === item.id
                                            ? { ...entry, name: '', unitPrice: '', quantity: '1', debtorIds: [] }
                                            : entry,
                                        ),
                                })
                                setPeoplePickerItemId((prev) => (prev === item.id ? null : prev))
                              }}
                            >
                              {t('expense.receiptRemoveItem')}
                            </button>
                          </div>

                          <input
                            className="ms-input w-full text-sm"
                            placeholder={t('expense.receiptItemName')}
                            value={item.name}
                            onChange={(e) => updateReceiptItem(item.id, { name: e.target.value })}
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[11px] text-[var(--ms-text-muted)]">
                                {t('expense.receiptUnitPrice')}
                              </label>
                              <input
                                className="ms-input w-full text-sm"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={item.unitPrice}
                                onChange={(e) => updateReceiptItem(item.id, { unitPrice: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-[var(--ms-text-muted)]">
                                {t('expense.receiptQty')}
                              </label>
                              <input
                                className="ms-input w-full text-sm"
                                inputMode="decimal"
                                placeholder="1"
                                value={item.quantity}
                                onChange={(e) => updateReceiptItem(item.id, { quantity: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="rounded-lg bg-[var(--ms-surface-dim)] px-3 py-2 text-xs text-[var(--ms-text-muted)]">
                            {t('expense.receiptLineTotal')}: <span className="font-semibold text-[var(--ms-text)]">{sym}{formatMoney(lineAmount)}</span>
                          </div>

                          <div className="space-y-2">
                            <button
                              type="button"
                              className="ms-btn-ghost flex w-full items-center justify-between px-3 py-2 text-left text-xs"
                              onClick={() => setPeoplePickerItemId((prev) => (prev === item.id ? null : item.id))}
                            >
                              <span>{t('expense.receiptChoosePeople')}</span>
                              <span className="text-[var(--ms-text-muted)]">
                                {item.debtorIds.length > 0
                                  ? `${item.debtorIds.length} ${t('expense.persons')}`
                                  : t('expense.receiptNoPeopleSelected')}
                              </span>
                            </button>

                            {pickerOpen ? (
                              <div className="flex flex-wrap gap-2 border border-[var(--ms-border)] bg-[var(--ms-bg-warm)] p-2">
                                {group.people.map((person) => {
                                  const active = item.debtorIds.includes(person.id)
                                  return (
                                    <button
                                      key={`${item.id}-${person.id}`}
                                      type="button"
                                      className={`ms-chip ${active ? 'ms-chip-active-indigo' : 'border-[#d8d0c4] text-[#6b6058]'}`}
                                      style={active ? getPersonNameStyle(person) : undefined}
                                      onClick={() => toggleReceiptDebtor(item.id, person.id)}
                                    >
                                      {active ? '✓ ' : ''}{person.name}
                                    </button>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}

                <button
                  type="button"
                  className="ms-btn-ghost w-full"
                  onClick={() =>
                    {
                      const nextItem = {
                        id: `receipt-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        name: '',
                        unitPrice: '',
                        quantity: '1',
                        debtorIds: group.people.length > 0 ? [group.people[0].id] : [],
                      }
                      set({
                        receiptItems: [
                          ...state.receiptItems,
                          nextItem,
                        ],
                      })
                      setOpenReceiptItemId(nextItem.id)
                      setPeoplePickerItemId(null)
                    }
                  }
                >
                  + {t('expense.receiptAddItem')}
                </button>

                <div className="space-y-2 border border-[var(--ms-border)] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-[var(--ms-text-muted)]">
                        {t('expense.receiptTaxAmount')}
                      </label>
                      <input
                        className="ms-input w-full text-sm"
                        inputMode="decimal"
                        placeholder={t('expense.optional')}
                        value={state.receiptTaxAmount}
                        onChange={(e) => set({ receiptTaxAmount: e.target.value })}
                      />
                    </div>
                    <div className="rounded-lg bg-[var(--ms-surface-dim)] px-3 py-2 text-xs text-[var(--ms-text-muted)]">
                      {t('expense.receiptNoTax')}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-[var(--ms-surface-dim)] px-3 py-2">
                      <div className="text-[var(--ms-text-muted)]">{t('expense.receiptSubtotal')}</div>
                      <div className="mt-1 font-semibold text-[var(--ms-text)]">{sym}{formatMoney(receiptSubtotal)}</div>
                    </div>
                    <div className="rounded-lg bg-[var(--ms-surface-dim)] px-3 py-2">
                      <div className="text-[var(--ms-text-muted)]">{t('expense.tax')}</div>
                      <div className="mt-1 font-semibold text-[var(--ms-text)]">{sym}{formatMoney(receiptTaxAmount)}</div>
                    </div>
                    <div className="rounded-lg bg-[var(--ms-surface-dim)] px-3 py-2">
                      <div className="text-[var(--ms-text-muted)]">{t('expense.receiptGrandTotal')}</div>
                      <div className="mt-1 font-semibold text-[var(--ms-text)]">{sym}{formatMoney(receiptGrandTotal)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
