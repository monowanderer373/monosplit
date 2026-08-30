import type { GroupRole, Participant, Space, SpaceMember, SpaceType } from '../types'
import { supabase } from './supabase'

export type SpaceWithRole = {
  space: Space
  role: GroupRole
}

type SpaceRow = {
  id: string
  type: SpaceType
  name: string
  owner_participant_id: string
  start_date: string | null
  end_date: string | null
  default_currency: string
  status: Space['status']
  version: number
  created_at: string
  updated_at: string
}

function mapSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    ownerParticipantId: row.owner_participant_id,
    startDate: row.start_date,
    endDate: row.end_date,
    defaultCurrency: row.default_currency,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const spaceRepository = {
  async list(): Promise<SpaceWithRole[]> {
    if (!supabase) return []
    const { data: participant } = await supabase.rpc('current_participant_id')
    if (typeof participant !== 'string') return []
    const { data, error } = await supabase
      .from('space_members')
      .select('role, spaces(*)')
      .eq('participant_id', participant)
      .is('removed_at', null)
    if (error) throw error
    return (data ?? []).flatMap((entry) => {
      const row = entry.spaces as unknown as SpaceRow | null
      return row ? [{ space: mapSpace(row), role: entry.role as GroupRole }] : []
    })
  },

  async get(spaceId: string): Promise<SpaceWithRole | null> {
    const spaces = await this.list()
    return spaces.find((entry) => entry.space.id === spaceId) ?? null
  },

  async create(input: {
    type: SpaceType
    name: string
    startDate: string | null
    endDate: string | null
    defaultCurrency: string
  }): Promise<string> {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('create_space', {
      space_type: input.type,
      space_name: input.name,
      start_date: input.startDate,
      end_date: input.endDate,
      default_currency: input.defaultCurrency,
    })
    if (error || typeof data !== 'string') throw error ?? new Error('space_create_failed')
    return data
  },

  async update(input: {
    spaceId: string
    name: string
    startDate: string | null
    endDate: string | null
    defaultCurrency: string
    expectedVersion: number
  }): Promise<number> {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('update_space', {
      target_space_id: input.spaceId,
      space_name: input.name,
      start_date: input.startDate,
      end_date: input.endDate,
      default_currency: input.defaultCurrency,
      expected_version: input.expectedVersion,
    })
    if (error || typeof data !== 'number') throw error ?? new Error('space_update_failed')
    return data
  },

  async listMembers(spaceId: string): Promise<Array<{ member: SpaceMember; participant: Participant }>> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('space_members')
      .select('space_id, participant_id, role, joined_at, removed_at, participants(*)')
      .eq('space_id', spaceId)
      .is('removed_at', null)
    if (error) throw error
    return (data ?? []).flatMap((entry) => {
      const participant = entry.participants as unknown as {
        id: string
        auth_user_id: string | null
        kind: Participant['kind']
        display_name: string
        created_by: string | null
      } | null
      if (!participant) return []
      return [{
        member: {
          spaceId: entry.space_id,
          participantId: entry.participant_id,
          role: entry.role as GroupRole,
          joinedAt: entry.joined_at,
          removedAt: entry.removed_at,
        },
        participant: {
          id: participant.id,
          authUserId: participant.auth_user_id,
          kind: participant.kind,
          displayName: participant.display_name,
          createdBy: participant.created_by,
        },
      }]
    })
  },

  async createInvite(spaceId: string, role: Exclude<GroupRole, 'owner'>): Promise<string> {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('create_space_invite', {
      target_space_id: spaceId,
      invite_role: role,
    })
    if (error || typeof data !== 'string') throw error ?? new Error('invite_create_failed')
    return data
  },

  async addManualMember(spaceId: string, displayName: string): Promise<string> {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('add_manual_space_member', {
      target_space_id: spaceId,
      display_name: displayName,
    })
    if (error || typeof data !== 'string') throw error ?? new Error('manual_member_create_failed')
    return data
  },

  async updateMemberRole(
    spaceId: string,
    participantId: string,
    role: Exclude<GroupRole, 'owner'>,
  ): Promise<void> {
    if (!supabase) throw new Error('not_configured')
    const { error } = await supabase.rpc('update_space_member_role', {
      target_space_id: spaceId,
      target_participant_id: participantId,
      member_role: role,
    })
    if (error) throw error
  },

  async removeMember(spaceId: string, participantId: string): Promise<void> {
    if (!supabase) throw new Error('not_configured')
    const { error } = await supabase.rpc('remove_space_member', {
      target_space_id: spaceId,
      target_participant_id: participantId,
    })
    if (error) throw error
  },

  async previewInvite(token: string): Promise<{
    spaceId: string
    spaceName: string
    spaceType: SpaceType
    role: Exclude<GroupRole, 'owner'>
    expiresAt: string
  } | null> {
    if (!supabase) return null
    const { data, error } = await supabase.rpc('preview_space_invite', { raw_token: token })
    const row = Array.isArray(data) ? data[0] : null
    if (error || !row) return null
    return {
      spaceId: row.space_id,
      spaceName: row.space_name,
      spaceType: row.space_type,
      role: row.invite_role,
      expiresAt: row.expires_at,
    }
  },

  async acceptInvite(token: string): Promise<string> {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('accept_space_invite', { raw_token: token })
    if (error || typeof data !== 'string') throw error ?? new Error('invite_accept_failed')
    return data
  },
}
