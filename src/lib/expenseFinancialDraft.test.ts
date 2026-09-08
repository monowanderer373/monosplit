import { describe, expect, it } from 'vitest'
import type { CanonicalExpense } from '../types'
import {
  correctionPrincipalSnapshot,
  rescaleMinorAmounts,
} from './expenseFinancialDraft'

describe('expense financial correction draft', () => {
  it('preserves historical Manual Participant UUID identity and order', () => {
    const result = correctionPrincipalSnapshot(fixture())
    expect(result).toEqual({
      currency: 'MYR',
      participantIds: ['owner-uuid', 'historical-manual-uuid'],
    })
  })

  it('S: snapshots currency instead of exposing a currency-changing correction', () => {
    expect(correctionPrincipalSnapshot(fixture()).currency).toBe('MYR')
  })

  it('rescales financial rows deterministically and keeps both sums reconciled', () => {
    expect(rescaleMinorAmounts([10_000, 0], 10_000, 8_000)).toEqual([8_000, 0])
    expect(rescaleMinorAmounts([5_000, 5_000], 10_000, 8_001)).toEqual([4_000, 4_001])
  })
})

function fixture(): CanonicalExpense {
  return {
    id: 'expense',
    clientRequestId: 'request',
    scope: 'direct',
    spaceId: null,
    createdBy: 'owner-uuid',
    totalMinor: 10_000,
    participantCount: 2,
    currency: 'MYR',
    description: 'Dinner',
    category: 'Food',
    occurredOn: '2026-09-08',
    status: 'active',
    version: 1,
    correctsExpenseId: null,
    terminationKind: null,
    voidedAt: null,
    createdAt: '2026-09-08T10:00:00Z',
    updatedAt: '2026-09-08T10:00:00Z',
    participations: [
      {
        id: 'owner-row',
        expenseId: 'expense',
        participantId: 'owner-uuid',
        nameSnapshot: 'Owner',
        order: 0,
        state: 'accepted',
        trackingMode: 'tracked',
      },
      {
        id: 'manual-row',
        expenseId: 'expense',
        participantId: 'historical-manual-uuid',
        nameSnapshot: 'Cash guest',
        order: 1,
        state: 'untracked',
        trackingMode: 'untracked',
      },
    ],
    payerContributions: [],
    shares: [],
  }
}
