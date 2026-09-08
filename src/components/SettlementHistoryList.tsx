import { useMemo } from 'react'
import {
  deriveSettlementHistoryEntries,
  type SettlementHistoryKind,
} from '../lib/financialHistory'
import {
  deriveSettlementAttributions,
  type BalanceContext,
} from '../lib/relationalBalance'
import type { SettlementPayment } from '../lib/settlementRepository'
import type { CanonicalExpense } from '../types'
import { useT } from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { formatMinorAmount } from '../lib/money'
import { useStore } from '../store/useStore'

export default function SettlementHistoryList({
  context,
  currentParticipantId,
  participantNames,
  expenses,
  settlements,
}: {
  context: BalanceContext
  currentParticipantId: string
  participantNames: ReadonlyMap<string, string>
  expenses: readonly CanonicalExpense[]
  settlements: readonly SettlementPayment[]
}) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const result = useMemo(() => {
    try {
      const attributions = deriveSettlementAttributions(
        expenses,
        settlements,
        context,
      )
      return {
        entries: deriveSettlementHistoryEntries(settlements, attributions),
        failed: false,
      }
    } catch {
      return { entries: [], failed: true }
    }
  }, [context, expenses, settlements])

  if (!result.failed && result.entries.length === 0) return null

  return (
    <section className="mt-6" data-testid="settlement-history">
      <p className="ms-label">{t('history.settlementLabel')}</p>
      <h3 className="mt-1 text-lg font-extrabold">{t('history.settlementTitle')}</h3>
      <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">
        {t('history.settlementHelp')}
      </p>
      {result.failed ? (
        <p className="mt-3 rounded-xl bg-[var(--ms-danger-bg)] p-3 text-sm font-bold text-[var(--ms-danger)]">
          {t('history.unavailable')}
        </p>
      ) : (
        <div className="ms-list mt-3">
          {result.entries.map((entry, index) => {
            const debtorName = participantName(
              entry.settlement.debtorParticipantId,
              currentParticipantId,
              participantNames,
              t('common.you'),
              t('history.privateParticipant'),
            )
            const creditorName = participantName(
              entry.allocation.creditorParticipantId,
              currentParticipantId,
              participantNames,
              t('common.you'),
              t('history.privateParticipant'),
            )
            return (
              <div key={entry.allocation.id}>
                {index > 0 ? <hr className="ms-divider" /> : null}
                <article className="ms-row items-start" data-testid={`settlement-history-${entry.allocation.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">
                      {t('history.settlementDirection', {
                        debtor: debtorName,
                        creditor: creditorName,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                      {formatDate(entry.settlement.paymentDate, lang)}
                    </p>
                    <div className="mt-3 space-y-2">
                      {entry.facts.map((fact) => (
                        <div
                          key={fact.id}
                          className={fact.kind === 'reversed' || fact.kind === 'legacy_reversed'
                            ? 'rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2'
                            : 'rounded-xl bg-[var(--ms-bg-warm)] px-3 py-2'}
                        >
                          <p className="text-xs font-extrabold">{t(settlementFactKey(fact.kind))}</p>
                          <p className="mt-0.5 text-sm font-bold">
                            {formatMinorAmount(fact.amountMinor, entry.settlement.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                    {entry.currentAppliedMinor != null && entry.currentCreditMinor != null ? (
                      <div className="mt-3 rounded-xl border border-[var(--ms-border)] p-3">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ms-text-muted)]">
                          {t('history.currentDerived')}
                        </p>
                        <p className="mt-1 text-xs font-bold">
                          {t('history.currentlyApplied', {
                            amount: formatMinorAmount(
                              entry.currentAppliedMinor,
                              entry.settlement.currency,
                            ),
                          })}
                        </p>
                        <p className="mt-1 text-xs font-bold">
                          {t('history.currentCredit', {
                            amount: formatMinorAmount(
                              entry.currentCreditMinor,
                              entry.settlement.currency,
                            ),
                          })}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function participantName(
  participantId: string,
  currentParticipantId: string,
  participantNames: ReadonlyMap<string, string>,
  you: string,
  fallback: string,
) {
  if (participantId === currentParticipantId) return you
  return participantNames.get(participantId) ?? fallback
}

function settlementFactKey(kind: SettlementHistoryKind) {
  const keys = {
    proposed: 'history.settlementProposed',
    accepted: 'history.settlementAccepted',
    declined: 'history.settlementDeclined',
    proposal_cancelled: 'history.settlementProposalCancelled',
    reversed: 'history.settlementReversed',
    legacy_reversed: 'history.settlementLegacyReversed',
  } as const
  return keys[kind]
}
