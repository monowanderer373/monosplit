import { useMemo } from 'react'
import ExpenseCard from './ExpenseCard'
import ExpenseForm from './ExpenseForm'
import type { Expense, Group } from '../types'
import { getCurrencySymbol } from '../lib/currency'
import { formatMoney } from '../lib/format'

type Props = {
  group: Group
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
  onDeleteExpense: (expenseId: string) => void
  onMarkRepaid: (expenseId: string, splitIndex: number) => void
  onUnmarkRepaid: (expenseId: string, splitIndex: number) => void
}

export default function ExpensesTab({ group, onAddExpense, onDeleteExpense, onMarkRepaid, onUnmarkRepaid }: Props) {
  const sortedExpenses = useMemo(
    () => [...group.expenses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [group.expenses],
  )

  const totalByPaidCurrency = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const expense of group.expenses) {
      acc[expense.paidCurrency] = (acc[expense.paidCurrency] || 0) + expense.amount
    }
    return acc
  }, [group.expenses])

  return (
    <section className="space-y-4 pb-20">
      <ExpenseForm group={group} onSave={onAddExpense} />

      <div className="ms-card-soft">
        <h2 className="ms-title mb-2">Summary</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(totalByPaidCurrency).map(([currency, total]) => (
            <span key={currency} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
              {getCurrencySymbol(currency)}
              {formatMoney(total)} {currency}
            </span>
          ))}
          {Object.keys(totalByPaidCurrency).length === 0 ? <span className="text-sm text-slate-500">No expenses yet.</span> : null}
        </div>
      </div>

      <div className="space-y-3">
        {sortedExpenses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4 text-center text-sm text-slate-500">
            Add your first expense to start settlement.
          </div>
        ) : null}
        {sortedExpenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            group={group}
            expense={expense}
            onDelete={onDeleteExpense}
            onMarkRepaid={onMarkRepaid}
            onUnmarkRepaid={onUnmarkRepaid}
          />
        ))}
      </div>
    </section>
  )
}
