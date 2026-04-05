import { getCurrencySymbol } from '../lib/currency'
import { formatMoney } from '../lib/format'
import { useT } from '../lib/i18n'
import { getPersonNameStyle } from '../lib/personTheme'
import type { Expense, Group } from '../types'

type Props = {
  group: Group
  expense: Expense
  onDelete: (expenseId: string) => void
  onMarkRepaid: (expenseId: string, splitIndex: number) => void
  onUnmarkRepaid: (expenseId: string, splitIndex: number) => void
}

export default function ExpenseCard({ group, expense, onDelete, onMarkRepaid, onUnmarkRepaid }: Props) {
  const t = useT()
  const payers = (expense.payerIds ?? []).map((pid) => group.people.find((p) => p.id === pid)).filter(Boolean)
  const paidSymbol = getCurrencySymbol(expense.paidCurrency)
  const repaySymbol = getCurrencySymbol(expense.repayCurrency)

  return (
    <article className="ms-card-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{expense.description}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {t('card.paidBy')}{' '}
            {payers.map((p, i) => (
              <span key={p!.id}>
                {i > 0 ? ', ' : ''}
                <span style={getPersonNameStyle(p)}>{p!.name}</span>
              </span>
            ))}
            {payers.length === 0 ? t('card.unknown') : ''}
            {' '}· {expense.date} · {expense.paymentMethod}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {expense.splitMode === 'itemized' ? t('card.itemizedSplit') : `${expense.splits.length}${t('card.equalSplit')}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">
            {paidSymbol}
            {formatMoney(expense.amount)}
          </p>
          <p className="text-xs text-slate-500">
            {expense.paidCurrency} → {expense.repayCurrency}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {expense.splits.map((split, index) => {
          const person = group.people.find((p) => p.id === split.personId)
          const amount = split.convertedAmount ?? split.amount ?? 0
          return (
            <div
              key={`${split.personId}-${index}`}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                split.repaid ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  <span style={getPersonNameStyle(person)}>{person?.name ?? t('card.unknown')}</span>
                  {expense.payerIds.includes(split.personId) ? ` ${t('card.payer')}` : ''}
                </p>
                <p className="text-xs text-slate-500">
                  {repaySymbol}
                  {formatMoney(amount)}
                  {' · '}
                  {split.repaid ? `${t('card.repaid')} ${split.repaidDate ?? ''}` : t('card.outstanding')}
                </p>
              </div>

              {!expense.payerIds.includes(split.personId) ? (
                split.repaid ? (
                  <button className="ms-btn-ghost" onClick={() => onUnmarkRepaid(expense.id, index)}>
                    {t('card.undo')}
                  </button>
                ) : (
                  <button
                    className="rounded-lg border border-emerald-600 bg-white px-2 py-1 text-xs font-medium text-emerald-700"
                    onClick={() => onMarkRepaid(expense.id, index)}
                  >
                    {t('card.markRepaid')}
                  </button>
                )
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          className="ms-btn-ghost"
          onClick={() => {
            const ok = window.confirm(`${t('card.deleteConfirm')} "${expense.description}"?`)
            if (ok) onDelete(expense.id)
          }}
        >
          {t('card.delete')}
        </button>
      </div>
    </article>
  )
}
