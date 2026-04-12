import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchRate, getCurrencySymbol } from '../lib/currency'
import { formatMoney } from '../lib/format'
import { tCategory, useT } from '../lib/i18n'
import { getPersonNameStyle } from '../lib/personTheme'
import { useStore } from '../store/useStore'
import type { Expense, Group } from '../types'
import { CATEGORY_ICONS, EXPENSE_CATEGORIES, normalizeCategory } from '../lib/categories'
import ExpenseForm from './ExpenseForm'

// Muted vintage-ink palette — all tones aged on warm cream, no vivid hues
const CATEGORY_COLORS: Record<string, { bg: string; accent: string; border: string; left: string }> = {
  Food:           { bg: 'rgba(139,90,40,0.07)',   accent: '#7a4a1a', border: 'rgba(139,90,40,0.20)',   left: '#9a6030' },  // burnt amber
  Drinks:         { bg: 'rgba(130,55,65,0.07)',   accent: '#7a2830', border: 'rgba(130,55,65,0.20)',   left: '#8a3840' },  // dusty wine
  Groceries:      { bg: 'rgba(65,95,55,0.07)',    accent: '#3a5828', border: 'rgba(65,95,55,0.20)',    left: '#4a6838' },  // sage ink
  Transportation: { bg: 'rgba(55,75,100,0.07)',   accent: '#2e4460', border: 'rgba(55,75,100,0.20)',   left: '#3e5870' },  // slate ink
  Flight:         { bg: 'rgba(65,85,115,0.07)',   accent: '#344460', border: 'rgba(65,85,115,0.20)',   left: '#445870' },  // steel dusk
  Accommodation:  { bg: 'rgba(95,65,95,0.07)',    accent: '#583258', border: 'rgba(95,65,95,0.20)',    left: '#684468' },  // dusty mauve
  Shopping:       { bg: 'rgba(135,100,25,0.07)',  accent: '#7a5808', border: 'rgba(135,100,25,0.20)',  left: '#8a6a18' },  // antique gold
  Sightseeing:    { bg: 'rgba(35,95,95,0.07)',    accent: '#1e5050', border: 'rgba(35,95,95,0.20)',    left: '#2e6060' },  // vintage teal
  Activities:     { bg: 'rgba(135,65,35,0.07)',   accent: '#7a3818', border: 'rgba(135,65,35,0.20)',   left: '#8a4828' },  // terracotta
  Other:          { bg: 'rgba(110,92,72,0.07)',   accent: '#56432a', border: 'rgba(110,92,72,0.20)',   left: '#6e5838' },  // warm stone
}

type Props = {
  group: Group
  onDeleteExpense: (expenseId: string) => void
  onEditExpense: (expenseId: string, updates: Partial<Expense>) => void
}

function round2(value: number): number {
  return Number(value.toFixed(2))
}

function formatDateLabel(isoDate: string): string {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10)
  if (isoDate === todayStr) return 'Today'
  if (isoDate === yesterday) return 'Yesterday'
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(`${isoDate}T00:00:00`).getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function calcConvertedSplitAmount(
  split: { convertedAmount: number | null; amount: number | null; rate: number | null },
  expenseRate: number | null,
  sameCurrency: boolean,
): number | null {
  if (split.convertedAmount != null) return split.convertedAmount
  if (sameCurrency) return split.amount
  if (split.amount != null && split.rate != null) return round2(split.amount * split.rate)
  if (split.amount != null && expenseRate != null) return round2(split.amount * expenseRate)
  return null
}

export default function SummaryTab({ group, onDeleteExpense, onEditExpense }: Props) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [categoryFilter, setCategoryFilter] = useState<'All' | (typeof EXPENSE_CATEGORIES)[number]>('All')
  const [selectedDate, setSelectedDate] = useState<'All' | string>('All')
  const [openDateMap, setOpenDateMap] = useState<Record<string, boolean>>({})
  const [openExpenseMap, setOpenExpenseMap] = useState<Record<string, boolean>>({})
  const [onlineRateByExpenseId, setOnlineRateByExpenseId] = useState<Record<string, number>>({})
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const categoryFilterRef = useRef<HTMLDivElement>(null)
  const dateFilterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedDate('All')
  }, [group.id, group.startDate, group.endDate])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(e.target as Node)) setShowCategoryFilter(false)
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) setShowDateFilter(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const targets = group.expenses.filter((expense) => {
        if (expense.paidCurrency === expense.repayCurrency) return false
        const storedRate = expense.splits.find((split) => split.rate != null)?.rate
        return storedRate == null && onlineRateByExpenseId[expense.id] == null
      })
      if (targets.length === 0) return

      const results = await Promise.all(
        targets.map(async (expense) => {
          const result = await fetchRate(expense.paidCurrency, expense.repayCurrency, expense.date || 'latest')
          return { expenseId: expense.id, rate: result?.rate ?? null }
        }),
      )
      if (cancelled) return

      setOnlineRateByExpenseId((prev) => {
        const next = { ...prev }
        for (const row of results) {
          if (row.rate != null) next[row.expenseId] = row.rate
        }
        return next
      })
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [group.expenses, onlineRateByExpenseId])

  const filteredExpenses = useMemo(() => {
    return group.expenses.filter((expense) => {
      const category = normalizeCategory(expense.category)
      if (categoryFilter !== 'All' && category !== categoryFilter) return false
      if (selectedDate !== 'All' && expense.date !== selectedDate) return false
      return true
    })
  }, [categoryFilter, group.expenses, selectedDate])

  const groupedDays = useMemo(() => {
    const map = new Map<string, typeof filteredExpenses>()
    for (const expense of filteredExpenses) {
      const key = expense.date || 'No date'
      const current = map.get(key) || []
      current.push(expense)
      map.set(key, current)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredExpenses])

  useEffect(() => {
    setOpenDateMap((prev) => {
      const next = { ...prev }
      groupedDays.forEach(([date], index) => {
        if (next[date] == null) next[date] = index === 0
      })
      return next
    })
  }, [groupedDays])

  const dayBase = group.startDate || groupedDays[0]?.[0] || ''

  const availableDateOptions = useMemo(() => {
    if (group.startDate && group.endDate && group.startDate <= group.endDate) {
      const rows: string[] = []
      let cursor = new Date(`${group.startDate}T00:00:00`)
      const end = new Date(`${group.endDate}T00:00:00`)
      while (cursor.getTime() <= end.getTime()) {
        rows.push(cursor.toISOString().slice(0, 10))
        cursor = new Date(cursor.getTime() + 86400000)
      }
      return rows
    }
    return [...new Set(group.expenses.map((expense) => expense.date).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [group.endDate, group.expenses, group.startDate])

  const editingExpense = editingExpenseId ? group.expenses.find((expense) => expense.id === editingExpenseId) || null : null

  const getExpenseRate = (expenseId: string, fallbackRate: number | null): number | null =>
    fallbackRate ?? onlineRateByExpenseId[expenseId] ?? null

  return (
    <section className="space-y-3 pb-24 lg:pb-0">

      {/* ── Header with icon filter buttons ── */}
      <div className="ms-card-soft">
        <div className="flex items-center justify-between">
          <h2 className="ms-title">{t('summary.title')}</h2>
          <div className="flex items-center gap-1">

            {/* Category filter icon */}
            <div ref={categoryFilterRef} className="relative">
              <button
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  showCategoryFilter || categoryFilter !== 'All'
                    ? 'bg-[var(--ms-accent,#8b6e4e)] text-white'
                    : 'text-[#6b6058] hover:bg-[rgba(139,110,78,0.12)]'
                }`}
                onClick={() => { setShowCategoryFilter((v) => !v); setShowDateFilter(false) }}
                title={t('summary.category')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>
                </svg>
              </button>
              {showCategoryFilter && (
                <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-[#e6e0d5] bg-[var(--ms-bg,#fdfaf5)] p-2 shadow-lg">
                  <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-[#6b6058]">{t('summary.category')}</p>
                  <select
                    className="ms-input h-8 w-full py-0 text-sm"
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value as 'All' | (typeof EXPENSE_CATEGORIES)[number]); setShowCategoryFilter(false) }}
                  >
                    <option value="All">{t('summary.all')}</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{tCategory(cat)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Date filter icon */}
            <div ref={dateFilterRef} className="relative">
              <button
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  showDateFilter || selectedDate !== 'All'
                    ? 'bg-[var(--ms-accent,#8b6e4e)] text-white'
                    : 'text-[#6b6058] hover:bg-[rgba(139,110,78,0.12)]'
                }`}
                onClick={() => { setShowDateFilter((v) => !v); setShowCategoryFilter(false) }}
                title={t('summary.date')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>
                </svg>
              </button>
              {showDateFilter && (
                <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-[#e6e0d5] bg-[var(--ms-bg,#fdfaf5)] p-2 shadow-lg">
                  <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-[#6b6058]">{t('summary.date')}</p>
                  <select
                    className="ms-input h-8 w-full py-0 text-sm"
                    value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); setShowDateFilter(false) }}
                  >
                    <option value="All">{t('summary.allDates')}</option>
                    {availableDateOptions.map((d) => (
                      <option key={d} value={d}>{formatDateLabel(d)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {(categoryFilter !== 'All' || selectedDate !== 'All') && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categoryFilter !== 'All' && (
              <button
                className="flex items-center gap-1 rounded-full bg-[rgba(139,110,78,0.14)] px-2.5 py-0.5 text-xs font-medium text-[#6b6058]"
                onClick={() => setCategoryFilter('All')}
              >
                {CATEGORY_ICONS[categoryFilter as keyof typeof CATEGORY_ICONS] ?? ''} {tCategory(categoryFilter as (typeof EXPENSE_CATEGORIES)[number])} ×
              </button>
            )}
            {selectedDate !== 'All' && (
              <button
                className="flex items-center gap-1 rounded-full bg-[rgba(139,110,78,0.14)] px-2.5 py-0.5 text-xs font-medium text-[#6b6058]"
                onClick={() => setSelectedDate('All')}
              >
                📅 {formatDateLabel(selectedDate)} ×
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Day cards ── */}
      <div className="space-y-2">
        {groupedDays.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#d8d0c4] bg-[#faf8f4]/80 p-4 text-center text-sm text-[#6b6058]">
            {t('summary.noRecords')}
          </div>
        )}

        {groupedDays.map(([date, expenses], dayIndex) => {
          const dayTotalByPaidCurrency: Record<string, number> = {}
          expenses.forEach((expense) => {
            dayTotalByPaidCurrency[expense.paidCurrency] = (dayTotalByPaidCurrency[expense.paidCurrency] || 0) + expense.amount
          })
          const openDay = openDateMap[date]
          const dayNumber = dayBase
            ? Math.floor((new Date(date).getTime() - new Date(dayBase).getTime()) / 86400000) + 1
            : dayIndex + 1

          return (
            <div key={date} className={`ms-day-card ${openDay ? 'ms-day-card--open' : ''}`}>

              {/* Day header bar */}
              <button
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                style={{ background: 'var(--ms-day-bar, #e8d5cc)' }}
                onClick={() => setOpenDateMap((prev) => ({ ...prev, [date]: !prev[date] }))}
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-[#2c2520]">
                    {lang === 'zh'
                      ? `${t('summary.day')}${dayNumber}${t('summary.dayUnit')}`
                      : `${t('summary.day')} ${dayNumber}`}
                  </span>
                  <span className="text-sm text-[#6b6058]">({formatDateLabel(date)})</span>
                  <span className="rounded-full bg-[rgba(44,37,32,0.1)] px-2 py-0.5 text-xs text-[#5a4838]">
                    {expenses.length} {t('summary.expenseCount')}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    {Object.entries(dayTotalByPaidCurrency).map(([currency, total]) => (
                      <p key={currency} className="text-base font-bold text-[#2c2520]">
                        {getCurrencySymbol(currency)}{formatMoney(total)}
                      </p>
                    ))}
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="#6b6058" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`ms-day-chevron ${openDay ? 'ms-day-chevron--open' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </button>

              {/* Expandable expenses list */}
              <div className={`ms-exp-grid ${openDay ? 'ms-exp-grid--open' : ''}`}>
                <div className="ms-exp-inner">
                  <div className="space-y-1.5 p-2" style={{ background: 'var(--ms-surface-dim, #f0ece3)' }}>
                    {expenses
                      .slice()
                      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                      .map((expense) => {
                        const cat = normalizeCategory(expense.category)
                        const cc = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other
                        const payers = (expense.payerIds ?? []).map((pid) => group.people.find((p) => p.id === pid)).filter(Boolean)
                        const storedRate = expense.splits.find((s) => s.rate != null)?.rate ?? null
                        const expenseRate = getExpenseRate(expense.id, storedRate)
                        const openExpense = openExpenseMap[expense.id] ?? false
                        const sameCurrency = expense.paidCurrency === expense.repayCurrency

                        const outstandingTotal = expense.splits
                          .filter((s) => !(expense.payerIds ?? []).includes(s.personId) && !s.repaid)
                          .reduce((sum, s) => sum + (calcConvertedSplitAmount(s, expenseRate, sameCurrency) ?? 0), 0)

                        return (
                          <div
                            key={expense.id}
                            className={`ms-expense-card ${openExpense ? 'ms-expense-card--open' : ''}`}
                            style={{
                              background: cc.bg,
                              border: `1px solid ${cc.border}`,
                              borderLeftWidth: '3px',
                              borderLeftColor: cc.left,
                            }}
                          >
                            {/* Expense row header */}
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                              onClick={() => setOpenExpenseMap((prev) => ({ ...prev, [expense.id]: !openExpense }))}
                            >
                              <span className="shrink-0 text-base">{CATEGORY_ICONS[cat]}</span>
                              <span className="min-w-0 flex-1 truncate font-medium text-[#2c2520]">{expense.description}</span>
                              <span
                                className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold"
                                style={{ background: cc.border, color: cc.accent }}
                              >
                                {tCategory(cat)}
                              </span>
                              <span className="shrink-0 font-bold text-[#2c2520]">
                                {getCurrencySymbol(expense.paidCurrency)}{formatMoney(expense.amount)}
                              </span>
                              <svg
                                xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                                fill="none" stroke="#6b6058" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                className={`ms-day-chevron shrink-0 ${openExpense ? 'ms-day-chevron--open' : ''}`}
                              >
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </button>

                            {/* Expandable split detail */}
                            <div className={`ms-exp-grid ${openExpense ? 'ms-exp-grid--open' : ''}`}>
                              <div className="ms-exp-inner">
                                <div
                                  className="space-y-2 px-3 pb-3 pt-2"
                                  style={{ borderTop: `1px solid ${cc.border}` }}
                                >
                                  {/* Top row: paid-by + edit button */}
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="min-w-0 flex-1 text-xs text-[#6b6058]">
                                      {t('card.paidBy')}{' '}
                                      {payers.map((p, i) => (
                                        <span key={p!.id}>
                                          {i > 0 ? ', ' : ''}
                                          <span className="font-semibold" style={getPersonNameStyle(p)}>{p!.name}</span>
                                        </span>
                                      ))}
                                      {payers.length === 0 ? t('card.unknown') : ''}
                                      {' '}· {expense.date}
                                    </p>
                                    <button
                                      className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#6b6058] hover:bg-[rgba(0,0,0,0.06)] active:opacity-70"
                                      onClick={(e) => { e.stopPropagation(); setEditingExpenseId(expense.id) }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                      </svg>
                                      {t('group.edit')}
                                    </button>
                                  </div>

                                  {/* Payer rows */}
                                  {payers.map((payer) => {
                                    const payerSplit = expense.splits.find((s) => s.personId === payer!.id)
                                    const payerAmt = payerSplit != null
                                      ? calcConvertedSplitAmount(payerSplit, expenseRate, sameCurrency)
                                      : null
                                    return (
                                      <div key={payer!.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={{ background: 'rgba(240,234,222,0.7)' }}>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-sm font-semibold" style={getPersonNameStyle(payer)}>{payer!.name}</span>
                                          <span className="rounded px-1 py-0.5 text-xs font-semibold" style={{ background: cc.border, color: cc.accent }}>
                                            {t('summary.payer')}
                                          </span>
                                        </div>
                                        <span className="text-sm font-semibold text-[#2c2520]">
                                          {payerAmt != null ? `${getCurrencySymbol(expense.repayCurrency)}${formatMoney(payerAmt)}` : '-'}
                                        </span>
                                      </div>
                                    )
                                  })}

                                  {/* Debtor rows */}
                                  {expense.splits
                                    .filter((s) => !(expense.payerIds ?? []).includes(s.personId))
                                    .map((split, idx) => {
                                      const person = group.people.find((entry) => entry.id === split.personId)
                                      const convAmt = calcConvertedSplitAmount(split, expenseRate, sameCurrency)
                                      return (
                                        <div key={`${expense.id}-${split.personId}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={{ background: 'rgba(240,234,222,0.45)' }}>
                                          <span className="text-sm font-medium" style={getPersonNameStyle(person)}>
                                            {person?.name ?? t('card.unknown')}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <span className={`text-xs font-semibold ${split.repaid ? 'text-[#3a6a3a]' : 'text-[#9e4a4a]'}`}>
                                              {split.repaid ? t('summary.paid') : t('summary.unpaid')}
                                            </span>
                                            <span className="text-sm font-semibold text-[#2c2520]">
                                              {convAmt != null ? `${getCurrencySymbol(expense.repayCurrency)}${formatMoney(convAmt)}` : '-'}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}

                                  {/* Balance to repay */}
                                  {outstandingTotal > 0 && (
                                    <>
                                      <div style={{ borderTop: `1px solid ${cc.border}` }} className="mt-1" />
                                      <div className="flex items-center justify-between px-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">Balance to repay</span>
                                        <span className="font-bold text-[#9e4a4a]">
                                          {getCurrencySymbol(expense.repayCurrency)}{formatMoney(outstandingTotal)}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit expense modal */}
      {editingExpense ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2c2520]/45 p-2 lg:items-center">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-2 lg:max-w-3xl">
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
              }}
              onSave={(updates) => {
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
