import { describe, expect, it } from 'vitest'
import type { CanonicalExpense } from '../types'
import { derivePersonalLedgerRows } from './ledgerSummary'

function buildFivePersonExpense(): CanonicalExpense {
  const states = ['accepted', 'accepted', 'accepted', 'pending', 'untracked'] as const
  const ids = ['dav', 'lan', 'mei', 'sam', 'manual']
  const participations = ids.map((participantId, index) => ({
    id: `p-${participantId}`,
    expenseId: 'expense-1',
    participantId,
    nameSnapshot: participantId,
    order: index,
    state: states[index],
    trackingMode: states[index] === 'untracked' ? 'untracked' as const : 'tracked' as const,
  }))
  return {
    id: 'expense-1',
    clientRequestId: 'request-1',
    scope: 'direct',
    spaceId: null,
    createdBy: 'dav',
    totalMinor: 50_000,
    participantCount: participations.length,
    currency: 'MYR',
    description: 'Dinner',
    category: 'Food',
    occurredOn: '2026-08-30',
    status: 'active',
    version: 1,
    voidedAt: null,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    participations,
    payerContributions: [{
      expenseParticipationId: 'p-dav',
      expenseId: 'expense-1',
      amountMinor: 50_000,
    }],
    shares: participations.map((participation) => ({
      expenseParticipationId: participation.id,
      expenseId: 'expense-1',
      amountMinor: 10_000,
    })),
  }
}

describe('personal ledger summary', () => {
  it('separates personal spending, accepted receivables, pending, and untracked advances', () => {
    const [row] = derivePersonalLedgerRows([buildFivePersonExpense()], 'dav')
    expect(row).toEqual(expect.objectContaining({
      paidMinor: 50_000,
      personalSpendingMinor: 10_000,
      trackedReceivableMinor: 20_000,
      pendingAdvanceMinor: 10_000,
      untrackedAdvanceMinor: 10_000,
    }))
  })

  it('excludes voided expenses', () => {
    const expense = buildFivePersonExpense()
    expense.status = 'voided'
    expect(derivePersonalLedgerRows([expense], 'dav')).toEqual([])
  })

  it('does not turn a pending participant contribution into a tracked payable', () => {
    const expense = buildFivePersonExpense()
    expense.payerContributions = [{
      expenseParticipationId: 'p-sam',
      expenseId: expense.id,
      amountMinor: expense.totalMinor,
    }]

    const [row] = derivePersonalLedgerRows([expense], 'lan')

    expect(row.trackedPayableMinor).toBe(0)
  })
})
