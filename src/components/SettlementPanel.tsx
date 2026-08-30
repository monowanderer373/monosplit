import { useMemo, useState } from 'react'
import type { CanonicalExpense } from '../types'
import { useSettlements } from '../hooks/useSettlements'
import { generateId } from '../lib/id'
import { formatMinorAmount, parseMajorAmount } from '../lib/money'
import {
  deriveRelationalDebtLines,
  type BalanceContext,
  type ConfirmedSettlement,
} from '../lib/relationalBalance'
import { friendlyErrorKey, useT, type TranslationKey } from '../lib/i18n'
import ActivityFeed from './ActivityFeed'

type Props = {
  context: BalanceContext
  currentParticipantId: string
  participantNames: ReadonlyMap<string, string>
  expenses: CanonicalExpense[]
  canPropose: boolean
  showActivity?: boolean
}

type DebtSummary = {
  debtorParticipantId: string
  creditorParticipantId: string
  currency: string
  remainingMinor: number
}

function settlementMatchesContext(
  settlement: ConfirmedSettlement,
  context: BalanceContext,
): boolean {
  if (context.scope === 'space') {
    return settlement.scope === 'space' && settlement.spaceId === context.spaceId
  }
  return settlement.scope === 'direct'
    && context.participantIds.includes(settlement.debtorParticipantId)
    && settlement.allocations.some((allocation) => context.participantIds.includes(allocation.creditorParticipantId))
}

export default function SettlementPanel({
  context,
  currentParticipantId,
  participantNames,
  expenses,
  canPropose,
  showActivity = false,
}: Props) {
  const t = useT()
  const settlementState = useSettlements(true)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [action, setAction] = useState('')
  const [error, setError] = useState<TranslationKey | ''>('')

  const contextSettlements = useMemo(
    () => settlementState.settlements.filter((settlement) => (
      settlementMatchesContext(settlement, context)
    )),
    [context, settlementState.settlements],
  )
  const debtLines = useMemo(
    () => deriveRelationalDebtLines(
      expenses,
      contextSettlements as ConfirmedSettlement[],
      context,
    ),
    [context, contextSettlements, expenses],
  )
  const debts = useMemo(() => {
    const totals = new Map<string, DebtSummary>()
    for (const line of debtLines) {
      if (line.remainingMinor <= 0) continue
      const key = `${line.debtorParticipantId}:${line.creditorParticipantId}:${line.currency}`
      const current = totals.get(key) ?? {
        debtorParticipantId: line.debtorParticipantId,
        creditorParticipantId: line.creditorParticipantId,
        currency: line.currency,
        remainingMinor: 0,
      }
      current.remainingMinor += line.remainingMinor
      totals.set(key, current)
    }
    return [...totals.entries()].map(([key, value]) => ({ key, ...value }))
  }, [debtLines])

  const incoming = contextSettlements.flatMap((settlement) => settlement.allocations
    .filter((allocation) => allocation.creditorParticipantId === currentParticipantId)
    .map((allocation) => ({ settlement, allocation })))

  const propose = async (debt: DebtSummary & { key: string }) => {
    if (action) return
    setAction(debt.key)
    setError('')
    try {
      const rawAmount = amounts[debt.key]?.trim()
      const amountMinor = rawAmount
        ? parseMajorAmount(rawAmount, debt.currency)
        : debt.remainingMinor
      if (amountMinor > debt.remainingMinor) throw new Error('amount_exceeds_outstanding_balance')
      await settlementState.propose({
        requestId: generateId(),
        scope: context.scope,
        spaceId: context.scope === 'space' ? context.spaceId : null,
        currency: debt.currency,
        amountMinor,
        paymentDate: new Date().toISOString().slice(0, 10),
        allocations: [{
          creditorParticipantId: debt.creditorParticipantId,
          amountMinor,
        }],
        note: null,
      })
      setAmounts((current) => ({ ...current, [debt.key]: '' }))
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const respond = async (allocationId: string, response: 'accepted' | 'declined') => {
    if (action) return
    setAction(allocationId)
    setError('')
    try {
      await settlementState.respond(allocationId, response)
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const reverse = async (allocationId: string) => {
    if (action) return
    setAction(allocationId)
    setError('')
    try {
      await settlementState.reverse(allocationId)
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  return (
    <section>
      <div className="mb-3">
        <p className="ms-label">{t('settlement.confirmed')}</p>
        <h2 className="mt-1 text-xl font-extrabold">{t('settlement.title')}</h2>
        <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">
          {t('settlement.help')}
        </p>
      </div>

      {(error || settlementState.error) ? (
        <p className="mb-3 rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2 text-sm text-[var(--ms-danger)]">
          {t(error || friendlyErrorKey(settlementState.error))}
        </p>
      ) : null}

      {incoming.some(({ allocation }) => allocation.state === 'pending') ? (
        <div className="mb-4 grid gap-3">
          {incoming.filter(({ allocation }) => allocation.state === 'pending').map(({ settlement, allocation }) => (
            <article key={allocation.id} className="ms-card-hero">
              <p className="ms-label">{t('settlement.confirmation')}</p>
              <p className="mt-2 font-extrabold">
                {t('settlement.saysPaid', {
                  name: participantNames.get(settlement.debtorParticipantId) ?? t('common.member'),
                  amount: formatMinorAmount(allocation.amountMinor, settlement.currency),
                })}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="ms-btn-ghost" disabled={action === allocation.id} onClick={() => void respond(allocation.id, 'declined')}>{t('common.decline')}</button>
                <button className="ms-btn-primary" disabled={action === allocation.id} onClick={() => void respond(allocation.id, 'accepted')}>{t('settlement.confirmReceived')}</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="ms-list">
        {debts.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--ms-text-muted)]">{t('settlement.empty')}</p>
        ) : debts.map((debt, index) => {
          const mine = debt.debtorParticipantId === currentParticipantId
          return (
            <div key={debt.key}>
              {index > 0 ? <hr className="ms-divider" /> : null}
              <article className="ms-row items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">
                    {mine
                      ? t('settlement.youOwe', {
                        name: debt.creditorParticipantId === currentParticipantId
                          ? t('common.you')
                          : participantNames.get(debt.creditorParticipantId) ?? t('common.member'),
                      })
                      : t('settlement.personOwes', {
                        debtor: participantNames.get(debt.debtorParticipantId) ?? t('common.member'),
                        creditor: debt.creditorParticipantId === currentParticipantId
                          ? t('common.you')
                          : participantNames.get(debt.creditorParticipantId) ?? t('common.member'),
                      })}
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--ms-accent)]">
                    {formatMinorAmount(debt.remainingMinor, debt.currency)}
                  </p>
                </div>
                {mine && canPropose ? (
                  <div className="w-36">
                    <input
                      className="ms-input h-10 w-full text-right"
                      inputMode="decimal"
                      aria-label={t('settlement.amountFor', {
                        name: participantNames.get(debt.creditorParticipantId) ?? t('common.member'),
                      })}
                      placeholder={t('settlement.fullAmount')}
                      value={amounts[debt.key] ?? ''}
                      onChange={(event) => setAmounts((current) => ({ ...current, [debt.key]: event.target.value }))}
                    />
                    <button className="ms-btn-primary mt-2 w-full py-2 text-xs" disabled={action === debt.key} onClick={() => void propose(debt)}>
                      {t('settlement.proposePaid')}
                    </button>
                  </div>
                ) : null}
              </article>
            </div>
          )
        })}
      </div>

      {incoming.some(({ allocation }) => allocation.state === 'accepted') ? (
        <div className="mt-4">
          <p className="text-xs font-extrabold text-[var(--ms-text-secondary)]">{t('settlement.receipts')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incoming.filter(({ allocation }) => allocation.state === 'accepted').map(({ settlement, allocation }) => (
              <button key={allocation.id} className="ms-btn-ghost py-2 text-xs" disabled={action === allocation.id} onClick={() => void reverse(allocation.id)}>
                {t('settlement.reverse', { amount: formatMinorAmount(allocation.amountMinor, settlement.currency) })}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showActivity && contextSettlements.length > 0 ? (
        <div className="mt-8">
          <ActivityFeed
            settlementIds={contextSettlements.map((settlement) => settlement.id)}
            refreshKey={contextSettlements.map((settlement) => (
              `${settlement.updatedAt}:${settlement.allocations.map((allocation) => allocation.state).join(',')}`
            )).join('|')}
          />
        </div>
      ) : null}
    </section>
  )
}
