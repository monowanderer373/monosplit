import type { CanonicalExpense } from '../types'
export function spendingExpense(id: string, amount = 1200, scope: CanonicalExpense['scope'] = 'personal', patch: Partial<CanonicalExpense> = {}): CanonicalExpense {
  const people = scope === 'personal' ? ['you'] : ['you', 'other']
  return {
    id, clientRequestId: `request-${id}`, scope, spaceId: scope === 'space' ? 'trip' : null, createdBy: 'you', totalMinor: amount, currency: 'MYR', description: `Record ${id}`, category: 'Food', occurredOn: '2026-10-02', participantCount: people.length, status: 'active', version: 1, correctsExpenseId: null, terminationKind: null, voidedAt: null, createdAt: '2026-10-02T08:00:00Z', updatedAt: '2026-10-02T08:00:00Z',
    participations: people.map((participantId, order) => ({ id: `${id}-${participantId}`, expenseId: id, participantId, nameSnapshot: participantId, order, state: 'accepted', trackingMode: 'tracked' })),
    payerContributions: people.map((participantId, order) => ({ expenseId: id, expenseParticipationId: `${id}-${participantId}`, amountMinor: order === 0 ? amount : 0 })),
    shares: people.map(participantId => ({ expenseId: id, expenseParticipationId: `${id}-${participantId}`, amountMinor: amount / people.length })),
    ...patch,
  }
}
