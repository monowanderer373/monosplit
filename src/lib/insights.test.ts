import { describe, expect, it } from 'vitest'
import type { CanonicalExpense } from '../types'
import {
  InsightError,
  buildTripRecap,
  summarizeExpensesByCategory,
  summarizeExpensesByMonth,
} from './insights'

function expense(
  id: string,
  totalMinor: number,
  currency: string,
  category: string,
  occurredOn: string,
  status: CanonicalExpense['status'] = 'active',
): CanonicalExpense {
  return {
    id,
    clientRequestId: `request-${id}`,
    scope: 'space',
    spaceId: 'trip-1',
    createdBy: 'dav',
    totalMinor,
    participantCount: 0,
    currency,
    description: null,
    category,
    occurredOn,
    status,
    version: 1,
    voidedAt: status === 'voided' ? `${occurredOn}T00:00:00.000Z` : null,
    createdAt: `${occurredOn}T00:00:00.000Z`,
    updatedAt: `${occurredOn}T00:00:00.000Z`,
    participations: [],
    payerContributions: [],
    shares: [],
  }
}

const tripExpenses = [
  expense('1', 1_001, 'MYR', 'Food', '2026-08-30'),
  expense('2', 2_002, 'MYR', 'Food', '2026-08-31'),
  expense('3', 3_003, 'MYR', 'Stay', '2026-09-01'),
  expense('4', 4_004, 'SGD', 'Food', '2026-08-31'),
  expense('5', 9_999, 'MYR', 'Food', '2026-08-01', 'voided'),
] as const

describe('insights', () => {
  it('summarizes integer minor units by month and currency', () => {
    expect(summarizeExpensesByMonth(tripExpenses)).toEqual([
      { currency: 'MYR', month: '2026-08', totalMinor: 3_003, expenseCount: 2 },
      { currency: 'MYR', month: '2026-09', totalMinor: 3_003, expenseCount: 1 },
      { currency: 'SGD', month: '2026-08', totalMinor: 4_004, expenseCount: 1 },
    ])
  })

  it('keeps the same category in different currencies in separate buckets', () => {
    expect(summarizeExpensesByCategory(tripExpenses)).toEqual([
      { currency: 'MYR', category: 'Food', totalMinor: 3_003, expenseCount: 2 },
      { currency: 'MYR', category: 'Stay', totalMinor: 3_003, expenseCount: 1 },
      { currency: 'SGD', category: 'Food', totalMinor: 4_004, expenseCount: 1 },
    ])
  })

  it('builds a trip recap with one total per currency', () => {
    const recap = buildTripRecap(tripExpenses)

    expect(recap).toEqual(expect.objectContaining({
      expenseCount: 4,
      firstOccurredOn: '2026-08-30',
      lastOccurredOn: '2026-09-01',
    }))
    expect(recap.currencies.map(({ currency, totalMinor, expenseCount }) => ({
      currency,
      totalMinor,
      expenseCount,
    }))).toEqual([
      { currency: 'MYR', totalMinor: 6_006, expenseCount: 3 },
      { currency: 'SGD', totalMinor: 4_004, expenseCount: 1 },
    ])
  })

  it('rejects unsafe or non-integer minor amounts', () => {
    expect(() => summarizeExpensesByMonth([
      expense('bad', 1.5, 'MYR', 'Food', '2026-08-30'),
    ])).toThrowError(InsightError)
  })
})
