import { describe, expect, it } from 'vitest'
import type { CanonicalExpense } from '../types'
import {
  suggestCategoryForDescription,
  suggestQuickAddDescriptions,
} from './quickAddSuggestions'

function expense(
  overrides: Partial<CanonicalExpense> & Pick<CanonicalExpense, 'id' | 'description' | 'createdAt'>,
): CanonicalExpense {
  return {
    clientRequestId: overrides.id,
    scope: 'personal',
    spaceId: null,
    createdBy: 'user',
    totalMinor: 1000,
    participantCount: 1,
    currency: 'MYR',
    category: 'Other',
    occurredOn: '2026-09-05',
    status: 'active',
    version: 1,
    voidedAt: null,
    updatedAt: overrides.createdAt,
    participations: [],
    payerContributions: [],
    shares: [],
    ...overrides,
  }
}

describe('Quick Add suggestions', () => {
  it('prioritizes repeated recent descriptions in the current context', () => {
    const expenses = [
      expense({
        id: 'dinner-1',
        description: 'Dinner',
        category: 'Food',
        createdAt: '2026-09-05T19:00:00Z',
      }),
      expense({
        id: 'dinner-2',
        description: 'Dinner',
        category: 'Food',
        createdAt: '2026-09-04T19:00:00Z',
      }),
      expense({
        id: 'taxi',
        description: 'Taxi',
        category: 'Transport',
        createdAt: '2026-07-01T19:00:00Z',
      }),
    ]

    expect(
      suggestQuickAddDescriptions({
        expenses,
        context: { kind: 'personal' },
        now: new Date('2026-09-06T19:00:00Z'),
      })[0],
    ).toMatchObject({ description: 'Dinner', category: 'Food' })
  })

  it('uses deterministic time-of-day fallbacks without history', () => {
    expect(
      suggestQuickAddDescriptions({
        expenses: [],
        context: { kind: 'personal' },
        now: new Date(2026, 8, 6, 8),
      }).map((suggestion) => suggestion.description),
    ).toEqual(['Breakfast', 'Coffee'])
  })

  it('associates an exact historical description with its category', () => {
    const expenses = [
      expense({
        id: 'coffee',
        description: 'Coffee',
        category: 'Food',
        createdAt: '2026-09-05T08:00:00Z',
      }),
    ]
    expect(
      suggestCategoryForDescription({
        expenses,
        context: { kind: 'personal' },
        description: ' coffee ',
      }),
    ).toBe('Food')
  })

  it('keeps Manual history associated after the Person links to an account', () => {
    const historical = expense({
      id: 'manual-history',
      description: 'Old cash lunch',
      category: 'Food',
      createdAt: '2026-09-05T12:00:00Z',
      scope: 'direct',
      participations: [{
        id: 'participation-manual',
        expenseId: 'manual-history',
        participantId: 'manual-lan',
        nameSnapshot: 'Lan',
        order: 1,
        state: 'untracked',
        trackingMode: 'untracked',
      }],
    })

    expect(suggestQuickAddDescriptions({
      expenses: [historical],
      context: {
        kind: 'person',
        personId: 'person-lan',
        participantId: 'account-lan',
        participantIds: ['account-lan', 'manual-lan'],
        participantKind: 'account',
        displayName: 'Lan',
      },
      now: new Date('2026-09-06T12:00:00Z'),
    })[0]?.description).toBe('Old cash lunch')
  })
})
