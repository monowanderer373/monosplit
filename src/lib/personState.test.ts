import { describe, expect, it } from 'vitest'
import {
  derivePersonState,
  isPersonDirectEligible,
  resolvePersonFinancialParticipant,
} from './personState'
import type { PersonRelationship } from '../types'

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

describe('Person relationship state', () => {
  it('derives Manual, Link Pending, and Linked without changing principals', () => {
    expect(derivePersonState({
      linkedParticipantId: null,
      hasPendingLinkRequest: false,
    })).toBe('manual')
    expect(derivePersonState({
      linkedParticipantId: null,
      hasPendingLinkRequest: true,
    })).toBe('link-pending')
    expect(derivePersonState({
      linkedParticipantId: 'account-lan',
      hasPendingLinkRequest: true,
    })).toBe('linked')
  })

  it('keeps identity separate from Direct eligibility', () => {
    expect(isPersonDirectEligible(person())).toBe(true)
    expect(isPersonDirectEligible(person({
      linkedParticipantId: 'account-lan',
      state: 'linked',
      friendshipStatus: 'accepted',
    }))).toBe(true)
    expect(isPersonDirectEligible(person({
      linkedParticipantId: 'account-lan',
      state: 'linked',
      friendshipStatus: 'archived',
    }))).toBe(false)
    expect(isPersonDirectEligible(person({
      linkedParticipantId: 'account-lan',
      state: 'linked',
      friendshipStatus: 'blocked',
    }))).toBe(false)
  })

  it('resolves only the current financial Participant', () => {
    expect(resolvePersonFinancialParticipant(person())).toEqual({
      id: 'manual-lan',
      kind: 'manual',
      displayName: 'Lan',
    })
    expect(resolvePersonFinancialParticipant(person({
      linkedParticipantId: 'account-lan',
      state: 'linked',
      friendshipStatus: 'accepted',
    }))).toEqual({
      id: 'account-lan',
      kind: 'account',
      displayName: 'Lan',
    })
  })
})
