import type { CanonicalExpense } from '../types'
import type { CollectPaySnapshot } from '../lib/collectPay'
import type { SettlementPayment } from '../lib/settlementRepository'

export function obligation(amountMinor: number, direction: 'pay' | 'collect' = 'pay', id = 'expense', currency = 'MYR'): CanonicalExpense {
  const debtor = direction === 'pay' ? 'owner' : 'other'
  const creditor = direction === 'pay' ? 'other' : 'owner'
  const participations = [creditor, debtor].map((participantId, order) => ({ id: `${id}:${participantId}`, expenseId: id,
    participantId, nameSnapshot: participantId === 'owner' ? 'Me' : 'Friend', order, state: 'accepted' as const, trackingMode: 'tracked' as const }))
  return { id, clientRequestId: id, scope: 'direct', spaceId: null, createdBy: creditor, totalMinor: amountMinor,
    participantCount: 2, currency, description: `Source ${id}`, category: 'Other', occurredOn: '2026-10-08',
    status: 'active', version: 1, correctsExpenseId: null, terminationKind: null, voidedAt: null,
    createdAt: '2026-10-08T10:00:00Z', updatedAt: '2026-10-08T10:00:00Z', participations,
    payerContributions: [{ expenseId: id, expenseParticipationId: `${id}:${creditor}`, amountMinor }],
    shares: participations.map(p => ({ expenseId: id, expenseParticipationId: p.id, amountMinor: p.participantId === debtor ? amountMinor : 0 })) }
}
export function payment(amountMinor: number, direction: 'pay' | 'collect' = 'pay', state: 'pending' | 'accepted' = 'pending'): SettlementPayment {
  return { id: 'payment', clientRequestId: 'attempt', scope: 'direct', spaceId: null,
    debtorParticipantId: direction === 'pay' ? 'owner' : 'other', currency: 'MYR', amountMinor, paymentDate: '2026-10-09',
    status: state === 'accepted' ? 'confirmed' : 'pending', version: 1, note: null, reversedAt: null, reversedBy: null,
    createdAt: '2026-10-09T10:00:00Z', updatedAt: '2026-10-09T10:00:00Z', allocations: [{ id: 'allocation',
      settlementPaymentId: 'payment', creditorParticipantId: direction === 'pay' ? 'other' : 'owner', amountMinor,
      state, reversalMinor: 0, respondedAt: null, createdAt: '2026-10-09T10:00:00Z' }] }
}
export function snapshot(expenses: CanonicalExpense[] = [obligation(4800)]): CollectPaySnapshot {
  return { owner: 'owner', expenses, payments: [], requests: [], cashLegs: [], cashTrackedPaymentIds: [], accountParticipantIds: ['owner', 'other'],
    people: [{ id: 'person-other', ownerParticipantId: 'owner', displayName: 'Friend', linkedParticipantId: 'other',
      mergedIntoPersonId: null, manualParticipantIds: [], primaryManualParticipantId: null, state: 'linked', friendshipStatus: 'accepted' }],
    spaces: [], accounts: [{ id: 'wallet', name: 'My wallet', accountClass: 'asset', accountType: 'bank', currency: 'MYR',
      archived: false, openingStatus: 'posted', entrySumMinor: 10_000 }] }
}
