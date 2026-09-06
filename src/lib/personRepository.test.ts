import { describe, expect, it } from 'vitest'
import { buildPersonRelationships } from './personRepository'

describe('Person repository mapping', () => {
  it('builds one active Person with Person-bound pending state', () => {
    expect(buildPersonRelationships({
      relationships: [{
        id: 'person-1',
        owner_participant_id: 'owner',
        display_name: 'Lan',
        linked_participant_id: null,
        merged_into_person_id: null,
      }],
      manualMappings: [{
        person_id: 'person-1',
        manual_participant_id: 'manual-lan',
        is_primary: true,
      }],
      pendingPersonIds: new Set(['person-1']),
      friendships: [],
    })).toEqual([{
      id: 'person-1',
      ownerParticipantId: 'owner',
      displayName: 'Lan',
      linkedParticipantId: null,
      mergedIntoPersonId: null,
      manualParticipantIds: ['manual-lan'],
      primaryManualParticipantId: 'manual-lan',
      state: 'link-pending',
      friendshipStatus: null,
    }])
  })

  it('keeps archived/blocked identity but excludes merged aliases', () => {
    const people = buildPersonRelationships({
      relationships: [
        {
          id: 'person-archived',
          owner_participant_id: 'owner',
          display_name: 'Archived',
          linked_participant_id: 'account-archived',
          merged_into_person_id: null,
        },
        {
          id: 'person-alias',
          owner_participant_id: 'owner',
          display_name: 'Old Manual',
          linked_participant_id: 'account-archived',
          merged_into_person_id: 'person-archived',
        },
      ],
      manualMappings: [],
      pendingPersonIds: new Set(),
      friendships: [{
        participant_low_id: 'account-archived',
        participant_high_id: 'owner',
        status: 'archived',
      }],
    })

    expect(people).toHaveLength(1)
    expect(people[0]).toMatchObject({
      id: 'person-archived',
      state: 'linked',
      friendshipStatus: 'archived',
    })
  })
})
