import { describe, expect, it } from 'vitest'
import type { CanonicalExpense, DirectParticipationState, TrackingMode } from '../types'
import {
  deriveRelationalDebtLines,
  summarizeRelationalBalances,
  type ConfirmedSettlement,
} from './relationalBalance'

function directExpense(states: Array<[string, DirectParticipationState, TrackingMode]>): CanonicalExpense {
  const participations = states.map(([participantId, state, trackingMode], order) => ({
    id: `participation-${participantId}`,
    expenseId: 'expense-1',
    participantId,
    nameSnapshot: participantId,
    order,
    state,
    trackingMode,
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
    createdAt: '2026-08-30T10:00:00.000Z',
    updatedAt: '2026-08-30T10:00:00.000Z',
    participations,
    payerContributions: [{
      expenseParticipationId: 'participation-dav',
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

describe('relational balance engine', () => {
  it('keeps pending and manual-untracked shares outside friend balances', () => {
    const expense = directExpense([
      ['dav', 'accepted', 'tracked'],
      ['lan', 'pending', 'tracked'],
      ['manual-a', 'untracked', 'untracked'],
      ['manual-b', 'untracked', 'untracked'],
      ['manual-c', 'untracked', 'untracked'],
    ])

    expect(deriveRelationalDebtLines(
      [expense],
      [],
      { scope: 'direct', participantIds: ['dav', 'lan'] },
    )).toEqual([])
  })

  it('adds only an independently accepted friend share', () => {
    const expense = directExpense([
      ['dav', 'accepted', 'tracked'],
      ['lan', 'accepted', 'tracked'],
      ['manual-a', 'untracked', 'untracked'],
      ['manual-b', 'untracked', 'untracked'],
      ['manual-c', 'untracked', 'untracked'],
    ])

    const lines = deriveRelationalDebtLines(
      [expense],
      [],
      { scope: 'direct', participantIds: ['dav', 'lan'] },
    )
    expect(lines).toEqual([expect.objectContaining({
      debtorParticipantId: 'lan',
      creditorParticipantId: 'dav',
      originalMinor: 10_000,
      remainingMinor: 10_000,
    })])
    expect(summarizeRelationalBalances(lines)).toEqual([
      { participantId: 'dav', currency: 'MYR', netMinor: 10_000 },
      { participantId: 'lan', currency: 'MYR', netMinor: -10_000 },
    ])
  })

  it('keeps a multi-person direct expense scoped to the selected friend pair', () => {
    const expense = directExpense([
      ['dav', 'accepted', 'tracked'],
      ['lan', 'accepted', 'tracked'],
      ['mei', 'accepted', 'tracked'],
      ['manual-a', 'untracked', 'untracked'],
      ['manual-b', 'untracked', 'untracked'],
    ])

    const lines = deriveRelationalDebtLines(
      [expense],
      [],
      { scope: 'direct', participantIds: ['dav', 'lan'] },
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      debtorParticipantId: 'lan',
      creditorParticipantId: 'dav',
    })
  })

  it('applies only creditor-accepted settlement allocations FIFO', () => {
    const expense = directExpense([
      ['dav', 'accepted', 'tracked'],
      ['lan', 'accepted', 'tracked'],
      ['manual-a', 'untracked', 'untracked'],
      ['manual-b', 'untracked', 'untracked'],
      ['manual-c', 'untracked', 'untracked'],
    ])
    const settlement: ConfirmedSettlement = {
      id: 'settlement-1',
      scope: 'direct',
      spaceId: null,
      debtorParticipantId: 'lan',
      currency: 'MYR',
      status: 'partially_confirmed',
      paymentDate: '2026-08-31',
      createdAt: '2026-08-31T10:00:00.000Z',
      allocations: [{
        creditorParticipantId: 'dav',
        amountMinor: 4_000,
        state: 'accepted',
      }],
    }

    const [line] = deriveRelationalDebtLines(
      [expense],
      [settlement],
      { scope: 'direct', participantIds: ['dav', 'lan'] },
    )
    expect(line).toMatchObject({
      originalMinor: 10_000,
      settledMinor: 4_000,
      remainingMinor: 6_000,
    })
  })

  it('never applies a settlement across currencies', () => {
    const expense = directExpense([
      ['dav', 'accepted', 'tracked'],
      ['lan', 'accepted', 'tracked'],
      ['manual-a', 'untracked', 'untracked'],
      ['manual-b', 'untracked', 'untracked'],
      ['manual-c', 'untracked', 'untracked'],
    ])
    const settlement: ConfirmedSettlement = {
      id: 'settlement-1',
      scope: 'direct',
      spaceId: null,
      debtorParticipantId: 'lan',
      currency: 'USD',
      status: 'confirmed',
      paymentDate: '2026-08-31',
      createdAt: '2026-08-31T10:00:00.000Z',
      allocations: [{
        creditorParticipantId: 'dav',
        amountMinor: 10_000,
        state: 'accepted',
      }],
    }

    expect(deriveRelationalDebtLines(
      [expense],
      [settlement],
      { scope: 'direct', participantIds: ['dav', 'lan'] },
    )[0]?.remainingMinor).toBe(10_000)
  })
})
