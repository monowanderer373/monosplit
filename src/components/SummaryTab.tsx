import { useEffect, useMemo, useState } from 'react'
import { fetchRate, getCurrencySymbol } from '../lib/currency'
import { formatMoney } from '../lib/format'
import { getPersonNameStyle } from '../lib/personTheme'
import type { Expense, Group } from '../types'
import { EXPENSE_CATEGORIES, normalizeCategory } from '../lib/categories'
import ExpenseForm from './ExpenseForm'

type Props = {
  group: Group
  onDeleteExpense: (expenseId: string) => void
  onEditExpense: (expenseId: string, updates: Partial<Expense>) => void
}

function round2(value: number): number {
  return Number(value.toFixed(2))
}

function formatDateLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
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
  const [categoryFilter, setCategoryFilter] = useState<'All' | (typeof EXPENSE_CATEGORIES)[number]>('All')
  const [selectedDate, setSelectedDate] = useState<'All' | string>('All')
  const [settlePayerFilterId, setSettlePayerFilterId] = useState('all')
  const [settleRepayFilterId, setSettleRepayFilterId] = useState('all')
  const [openDateMap, setOpenDateMap] = useState<Record<string, boolean>>({})
  const [openExpenseMap, setOpenExpenseMap] = useState<Record<string, boolean>>({})
  const [onlineRateByExpenseId, setOnlineRateByExpenseId] = useState<Record<string, number>>({})
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedDate('All')
  }, [group.id, group.startDate, group.endDate])

  useEffect(() => {
    setSettlePayerFilterId('all')
    setSettleRepayFilterId('all')
  }, [group.id])

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

  const personNameById = useMemo(() => {
    const map: Record<string, string> = {}
    group.people.forEach((person) => {
      map[person.id] = person.name
    })
    return map
  }, [group.people])

  const settlementRows = useMemo(() => {
    const showOnlyOutstanding = settlePayerFilterId === 'all' && settleRepayFilterId === 'all'
    return group.expenses
      .slice()
      .sort((a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime())
      .map((expense) => {
        if (settlePayerFilterId !== 'all' && expense.payerId !== settlePayerFilterId) return null

        const storedRate = expense.splits.find((split) => split.rate != null)?.rate ?? null
        const expenseRate = getExpenseRate(expense.id, storedRate)
        const allRows = expense.splits
          .filter((split) => split.personId !== expense.payerId)
          .filter((split) => settleRepayFilterId === 'all' || split.personId === settleRepayFilterId)
          .map((split) => {
            const convertedAmount = calcConvertedSplitAmount(
              split,
              expenseRate,
              expense.paidCurrency === expense.repayCurrency,
            )
            return {
              personId: split.personId,
              amount: convertedAmount ?? 0,
              repaid: split.repaid,
            }
          })

        if (allRows.length === 0) return null
        const outstandingTotal = allRows.filter((row) => !row.repaid).reduce((sum, row) => sum + row.amount, 0)
        if (showOnlyOutstanding && outstandingTotal <= 0) return null
        const paidCount = allRows.filter((row) => row.repaid).length

        return {
          expenseId: expense.id,
          description: expense.description,
          date: expense.date,
          payerId: expense.payerId,
          amount: expense.amount,
          paidCurrency: expense.paidCurrency,
          repayCurrency: expense.repayCurrency,
          rows: allRows,
          outstandingTotal,
          paidCount,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
  }, [group.expenses, settlePayerFilterId, settleRepayFilterId, getExpenseRate])

  return (
    <section className="space-y-4 pb-24 lg:pb-0">
      <div className="ms-card-soft">
        <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="ms-title">Expense Summary</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm text-[#6b6058]">Category:</span>
            <select
              className="ms-input h-9 min-w-0 py-0 text-sm sm:min-w-36"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'All' | (typeof EXPENSE_CATEGORIES)[number])}
            >
              <option value="All">All</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm text-[#6b6058]">Date:</span>
          <select
            className="ms-input h-9 min-w-0 py-0 text-sm sm:min-w-56"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            <option value="All">All dates</option>
            {availableDateOptions.map((date) => (
              <option key={date} value={date}>
                {(() => {
                  const d = new Date(`${date}T00:00:00`)
                  const day = d.getDate()
                  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
                  const month = d.toLocaleDateString(undefined, { month: 'long' })
                  return `${day}${suffix} / ${month} / ${d.getFullYear()}`
                })()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {groupedDays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8d0c4] bg-[#faf8f4]/80 p-4 text-center text-sm text-[#6b6058]">
            No expense records in selected filters.
          </div>
        ) : null}

        {groupedDays.map(([date, expenses], dayIndex) => {
          const dayTotalByPaidCurrency: Record<string, number> = {}
          expenses.forEach((expense) => {
            dayTotalByPaidCurrency[expense.paidCurrency] = (dayTotalByPaidCurrency[expense.paidCurrency] || 0) + expense.amount
          })

          const openDay = openDateMap[date]
          const dayNumber = dayBase ? Math.floor((new Date(date).getTime() - new Date(dayBase).getTime()) / 86400000) + 1 : dayIndex + 1

          return (
            <div key={date} className="ms-sketch overflow-hidden !p-0">
              <button
                className="flex w-full flex-col gap-3 bg-[#f5eed8] px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
                onClick={() => setOpenDateMap((prev) => ({ ...prev, [date]: !prev[date] }))}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6b6058]">{openDay ? '▾' : '▸'}</span>
                  <p className="text-lg font-semibold text-[#2c2520]">
                    Day {dayNumber} ({formatDateLabel(date)})
                  </p>
                  <span className="rounded-full bg-[rgba(139,110,78,0.12)] px-2 py-0.5 text-xs text-[#74593c]">{expenses.length} expense(s)</span>
                </div>
                <div className="text-right">
                  {Object.entries(dayTotalByPaidCurrency).map(([currency, total]) => (
                    <p key={currency} className="text-base font-bold text-[#2c2520]">
                      {getCurrencySymbol(currency)}
                      {formatMoney(total)}
                    </p>
                  ))}
                </div>
              </button>

              {openDay ? (
                <div className="space-y-3 p-3">
                  {expenses
                    .slice()
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((expense) => {
                      const payer = group.people.find((person) => person.id === expense.payerId)
                      const storedRate = expense.splits.find((split) => split.rate != null)?.rate ?? null
                      const expenseRate = getExpenseRate(expense.id, storedRate)
                      const openExpense = openExpenseMap[expense.id] ?? false
                      const convertedTotal =
                        expense.paidCurrency === expense.repayCurrency
                          ? expense.amount
                          : expenseRate != null
                            ? expense.amount * expenseRate
                            : null

                      return (
                        <div key={expense.id} className="ms-sketch !p-0">
                          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                            <button
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              onClick={() => setOpenExpenseMap((prev) => ({ ...prev, [expense.id]: !openExpense }))}
                            >
                              <span className="text-xs text-[#6b6058]">{openExpense ? '▾' : '▸'}</span>
                              <p className="truncate text-lg font-semibold text-[#2c2520]">{expense.description}</p>
                              <span className="rounded-md bg-[rgba(139,110,78,0.12)] px-2 py-0.5 text-xs text-[#74593c]">{normalizeCategory(expense.category)}</span>
                            </button>
                            <div className="text-left md:text-right">
                              <p className="text-base font-semibold text-[#2c2520]">
                                {getCurrencySymbol(expense.paidCurrency)}
                                {formatMoney(expense.amount)}
                                {convertedTotal != null ? (
                                  <span className="ml-1 text-sm font-medium text-[#6b6058]">
                                    ({getCurrencySymbol(expense.repayCurrency)}
                                    {formatMoney(convertedTotal)})
                                  </span>
                                ) : (
                                  <span className="ml-1 text-xs font-medium text-[#9a9088]">(converting...)</span>
                                )}
                              </p>
                              <div className="mt-1 flex gap-2 md:justify-end">
                                <button className="ms-btn-ghost" onClick={() => setEditingExpenseId(expense.id)}>
                                  Edit
                                </button>
                              </div>
                            </div>
                          </div>

                          {openExpense ? (
                            <div className="space-y-2 border-t border-[#e6e0d5] px-3 py-3">
                              <p className="text-sm text-[#6b6058]">
                                Paid by <span className="font-semibold text-[#3a3330]" style={getPersonNameStyle(payer)}>{payer?.name ?? 'Unknown'}</span> · {expense.date}
                                {expenseRate != null ? ` · Rate 1 ${expense.paidCurrency} = ${formatMoney(expenseRate, 6)} ${expense.repayCurrency}` : ''}
                              </p>

                              {(() => {
                                const payerSplit = expense.splits.find((split) => split.personId === expense.payerId)
                                const payerAmount =
                                  payerSplit != null
                                    ? calcConvertedSplitAmount(
                                        payerSplit,
                                        expenseRate,
                                        expense.paidCurrency === expense.repayCurrency,
                                      )
                                    : null
                                return (
                                  <div className="flex items-center justify-between rounded-xl border border-[#e6dcc0] bg-[#f5eed8] px-3 py-2">
                                    <p className="font-medium text-[#2c2520]" style={getPersonNameStyle(payer)}>{payer?.name ?? 'Unknown'}</p>
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-full bg-[rgba(139,110,78,0.12)] px-2 py-0.5 text-xs font-medium text-[#74593c]">Payer</span>
                                      <span className="text-sm font-semibold text-[#3a3330]">
                                        {payerAmount != null
                                          ? `${getCurrencySymbol(expense.repayCurrency)}${formatMoney(payerAmount)}`
                                          : '-'}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })()}

                              {expense.splits
                                .filter((split) => split.personId !== expense.payerId)
                                .map((split, idx) => {
                                  const person = group.people.find((entry) => entry.id === split.personId)
                                  const convertedAmount = calcConvertedSplitAmount(
                                    split,
                                    expenseRate,
                                    expense.paidCurrency === expense.repayCurrency,
                                  )
                                  return (
                                    <div key={`${expense.id}-${split.personId}-${idx}`} className="flex items-center justify-between rounded-xl border border-[#e6e0d5] bg-[#faf8f4] px-3 py-2">
                                      <div>
                                        <p className="text-base font-medium text-[#2c2520]" style={getPersonNameStyle(person)}>{person?.name ?? 'Unknown'}</p>
                                        <p className="text-sm text-[#6b6058]">
                                          {convertedAmount != null
                                            ? `${getCurrencySymbol(expense.repayCurrency)}${formatMoney(convertedAmount)}`
                                            : '-'}
                                        </p>
                                      </div>
                                      <span className={`text-sm font-semibold ${split.repaid ? 'text-[#5a7a5a]' : 'text-[#9e4a4a]'}`}>
                                        {split.repaid ? 'Paid' : 'Unpaid'}
                                      </span>
                                    </div>
                                  )
                                })}

                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="ms-card-soft">
        <h2 className="ms-title mb-2">Settlement Summary</h2>
        <p className="mb-3 text-sm text-[#6b6058]">
          Each row is one expense. Default shows items with unpaid balances. Repaid lines are shown as
          <span className="mx-1 font-semibold text-[#5a7a8a]">Paid</span>
          in cyan and are excluded from total outstanding.
        </p>

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-[#e6e0d5] bg-[#f0ece3] p-2 text-xs font-semibold uppercase tracking-wide text-[#6b6058] md:grid-cols-12">
          <div className="md:col-span-4">Item</div>
          <div className="md:col-span-3">
            <label className="mb-1 block">Payer</label>
            <select
              className="ms-input h-8 w-full py-0 text-sm normal-case tracking-normal"
              value={settlePayerFilterId}
              onChange={(e) => setSettlePayerFilterId(e.target.value)}
            >
              <option value="all">All</option>
              {group.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-5">
            <label className="mb-1 block">Outstanding Repay</label>
            <select
              className="ms-input h-8 w-full py-0 text-sm normal-case tracking-normal"
              value={settleRepayFilterId}
              onChange={(e) => setSettleRepayFilterId(e.target.value)}
            >
              <option value="all">All</option>
              {group.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 divide-y divide-[#e6e0d5]">
          {settlementRows.length === 0 ? (
            <div className="py-4 text-sm text-[#6b6058]">No settlement rows for current filters.</div>
          ) : null}
          {settlementRows.map((row) => (
            <div key={row.expenseId} className="grid grid-cols-1 gap-3 py-3 md:grid-cols-12 md:gap-2">
              <div className="md:col-span-4">
                <p className="text-base font-semibold text-[#2c2520]">{row.description}</p>
                <p className="text-sm text-[#6b6058]">{row.date}</p>
              </div>
              <div className="md:col-span-3">
                <p
                  className="text-base font-semibold text-[#2c2520]"
                  style={getPersonNameStyle(group.people.find((person) => person.id === row.payerId))}
                >
                  {personNameById[row.payerId] ?? 'Unknown'}
                </p>
                <p className="text-lg font-bold text-[#2c2520]">
                  {getCurrencySymbol(row.paidCurrency)}
                  {formatMoney(row.amount)}
                </p>
              </div>
              <div className="md:col-span-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">Who owes</p>
                <ul className="mt-1 space-y-1">
                  {row.rows.map((line, idx) => (
                    <li key={`${row.expenseId}-${line.personId}-${idx}`} className="flex items-center justify-between text-sm">
                      <span
                        className="font-semibold text-[#3a3330]"
                        style={getPersonNameStyle(group.people.find((person) => person.id === line.personId))}
                      >
                        {personNameById[line.personId] ?? 'Unknown'}
                      </span>
                      {line.repaid ? (
                        <span className="font-semibold text-[#5a7a8a]">
                          Paid (
                          {getCurrencySymbol(row.repayCurrency)}
                          {formatMoney(line.amount)})
                        </span>
                      ) : (
                        <span className="font-semibold text-[#8a3a3a]">
                          {getCurrencySymbol(row.repayCurrency)}
                          {formatMoney(line.amount)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#6b6058]">Total outstanding</p>
                {row.outstandingTotal > 0 ? (
                  <p className="text-2xl font-bold text-[#8a3a3a]">
                    {getCurrencySymbol(row.repayCurrency)}
                    {formatMoney(row.outstandingTotal)}
                  </p>
                ) : (
                  <p className="text-lg font-bold text-[#5a7a8a]">
                    Paid{row.paidCount > 0 ? ` (${row.paidCount})` : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingExpense ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2c2520]/45 p-2 lg:items-center">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-2 lg:max-w-3xl">
            <ExpenseForm
              group={group}
              initialExpense={editingExpense}
              title="Edit Expense"
              submitLabel="Save Changes"
              onRemove={() => {
                const ok = window.confirm(`Warning: Delete expense "${editingExpense.description}"?`)
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
