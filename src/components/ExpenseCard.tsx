import { getCurrencySymbol } from '../lib/currency'
import { formatMoney } from '../lib/format'
import { useT } from '../lib/i18n'
import { getPersonNameStyle } from '../lib/personTheme'
import { getCategoryIcon } from '../lib/categories'
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
  const categoryIcon = getCategoryIcon(expense.category)

  return (
    <article className="ms-card-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none" aria-hidden="true">{categoryIcon}</span>
            <h3 className="truncate text-base font-semibold text-[var(--ms-text)]">{expense.description}</h3>
          </div>
          <p className="mt-1 text-xs text-[var(--ms-text-secondary)]">
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
          <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
            {expense.splitMode === 'itemized' ? t('card.itemizedSplit') : `${expense.splits.length}${t('card.equalSplit')}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-[var(--ms-text)]">
            {paidSymbol}{formatMoney(expense.amount)}
          </p>
          <p className="text-xs text-[var(--ms-text-muted)]">
            {expense.paidCurrency} → {expense.repayCurrency}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {expense.splits.map((split, index) => {
          const person = group.people.find((p) => p.id === split.personId)
          const amount = split.convertedAmount ?? split.amount ?? 0
          const isPayer = (expense.payerIds ?? []).includes(split.personId)

          let rowClass = 'border-[var(--ms-border)] bg-[var(--ms-surface-dim)]'
          if (split.repaid) {
            rowClass = 'border-[var(--ms-success)] bg-[var(--ms-success-bg)]'
          } else if (!isPayer) {
            rowClass = 'border-[var(--ms-danger)] bg-[var(--ms-danger-bg)]'
          }

          return (
            <div
              key={`${split.personId}-${index}`}
              className={`flex items-center justify-between border px-3 py-2 ${rowClass}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--ms-text)]">
                  <span style={getPersonNameStyle(person)}>{person?.name ?? t('card.unknown')}</span>
                  {isPayer ? ` ${t('card.payer')}` : ''}
                </p>
                <p className={`text-xs ${split.repaid ? 'text-[var(--ms-success)]' : isPayer ? 'text-[var(--ms-text-muted)]' : 'text-[var(--ms-danger)]'}`}>
                  {repaySymbol}{formatMoney(amount)}
                  {' · '}
                  {split.repaid ? `${t('card.repaid')} ${split.repaidDate ?? ''}` : t('card.outstanding')}
                </p>
              </div>

              {!isPayer ? (
                split.repaid ? (
                  <button className="ms-btn-ghost text-xs" onClick={() => onUnmarkRepaid(expense.id, index)}>
                    {t('card.undo')}
                  </button>
                ) : (
                  <button
                    className="border border-[var(--ms-success)] bg-transparent px-2 py-1 text-xs font-medium text-[var(--ms-success)]"
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
          className="ms-btn-ghost text-xs text-[var(--ms-danger)]"
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
