import type {
  PersonFriendshipStatus,
  PersonRelationship,
} from '../types'
import { derivePersonState } from './personState'
import { supabase } from './supabase'

type PersonRelationshipRow = {
  id: string
  owner_participant_id: string
  display_name: string
  linked_participant_id: string | null
  merged_into_person_id: string | null
}

type PersonManualMappingRow = {
  person_id: string
  manual_participant_id: string
  is_primary: boolean
}

type FriendshipCapabilityRow = {
  participant_low_id: string
  participant_high_id: string
  status: string
}

export function buildPersonRelationships(input: {
  relationships: PersonRelationshipRow[]
  manualMappings: PersonManualMappingRow[]
  pendingPersonIds: ReadonlySet<string>
  friendships: FriendshipCapabilityRow[]
}): PersonRelationship[] {
  const mappingsByPerson = new Map<string, PersonManualMappingRow[]>()
  for (const mapping of input.manualMappings) {
    const mappings = mappingsByPerson.get(mapping.person_id) ?? []
    mappings.push(mapping)
    mappingsByPerson.set(mapping.person_id, mappings)
  }

  return input.relationships
    .filter((relationship) => !relationship.merged_into_person_id)
    .map((relationship) => {
      const mappings = (mappingsByPerson.get(relationship.id) ?? [])
        .sort((left, right) =>
          Number(right.is_primary) - Number(left.is_primary)
          || left.manual_participant_id.localeCompare(right.manual_participant_id),
        )
      const friendship = relationship.linked_participant_id
        ? input.friendships.find((candidate) =>
            (
              candidate.participant_low_id === relationship.owner_participant_id
              && candidate.participant_high_id === relationship.linked_participant_id
            )
            || (
              candidate.participant_high_id === relationship.owner_participant_id
              && candidate.participant_low_id === relationship.linked_participant_id
            ),
          )
        : undefined
      const friendshipStatus =
        friendship?.status === 'accepted'
        || friendship?.status === 'archived'
        || friendship?.status === 'blocked'
          ? friendship.status as PersonFriendshipStatus
          : null
      return {
        id: relationship.id,
        ownerParticipantId: relationship.owner_participant_id,
        displayName: relationship.display_name,
        linkedParticipantId: relationship.linked_participant_id,
        mergedIntoPersonId: relationship.merged_into_person_id,
        manualParticipantIds: mappings.map(
          (mapping) => mapping.manual_participant_id,
        ),
        primaryManualParticipantId:
          mappings.find((mapping) => mapping.is_primary)
            ?.manual_participant_id
          ?? mappings[0]?.manual_participant_id
          ?? null,
        state: derivePersonState({
          linkedParticipantId: relationship.linked_participant_id,
          hasPendingLinkRequest: input.pendingPersonIds.has(relationship.id),
        }),
        friendshipStatus,
      }
    })
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName)
      || left.id.localeCompare(right.id),
    )
}

export type PersonRepository = {
  listPeople(): Promise<PersonRelationship[]>
  getPerson(personId: string): Promise<PersonRelationship | null>
  createManualPerson(displayName: string): Promise<string>
  requestLink(personId: string, targetParticipantId: string): Promise<string>
  subscribeToPeople(onChange: () => void): () => void
}

async function listPeople(): Promise<PersonRelationship[]> {
  if (!supabase) return []
  const [
    relationshipsResult,
    mappingsResult,
    requestsResult,
    friendshipsResult,
  ] = await Promise.all([
    supabase
      .from('person_relationships')
      .select(`
        id, owner_participant_id, display_name, linked_participant_id,
        merged_into_person_id
      `)
      .is('merged_into_person_id', null)
      .order('display_name'),
    supabase
      .from('person_manual_participants')
      .select('person_id, manual_participant_id, is_primary'),
    supabase
      .from('participant_link_requests')
      .select('person_relationship_id')
      .eq('status', 'pending')
      .not('person_relationship_id', 'is', null),
    supabase
      .from('friendships')
      .select('participant_low_id, participant_high_id, status'),
  ])

  const error =
    relationshipsResult.error
    ?? mappingsResult.error
    ?? requestsResult.error
    ?? friendshipsResult.error
  if (error) throw new Error(error.message)

  return buildPersonRelationships({
    relationships:
      (relationshipsResult.data ?? []) as PersonRelationshipRow[],
    manualMappings:
      (mappingsResult.data ?? []) as PersonManualMappingRow[],
    pendingPersonIds: new Set(
      (requestsResult.data ?? [])
        .map((row) => row.person_relationship_id)
        .filter((id): id is string => typeof id === 'string'),
    ),
    friendships:
      (friendshipsResult.data ?? []) as FriendshipCapabilityRow[],
  })
}

export const personRepository: PersonRepository = {
  listPeople,

  async getPerson(personId) {
    return (await listPeople()).find((person) => person.id === personId) ?? null
  },

  async createManualPerson(displayName) {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('create_manual_person', {
      display_name: displayName,
    })
    if (error || typeof data !== 'string') {
      throw new Error(error?.message ?? 'manual_person_create_failed')
    }
    return data
  },

  async requestLink(personId, targetParticipantId) {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('request_person_link', {
      target_person_relationship_id: personId,
      target_participant_id: targetParticipantId,
    })
    if (error || typeof data !== 'string') {
      throw new Error(error?.message ?? 'person_link_request_failed')
    }
    return data
  },

  subscribeToPeople(onChange) {
    if (!supabase) return () => undefined
    const channel = supabase
      .channel(`people:${Date.now()}:${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'person_relationships' },
        onChange,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'person_manual_participants',
        },
        onChange,
      )
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  },
}
