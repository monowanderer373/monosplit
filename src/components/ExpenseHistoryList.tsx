import { useMemo } from 'react'
import type { CanonicalExpense } from '../types'
import type { DirectExpenseChangeRequest } from '../lib/expenseChangeRepository'
import {
  deriveExpenseRevisionEntries,
  type ExpenseRevisionEntry,
} from '../lib/financialHistory'
import { categoryKey, useT } from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { formatMinorAmount } from '../lib/money'
import { useStore } from '../store/useStore'

export default function ExpenseHistoryList({
  expenses,
  directRequests,
}: {
  expenses: readonly CanonicalExpense[]
  directRequests: readonly DirectExpenseChangeRequest[]
}) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const result = useMemo(() => {
    try {
      const entries = deriveExpenseRevisionEntries(expenses, directRequests)
      const chainSizes = new Map<string, number>()
      entries.forEach((entry) => {
        chainSizes.set(entry.chainId, (chainSizes.get(entry.chainId) ?? 0) + 1)
      })
      return {
        entries: entries.filter((entry) => (
          entry.lifecycle !== 'proposal_candidate'
          && (
            (chainSizes.get(entry.chainId) ?? 0) > 1
            || entry.lifecycle !== 'active'
          )
        )),
        failed: false,
      }
    } catch {
      return { entries: [], failed: true }
    }
  }, [directRequests, expenses])

  if (!result.failed && result.entries.length === 0) return null
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense]))

  return (
    <section data-testid="expense-history">
      <p className="ms-label">{t('history.expenseLabel')}</p>
      <h2 className="mt-1 text-xl font-extrabold">{t('history.expenseTitle')}</h2>
      <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">
        {t('history.expenseHelp')}
      </p>
      {result.failed ? (
        <p className="mt-3 rounded-xl bg-[var(--ms-danger-bg)] p-3 text-sm font-bold text-[var(--ms-danger)]">
          {t('history.unavailable')}
        </p>
      ) : (
        <div className="ms-list mt-3">
          {result.entries.map((entry, index) => (
            <div key={entry.expense.id}>
              {index > 0 ? <hr className="ms-divider" /> : null}
              <ExpenseHistoryRow entry={entry} expenseById={expenseById} lang={lang} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ExpenseHistoryRow({
  entry,
  expenseById,
  lang,
}: {
  entry: ExpenseRevisionEntry
  expenseById: ReadonlyMap<string, CanonicalExpense>
  lang: 'en' | 'zh'
}) {
  const t = useT()
  const { expense } = entry
  const previous = entry.previousExpenseId
    ? expenseById.get(entry.previousExpenseId)
    : null
  const next = entry.nextExpenseId ? expenseById.get(entry.nextExpenseId) : null

  return (
    <article className="ms-row items-start" data-testid={`expense-history-${expense.id}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold text-[var(--ms-accent)]">
          {t(historyLabel(entry))}
        </p>
        <p className="mt-1 truncate font-extrabold">
          {expense.description ?? t(categoryKey(expense.category))}
        </p>
        <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
          {formatDate(expense.occurredOn, lang)}
          {' · '}
          {expense.participations.map((item) => item.nameSnapshot).join(', ')}
        </p>
        {previous ? (
          <p className="mt-2 text-xs font-bold text-[var(--ms-text-secondary)]">
            {t('history.correctionOf', {
              name: previous.description ?? t(categoryKey(previous.category)),
            })}
          </p>
        ) : entry.previousExpenseId && !entry.previousVisible ? (
          <p className="mt-2 text-xs text-[var(--ms-text-muted)]">
            {t('history.earlierPrivate')}
          </p>
        ) : null}
        {next ? (
          <p className="mt-1 text-xs font-bold text-[var(--ms-text-secondary)]">
            {t('history.correctedBy', {
              name: next.description ?? t(categoryKey(next.category)),
            })}
          </p>
        ) : entry.nextExpenseId && !entry.nextVisible ? (
          <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
            {t('history.replacementPrivate')}
          </p>
        ) : null}
        {entry.lifecycle === 'cancelled' ? (
          <p className="mt-2 text-xs text-[var(--ms-text-secondary)]">
            {t('history.cancelledHelp')}
          </p>
        ) : entry.lifecycle === 'corrected' ? (
          <p className="mt-2 text-xs text-[var(--ms-text-secondary)]">
            {t('history.correctedHelp')}
          </p>
        ) : entry.lifecycle === 'legacy_voided' ? (
          <p className="mt-2 text-xs text-[var(--ms-text-secondary)]">
            {t('history.legacyHelp')}
          </p>
        ) : null}
      </div>
      <p className="shrink-0 font-extrabold">
        {formatMinorAmount(expense.totalMinor, expense.currency)}
      </p>
    </article>
  )
}

function historyLabel(entry: ExpenseRevisionEntry) {
  if (entry.lifecycle === 'legacy_voided') return 'history.legacyVoided' as const
  if (entry.lifecycle === 'cancelled') return 'history.cancelled' as const
  if (entry.isCurrent) return 'history.currentVersion' as const
  if (entry.role === 'original') return 'history.originalExpense' as const
  return 'history.correctedExpense' as const
}
