import { useEffect, useMemo, useRef, useState } from 'react'
import { getCurrencySymbol } from '../lib/currency'
import { formatMoney } from '../lib/format'
import { tCategory, useT } from '../lib/i18n'
import {
  createSettlementSnapshot,
  createGroupSettlementSnapshot,
  isSplitFullySettledFromSnapshot,
} from '../lib/settlementLedger'
import { useStore } from '../store/useStore'
import type { Expense, Group } from '../types'
import { EXPENSE_CATEGORIES, normalizeCategory } from '../lib/categories'
import CategoryIcon from './CategoryIcon'
import ExpenseDetailSheet from './ExpenseDetailSheet'
import ExpenseForm from './ExpenseForm'

type CategoryFilter = 'All' | (typeof EXPENSE_CATEGORIES)[number]

type Props = {
  group: Group
  onDeleteExpense: (expenseId: string) => void
  onEditExpense: (expenseId: string, updates: Partial<Expense>) => void
  canEdit?: boolean
  myPersonId?: string | null
}

/** Refunds are stored as positive amounts but reduce what the trip spent. */
function signedAmount(expense: Expense): number {
  return expense.type === 'refund' ? -expense.amount : expense.amount
}

function addTo(totals: Record<string, number>, currency: string, amount: number) {
  totals[currency] = (totals[currency] ?? 0) + amount
}

export default function SummaryTab({
  group,
  onDeleteExpense,
  onEditExpense,
  canEdit = true,
  myPersonId,
}: Props) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [openExpenseId, setOpenExpenseId] = useState<string | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [menu, setMenu] = useState<'none' | 'category' | 'day'>('none')
  const menuRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (menu === 'none') return
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu('none')
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  const formatDateLabel = (isoDate: string): string => {
    if (!isoDate || isoDate === 'No date') return t('summary.noDate')
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10)
    if (isoDate === todayStr) return t('summary.today')
    if (isoDate === yesterday) return t('summary.yesterday')
    const parsed = new Date(`${isoDate}T00:00:00`)
    return parsed.toLocaleDateString(lang === 'zh' ? 'zh-CN' : undefined, {
      month: 'short',
      day: 'numeric',
      year: parsed.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    })
  }

  const snapshot = useMemo(() => createGroupSettlementSnapshot(group), [group])

  const settledExpenseIds = useMemo(() => {
    const ids = new Set<string>()
    for (const expense of group.expenses) {
      const payerIds = expense.payerIds ?? []
      const debtorIndexes = expense.splits
        .map((split, index) => ({ split, index }))
        .filter(({ split }) => !payerIds.includes(split.personId))
      if (debtorIndexes.length === 0) continue
      const allSettled = debtorIndexes.every(({ index }) =>
        isSplitFullySettledFromSnapshot(snapshot, expense.id, index),
      )
      if (allSettled) ids.add(expense.id)
    }
    return ids
  }, [group, snapshot])

  const filteredExpenses = useMemo(() => {
    if (categoryFilter === 'All') return group.expenses
    return group.expenses.filter((expense) => normalizeCategory(expense.category) === categoryFilter)
  }, [categoryFilter, group.expenses])

  const groupedDays = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const expense of filteredExpenses) {
      const key = expense.date || 'No date'
      const current = map.get(key) ?? []
      current.push(expense)
      map.set(key, current)
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredExpenses])

  /**
   * Totals stay per currency and are never converted. A trip that paid in JPY
   * and THB has no single true total, and inventing one with today's rate would
   * disagree with every other number in the app.
   */
  const totals = useMemo(() => {
    const trip: Record<string, number> = {}
    const mine: Record<string, number> = {}
    for (const expense of filteredExpenses) {
      addTo(trip, expense.paidCurrency, signedAmount(expense))
      if (!myPersonId) continue
      const myShare = expense.splits
        .filter((split) => split.personId === myPersonId)
        .reduce((sum, split) => sum + (split.amount ?? 0), 0)
      if (myShare === 0) continue
      addTo(mine, expense.paidCurrency, expense.type === 'refund' ? -myShare : myShare)
    }
    return { trip, mine }
  }, [filteredExpenses, myPersonId])

  const dayBase = group.startDate || groupedDays[0]?.[0] || ''
  const openExpense = openExpenseId ? group.expenses.find((e) => e.id === openExpenseId) ?? null : null
  const editingExpense = editingExpenseId
    ? group.expenses.find((expense) => expense.id === editingExpenseId) ?? null
    : null

  const jumpToDay = (date: string) => {
    setMenu('none')
    dayRefs.current[date]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="pb-24 lg:pb-0">
      {/* ── Stat bar: the two numbers people actually look for ── */}
      <div className="ms-card-soft mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ms-label">
              {categoryFilter === 'All' ? t('summary.tripTotal') : t('summary.filteredTotal')}
            </p>
            <div className="mt-1 space-y-0.5">
              {Object.keys(totals.trip).length === 0 ? (
                <p className="ms-amount text-2xl tabular-nums">—</p>
              ) : (
                Object.entries(totals.trip).map(([currency, total]) => (
                  <p key={currency} className="ms-amount text-2xl tabular-nums">
                    <span className="ms-currency">{getCurrencySymbol(currency)}</span>
                    {formatMoney(total)}
                  </p>
                ))
              )}
            </div>
            {myPersonId && Object.keys(totals.mine).length > 0 ? (
              <p className="mt-1.5 text-sm text-[var(--ms-text-secondary)]">
                {t('summary.yourShare')}{' '}
                {Object.entries(totals.mine).map(([currency, total], index) => (
                  <span key={currency} className="font-bold tabular-nums text-[var(--ms-text)]">
                    {index > 0 ? ' · ' : ''}
                    {getCurrencySymbol(currency)}
                    {formatMoney(total)}
                  </span>
                ))}
              </p>
            ) : null}
          </div>

          <div ref={menuRef} className="relative flex shrink-0 items-center gap-1">
            <button
              className={`flex h-9 w-9 items-center justify-center rounded-[0.75rem] transition-colors ${
                menu === 'category' || categoryFilter !== 'All'
                  ? 'bg-[var(--ms-accent)] text-white'
                  : 'text-[var(--ms-text-secondary)] hover:bg-[var(--ms-surface-dim)]'
              }`}
              onClick={() => setMenu((prev) => (prev === 'category' ? 'none' : 'category'))}
              aria-label={t('summary.category')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" />
              </svg>
            </button>
            <button
              className={`flex h-9 w-9 items-center justify-center rounded-[0.75rem] transition-colors ${
                menu === 'day'
                  ? 'bg-[var(--ms-accent)] text-white'
                  : 'text-[var(--ms-text-secondary)] hover:bg-[var(--ms-surface-dim)]'
              }`}
              onClick={() => setMenu((prev) => (prev === 'day' ? 'none' : 'day'))}
              aria-label={t('summary.jumpToDay')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" />
              </svg>
            </button>

            {menu === 'category' ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-[var(--ms-radius-field)] border border-[var(--ms-border)] bg-[var(--ms-surface)] p-1.5 shadow-[var(--ms-elev-3)]">
                <button
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm ${
                    categoryFilter === 'All' ? 'font-bold text-[var(--ms-accent)]' : 'text-[var(--ms-text)]'
                  }`}
                  onClick={() => { setCategoryFilter('All'); setMenu('none') }}
                >
                  {t('summary.all')}
                </button>
                {EXPENSE_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
                      categoryFilter === category ? 'font-bold text-[var(--ms-accent)]' : 'text-[var(--ms-text)]'
                    }`}
                    onClick={() => { setCategoryFilter(category); setMenu('none') }}
                  >
                    <CategoryIcon category={category} size={15} />
                    {tCategory(category)}
                  </button>
                ))}
              </div>
            ) : null}

            {menu === 'day' ? (
              <div className="absolute right-0 top-full z-30 mt-2 max-h-64 w-44 overflow-y-auto rounded-[var(--ms-radius-field)] border border-[var(--ms-border)] bg-[var(--ms-surface)] p-1.5 shadow-[var(--ms-elev-3)]">
                {groupedDays.length === 0 ? (
                  <p className="px-2.5 py-1.5 text-sm text-[var(--ms-text-muted)]">{t('summary.noRecords')}</p>
                ) : (
                  groupedDays.map(([date]) => (
                    <button
                      key={date}
                      className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-[var(--ms-text)]"
                      onClick={() => jumpToDay(date)}
                    >
                      {formatDateLabel(date)}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        {categoryFilter !== 'All' ? (
          <button
            className="mt-3 flex items-center gap-1.5 rounded-full bg-[var(--ms-accent-bg)] px-3 py-1 text-xs font-bold text-[var(--ms-accent)]"
            onClick={() => setCategoryFilter('All')}
          >
            <CategoryIcon category={categoryFilter} size={13} />
            {tCategory(categoryFilter)}
            <span aria-hidden="true">×</span>
            <span className="sr-only">{t('summary.clearFilter')}</span>
          </button>
        ) : null}
      </div>

      {/* ── Ledger ── */}
      {groupedDays.length === 0 ? (
        <div className="rounded-[var(--ms-radius-card)] border border-dashed border-[var(--ms-border)] px-4 py-10 text-center">
          <p className="font-bold text-[var(--ms-text)]">
            {categoryFilter === 'All' ? t('summary.emptyTitle') : t('summary.noRecords')}
          </p>
          {categoryFilter === 'All' ? (
            <p className="mt-1 text-sm text-[var(--ms-text-muted)]">{t('summary.emptyHint')}</p>
          ) : null}
        </div>
      ) : (
        groupedDays.map(([date, expenses], dayIndex) => {
          const dayTotals: Record<string, number> = {}
          expenses.forEach((expense) => addTo(dayTotals, expense.paidCurrency, signedAmount(expense)))
          const dayNumber = dayBase && date !== 'No date'
            ? Math.floor((new Date(date).getTime() - new Date(dayBase).getTime()) / 86400000) + 1
            : dayIndex + 1

          return (
            <div
              key={date}
              ref={(node) => { dayRefs.current[date] = node }}
              className="scroll-mt-2"
            >
              <div className="ms-ledger-day">
                <span className="min-w-0 truncate text-sm font-extrabold text-[var(--ms-text)]">
                  {lang === 'zh'
                    ? `${t('summary.day')}${dayNumber}${t('summary.dayUnit')}`
                    : `${t('summary.day')} ${dayNumber}`}
                  <span className="ml-2 font-medium text-[var(--ms-text-muted)]">{formatDateLabel(date)}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--ms-text-secondary)]">
                  {Object.entries(dayTotals)
                    .map(([currency, total]) => `${getCurrencySymbol(currency)}${formatMoney(total)}`)
                    .join(' · ')}
                </span>
              </div>

              {expenses.map((expense) => {
                const isRefund = expense.type === 'refund'
                const settled = settledExpenseIds.has(expense.id)
                const payerNames = (expense.payerIds ?? [])
                  .map((id) => group.people.find((person) => person.id === id)?.name)
                  .filter(Boolean)
                  .join(', ')

                return (
                  <button
                    key={expense.id}
                    className={`ms-ledger-row ${settled ? 'ms-ledger-row--settled' : ''}`}
                    onClick={() => setOpenExpenseId(expense.id)}
                  >
                    <span className="ms-ledger-glyph">
                      <CategoryIcon category={expense.category} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-bold text-[var(--ms-text)]">
                        {expense.description}
                      </span>
                      <span className="block truncate text-xs text-[var(--ms-text-muted)]">
                        {payerNames || t('card.unknown')}
                        {settled ? ` · ${t('summary.settled')}` : ''}
                      </span>
                    </span>
                    <span className="ms-amount shrink-0 text-[0.9375rem] tabular-nums">
                      {isRefund ? '−' : ''}
                      <span className="ms-currency">{getCurrencySymbol(expense.paidCurrency)}</span>
                      {formatMoney(expense.amount)}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })
      )}

      <ExpenseDetailSheet
        group={group}
        expense={editingExpense ? null : openExpense}
        snapshot={snapshot}
        canEdit={canEdit}
        myPersonId={myPersonId}
        onEdit={(expenseId) => setEditingExpenseId(expenseId)}
        onClose={() => setOpenExpenseId(null)}
      />

      {editingExpense && canEdit ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(31,27,24,0.45)] p-2 lg:items-center">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[var(--ms-radius-card)] bg-[var(--ms-surface)] p-2 lg:max-w-3xl">
            <ExpenseForm
              group={group}
              initialExpense={editingExpense}
              title={t('expense.editTitle')}
              submitLabel={t('expense.saveChanges')}
              onRemove={() => {
                const ok = window.confirm(`${t('summary.deleteConfirm')} "${editingExpense.description}"?`)
                if (!ok) return
                onDeleteExpense(editingExpense.id)
                setEditingExpenseId(null)
                setOpenExpenseId(null)
              }}
              onSave={(updates) => {
                const nextExpenses = group.expenses.map((expense) =>
                  expense.id === editingExpense.id ? { ...expense, ...updates } : expense,
                )
                const nextSnapshot = createSettlementSnapshot({
                  expenses: nextExpenses,
                  settlementPayments: group.settlementPayments,
                })
                const hasUnappliedSettlement = nextSnapshot.paymentSummaries.some((row) => row.unappliedAmount > 0.001)
                if (hasUnappliedSettlement) {
                  const ok = window.confirm(t('summary.expenseEditAffectsSettlement'))
                  if (!ok) return
                }
                onEditExpense(editingExpense.id, updates)
                setEditingExpenseId(null)
              }}
              onCancel={() => setEditingExpenseId(null)}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
