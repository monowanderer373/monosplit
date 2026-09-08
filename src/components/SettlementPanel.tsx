import { useMemo, useState } from 'react'
import type { CanonicalExpense } from '../types'
import { useSettlements } from '../hooks/useSettlements'
import { generateId } from '../lib/id'
import { formatMinorAmount } from '../lib/money'
import {
  deriveRelationalDebtLines,
  type BalanceContext,
  type ConfirmedSettlement,
} from '../lib/relationalBalance'
import {
  resolveSettlementAmount,
  type SettlementIntent,
} from '../lib/settlementIntent'
import { friendlyErrorKey, useT, type TranslationKey } from '../lib/i18n'
import SettlementHistoryList from './SettlementHistoryList'

type Props = {
  context: BalanceContext
  currentParticipantId: string
  participantNames: ReadonlyMap<string, string>
  expenses: CanonicalExpense[]
  canPropose: boolean
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
}: Props) {
  const t = useT()
  const settlementState = useSettlements(true)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [intents, setIntents] = useState<Record<string, SettlementIntent | undefined>>({})
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
  const outgoingPending = contextSettlements.flatMap((settlement) => (
    settlement.debtorParticipantId === currentParticipantId
      ? settlement.allocations
        .filter((allocation) => allocation.state === 'pending')
        .map((allocation) => ({ settlement, allocation }))
      : []
  ))

  const propose = async (debt: DebtSummary & { key: string }) => {
    if (action) return
    setAction(debt.key)
    setError('')
    try {
      const amountMinor = resolveSettlementAmount({
        intent: intents[debt.key] ?? null,
        partialAmount: amounts[debt.key] ?? '',
        outstandingMinor: debt.remainingMinor,
        currency: debt.currency,
      })
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
      setIntents((current) => ({ ...current, [debt.key]: undefined }))
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

  const cancelPending = async (allocationId: string) => {
    if (action) return
    setAction(allocationId)
    setError('')
    try {
      await settlementState.cancelPending(allocationId)
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

      {outgoingPending.length > 0 ? (
        <div className="mb-4 grid gap-3">
          {outgoingPending.map(({ settlement, allocation }) => (
            <article key={allocation.id} className="ms-card">
              <p className="ms-label">{t('settlement.awaitingConfirmation')}</p>
              <p className="mt-2 text-sm font-bold">
                {t('settlement.youProposed', {
                  amount: formatMinorAmount(allocation.amountMinor, settlement.currency),
                  name: participantNames.get(allocation.creditorParticipantId) ?? t('common.member'),
                })}
              </p>
              <p className="mt-2 text-xs text-[var(--ms-text-muted)]">
                {t('settlement.cancelCreatesNewHelp')}
              </p>
              <button
                className="ms-btn-ghost mt-3 py-2 text-xs text-[var(--ms-danger)]"
                disabled={action === allocation.id}
                onClick={() => void cancelPending(allocation.id)}
              >
                {t('settlement.cancelProposal')}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      <div className="ms-list">
        {debts.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--ms-text-muted)]">{t('settlement.empty')}</p>
        ) : debts.map((debt, index) => {
          const mine = debt.debtorParticipantId === currentParticipantId
          const intent = intents[debt.key]
          let explicitAmount = ''
          if (intent) {
            try {
              explicitAmount = formatMinorAmount(resolveSettlementAmount({
                intent,
                partialAmount: amounts[debt.key] ?? '',
                outstandingMinor: debt.remainingMinor,
                currency: debt.currency,
              }), debt.currency)
            } catch {
              explicitAmount = ''
            }
          }
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
                  <div className="w-44">
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('settlement.chooseAmount')}>
                      {(['full', 'partial'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={intent === option ? 'ms-btn-primary py-2 text-xs' : 'ms-btn-ghost py-2 text-xs'}
                          aria-pressed={intent === option}
                          onClick={() => {
                            setIntents((current) => ({ ...current, [debt.key]: option }))
                            setError('')
                          }}
                        >
                          {t(option === 'full' ? 'settlement.full' : 'settlement.partial')}
                        </button>
                      ))}
                    </div>
                    {intent === 'full' ? (
                      <p className="mt-2 rounded-xl bg-[var(--ms-bg-warm)] px-3 py-2 text-right text-sm font-extrabold">
                        {formatMinorAmount(debt.remainingMinor, debt.currency)}
                      </p>
                    ) : null}
                    {intent === 'partial' ? (
                      <input
                        className="ms-input mt-2 h-10 w-full text-right"
                        inputMode="decimal"
                        aria-label={t('settlement.amountFor', {
                          name: participantNames.get(debt.creditorParticipantId) ?? t('common.member'),
                        })}
                        placeholder={t('settlement.enterPartialAmount')}
                        value={amounts[debt.key] ?? ''}
                        onChange={(event) => setAmounts((current) => ({
                          ...current,
                          [debt.key]: event.target.value,
                        }))}
                      />
                    ) : null}
                    <button
                      className="ms-btn-primary mt-2 w-full py-2 text-xs"
                      disabled={action === debt.key || !intent}
                      onClick={() => void propose(debt)}
                    >
                      {explicitAmount
                        ? t('settlement.proposeExplicitAmount', { amount: explicitAmount })
                        : t('settlement.proposePaid')}
                    </button>
                  </div>
                ) : null}
              </article>
            </div>
          )
        })}
      </div>

      {incoming.some(({ allocation }) => (
        allocation.state === 'accepted' && allocation.reversalMinor === 0
      )) ? (
        <div className="mt-4">
          <p className="text-xs font-extrabold text-[var(--ms-text-secondary)]">{t('settlement.receipts')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incoming.filter(({ allocation }) => (
              allocation.state === 'accepted' && allocation.reversalMinor === 0
            )).map(({ settlement, allocation }) => (
              <button key={allocation.id} className="ms-btn-ghost py-2 text-xs" disabled={action === allocation.id} onClick={() => void reverse(allocation.id)}>
                {t('settlement.reverse', { amount: formatMinorAmount(allocation.amountMinor, settlement.currency) })}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <SettlementHistoryList
        context={context}
        currentParticipantId={currentParticipantId}
        participantNames={participantNames}
        expenses={expenses}
        settlements={contextSettlements}
      />

    </section>
  )
}
