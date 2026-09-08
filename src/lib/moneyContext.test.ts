import { describe, expect, it } from 'vitest'
import {
  globalDestinationForPath,
  isSpaceExpenseEligible,
  isValidPersonExpenseTarget,
  resolveRouteMoneyContext,
} from './moneyContext'
import { personToMoneyContext } from './moneyContextCatalog'
import type { PersonRelationship } from '../types'

describe('money context routing', () => {
  it('inherits Personal, a concrete Space route, and a concrete Person route', () => {
    expect(resolveRouteMoneyContext('/')).toEqual({ kind: 'personal' })
    expect(resolveRouteMoneyContext('/quick-add')).toEqual({ kind: 'personal' })
    expect(resolveRouteMoneyContext('/space/space-1')).toEqual({
      kind: 'space-candidate',
      spaceId: 'space-1',
    })
    expect(resolveRouteMoneyContext('/person/person-1')).toEqual({
      kind: 'person-candidate',
      personId: 'person-1',
    })
  })

  it('keeps root and generic surfaces ambiguous', () => {
    for (const pathname of ['/friends', '/spaces', '/profile', '/capture', '/unknown']) {
      expect(resolveRouteMoneyContext(pathname)).toEqual({ kind: 'ambiguous' })
    }
  })

  it('maps nested routes to one of four global destinations', () => {
    expect(globalDestinationForPath('/')).toBe('personal')
    expect(globalDestinationForPath('/capture')).toBe('personal')
    expect(globalDestinationForPath('/friends')).toBe('friends')
    expect(globalDestinationForPath('/person/person-1')).toBe('friends')
    expect(globalDestinationForPath('/spaces')).toBe('groups-trips')
    expect(globalDestinationForPath('/space/space-1')).toBe('groups-trips')
    expect(globalDestinationForPath('/profile')).toBe('me')
  })
})

describe('money context eligibility', () => {
  it('allows only writable active Spaces', () => {
    expect(isSpaceExpenseEligible({ status: 'active' }, 'owner')).toBe(true)
    expect(isSpaceExpenseEligible({ status: 'active' }, 'full_access')).toBe(true)
    expect(isSpaceExpenseEligible({ status: 'active' }, 'view')).toBe(false)
    expect(isSpaceExpenseEligible({ status: 'archived' }, 'owner')).toBe(false)
    expect(isSpaceExpenseEligible({ status: 'voided' }, 'owner')).toBe(false)
  })

  it('rejects stale Person targets without an id or display name', () => {
    expect(isValidPersonExpenseTarget({ id: 'person-1', displayName: 'Lan' })).toBe(true)
    expect(isValidPersonExpenseTarget({ id: '', displayName: 'Lan' })).toBe(false)
    expect(isValidPersonExpenseTarget({ id: 'person-1', displayName: ' ' })).toBe(false)
  })

  it('keys Direct context by Person while carrying its current principal', () => {
    const linked: PersonRelationship = {
      id: 'person-lan',
      ownerParticipantId: 'owner',
      displayName: 'Lan',
      linkedParticipantId: 'account-lan',
      mergedIntoPersonId: null,
      manualParticipantIds: ['manual-lan'],
      primaryManualParticipantId: 'manual-lan',
      state: 'linked',
      friendshipStatus: 'accepted',
    }

    expect(personToMoneyContext(linked)).toEqual({
      kind: 'person',
      personId: 'person-lan',
      participantId: 'account-lan',
      participantIds: ['account-lan', 'manual-lan'],
      participantKind: 'account',
      displayName: 'Lan',
    })
    expect(personToMoneyContext({
      ...linked,
      friendshipStatus: 'blocked',
    })).toBeNull()
  })
})
