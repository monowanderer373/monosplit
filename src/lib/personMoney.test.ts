import { describe, expect, it } from 'vitest'
import type { CanonicalExpense, PersonRelationship } from '../types'
import {
  canSettleTrackedPerson,
  isUntrackedPersonExpense,
  personExpenses,
  personPrincipalIds,
  trackedDirectContext,
  untrackedRecordTotals,
} from './personMoney'

function person(
  overrides: Partial<PersonRelationship> = {},
): PersonRelationship {
  return {
    id: 'person-lan',
    ownerParticipantId: 'owner',
    displayName: 'Lan',
    linkedParticipantId: null,
    mergedIntoPersonId: null,
    manualParticipantIds: ['manual-lan'],
    primaryManualParticipantId: 'manual-lan',
    state: 'manual',
    friendshipStatus: null,
    ...overrides,
  }
}

function expense(input: {
  id: string
  participantId: string
  trackingMode: 'tracked' | 'untracked'
  state: 'accepted' | 'pending' | 'untracked'
  shareMinor: number
}): CanonicalExpense {
  return {
    id: input.id,
    clientRequestId: input.id,
    scope: 'direct',
    spaceId: null,
    createdBy: 'owner',
    totalMinor: input.shareMinor * 2,
    participantCount: 2,
    currency: 'MYR',
    description: input.id,
    category: 'Food',
    occurredOn: '2026-09-01',
    status: 'active',
    version: 1,
    correctsExpenseId: null,
    terminationKind: null,
    voidedAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    participations: [
      {
        id: `${input.id}-owner`,
        expenseId: input.id,
        participantId: 'owner',
        nameSnapshot: 'You',
        order: 0,
        state: 'accepted',
        trackingMode: 'tracked',
      },
      {
        id: `${input.id}-other`,
        expenseId: input.id,
        participantId: input.participantId,
        nameSnapshot: 'Lan',
        order: 1,
        state: input.state,
        trackingMode: input.trackingMode,
      },
    ],
    payerContributions: [{
      expenseParticipationId: `${input.id}-owner`,
      expenseId: input.id,
      amountMinor: input.shareMinor * 2,
    }],
    shares: [
      {
        expenseParticipationId: `${input.id}-owner`,
        expenseId: input.id,
        amountMinor: input.shareMinor,
      },
      {
        expenseParticipationId: `${input.id}-other`,
        expenseId: input.id,
        amountMinor: input.shareMinor,
      },
    ],
  }
}

describe('Person money display helpers', () => {
  it('keeps linked and manual principals on one stable Person', () => {
    expect(personPrincipalIds(person({
      linkedParticipantId: 'account-lan',
      state: 'linked',
      friendshipStatus: 'accepted',
    }))).toEqual(['account-lan', 'manual-lan'])
  })

  it('includes historical Manual expenses after linking without relabeling them tracked', () => {
    const linked = person({
      linkedParticipantId: 'account-lan',
      state: 'linked',
      friendshipStatus: 'accepted',
    })
    const manualExpense = expense({
      id: 'old-manual',
      participantId: 'manual-lan',
      trackingMode: 'untracked',
      state: 'untracked',
      shareMinor: 2_000,
    })
    const linkedExpense = expense({
      id: 'new-linked',
      participantId: 'account-lan',
      trackingMode: 'tracked',
      state: 'accepted',
      shareMinor: 3_000,
    })
    const related = personExpenses(
      [manualExpense, linkedExpense],
      'owner',
      linked,
    )
    expect(related.map((item) => item.id)).toEqual(['old-manual', 'new-linked'])
    expect(isUntrackedPersonExpense(manualExpense, linked)).toBe(true)
    expect(isUntrackedPersonExpense(linkedExpense, linked)).toBe(false)
    expect(untrackedRecordTotals(related, linked)).toEqual([
      { currency: 'MYR', totalMinor: 2_000 },
    ])
  })

  it('does not treat Manual/Link Pending as a settleable tracked relationship', () => {
    expect(canSettleTrackedPerson(person())).toBe(false)
    expect(canSettleTrackedPerson(person({ state: 'link-pending' }))).toBe(false)
    expect(trackedDirectContext('owner', person())).toBeNull()
    expect(canSettleTrackedPerson(person({
      linkedParticipantId: 'account-lan',
      state: 'linked',
      friendshipStatus: 'accepted',
    }))).toBe(true)
  })
})
