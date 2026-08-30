import { useEffect, useState } from 'react'
import { getCurrencySymbol } from '../lib/currency'
import { formatMoney } from '../lib/format'
import { tCategory, useT } from '../lib/i18n'
import { normalizeCategory } from '../lib/categories'
import { getPersonNameStyle } from '../lib/personTheme'
import {
  getSplitOutstandingAmountFromSnapshot,
  isSplitFullySettledFromSnapshot,
  type SettlementSnapshot,
} from '../lib/settlementLedger'
import type { Expense, Group } from '../types'
import CategoryIcon from './CategoryIcon'

type Props = {
  group: Group
  /** Null closes the sheet; the caller keeps the last expense mounted until the slide-out ends. */
  expense: Expense | null
  snapshot: SettlementSnapshot
  canEdit: boolean
  myPersonId?: string | null
  onEdit: (expenseId: string) => void
  onClose: () => void
}

export default function ExpenseDetailSheet({
  group,
  expense,
  snapshot,
  canEdit,
  myPersonId,
  onEdit,
  onClose,
}: Props) {
  const t = useT()
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState<Expense | null>(null)

  // Keep the outgoing expense on screen for the length of the slide-out, so the
  // sheet does not blank out before it has left the viewport. Every update is
  // deferred a frame: mounting and revealing in the same commit would start the
  // panel already in place, with nothing left to animate.
  useEffect(() => {
    if (expense) {
      let reveal = 0
      const mount = requestAnimationFrame(() => {
        setRendered(expense)
        reveal = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(mount)
        cancelAnimationFrame(reveal)
      }
    }
    const hide = requestAnimationFrame(() => setVisible(false))
    const unmount = setTimeout(() => setRendered(null), 280)
    return () => {
      cancelAnimationFrame(hide)
      clearTimeout(unmount)
    }
  }, [expense])

  useEffect(() => {
    if (!expense) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expense, onClose])

  if (!rendered) return null

  const isRefund = rendered.type === 'refund'
  const category = normalizeCategory(rendered.category)
  const symbol = getCurrencySymbol(rendered.paidCurrency)
  const payerIds = rendered.payerIds ?? []
  const payers = payerIds.map((id) => group.people.find((person) => person.id === id)).filter(Boolean)

  return (
    <>
      <div
        className={`ms-sheet-backdrop ${visible ? 'ms-sheet-backdrop--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`ms-sheet-panel ${visible ? 'ms-sheet-panel--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={rendered.description}
      >
        <div className="flex justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-[var(--ms-border)]" />
        </div>

        <div className="px-5 pb-5 pt-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.75rem] bg-[var(--ms-surface-dim)] text-[var(--ms-text-secondary)]">
              <CategoryIcon category={rendered.category} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="ms-title break-words">{rendered.description}</h3>
              <p className="mt-0.5 text-xs text-[var(--ms-text-muted)]">
                {rendered.date || t('summary.noDate')} · {isRefund ? t('cat.Refund') : tCategory(category)}
              </p>
            </div>
            <p className="ms-amount shrink-0 text-xl tabular-nums">
              {isRefund ? '−' : ''}
              <span className="ms-currency">{symbol}</span>
              {formatMoney(rendered.amount)}
            </p>
          </div>

          <p className="mt-4 text-sm text-[var(--ms-text-secondary)]">
            {isRefund ? t('card.refundedTo') : t('card.paidBy')}{' '}
            {payers.length === 0 ? t('card.unknown') : null}
            {payers.map((person, index) => (
              <span key={person!.id}>
                {index > 0 ? ', ' : ''}
                <span className="font-bold" style={getPersonNameStyle(person)}>
                  {person!.name}
                </span>
              </span>
            ))}
          </p>

          <p className="ms-label mt-5">{t('summary.splitTitle')}</p>
          <div className="mt-2">
            {rendered.splits.map((split, index) => {
              const person = group.people.find((entry) => entry.id === split.personId)
              const isPayer = payerIds.includes(split.personId)
              const isMe = Boolean(myPersonId && split.personId === myPersonId)
              const settled = !isPayer && isSplitFullySettledFromSnapshot(snapshot, rendered.id, index)
              const outstanding = isPayer
                ? 0
                : getSplitOutstandingAmountFromSnapshot(snapshot, rendered.id, index)

              return (
                <div
                  key={`${split.personId}-${index}`}
                  className="flex items-center justify-between gap-3 border-b border-[var(--ms-hairline)] py-2.5 last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold" style={getPersonNameStyle(person)}>
                      {person?.name ?? t('card.unknown')}
                    </span>
                    {isMe ? <span className="ms-label shrink-0">{t('people.you')}</span> : null}
                    {isPayer ? (
                      <span className="ms-label shrink-0">{t('summary.payer')}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-sm font-bold tabular-nums text-[var(--ms-text)]">
                      {split.amount != null ? `${symbol}${formatMoney(split.amount)}` : '—'}
                    </span>
                    {!isPayer && settled ? (
                      <span className="ml-2 text-xs font-semibold text-[var(--ms-success)]">
                        {t('summary.paid')}
                      </span>
                    ) : null}
                    {!isPayer && !settled && outstanding > 0.001 && outstanding < (split.amount ?? 0) - 0.001 ? (
                      <span className="ml-2 text-xs font-semibold text-[var(--ms-text-muted)]">
                        {symbol}
                        {formatMoney(outstanding)} {t('card.outstanding')}
                      </span>
                    ) : null}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-5 flex gap-2">
            <button className="ms-btn-ghost flex-1" onClick={onClose}>
              {t('summary.close')}
            </button>
            {canEdit ? (
              <button className="ms-btn-primary flex-1" onClick={() => onEdit(rendered.id)}>
                {t('group.edit')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
