import { supabase } from './supabase'

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked' | 'archived'

export type Friendship = {
  id: string
  participantLowId: string
  participantHighId: string
  requestedBy: string
  status: FriendshipStatus
  acceptedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type FriendProfile = {
  friendship: Friendship
  participant: {
    id: string
    displayName: string
  }
}

export type NamedParticipant = {
  id: string
  displayName: string
}

export type ParticipantLinkRequest = {
  id: string
  manualParticipantId: string
  targetParticipantId: string
  requestedBy: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  createdAt: string
}

export type FriendRepositoryErrorCode =
  | 'not_configured'
  | 'not_found'
  | 'server_rejected'

export class FriendRepositoryError extends Error {
  readonly code: FriendRepositoryErrorCode

  constructor(code: FriendRepositoryErrorCode, message: string = code) {
    super(message)
    this.name = 'FriendRepositoryError'
    this.code = code
  }
}

export interface FriendRepository {
  listFriendships(): Promise<Friendship[]>
  listAcceptedFriends(): Promise<FriendProfile[]>
  listArchivedFriends(): Promise<FriendProfile[]>
  listManualParticipants(): Promise<NamedParticipant[]>
  createManualParticipant(displayName: string): Promise<string>
  listLinkRequests(): Promise<ParticipantLinkRequest[]>
  requestManualLink(manualParticipantId: string, targetParticipantId: string): Promise<string>
  respondManualLink(requestId: string, response: 'accepted' | 'declined'): Promise<void>
  createInvite(): Promise<string>
  acceptInvite(token: string): Promise<string>
  revokeInvite(inviteId: string): Promise<void>
  archiveFriendship(friendshipId: string): Promise<void>
  blockFriendship(friendshipId: string): Promise<void>
}

type FriendshipRow = {
  id: string
  participant_low_id: string
  participant_high_id: string
  requested_by: string
  status: FriendshipStatus
  accepted_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

function mapFriendship(row: FriendshipRow): Friendship {
  return {
    id: row.id,
    participantLowId: row.participant_low_id,
    participantHighId: row.participant_high_id,
    requestedBy: row.requested_by,
    status: row.status,
    acceptedAt: row.accepted_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function serverRejected(message?: string): FriendRepositoryError {
  return new FriendRepositoryError('server_rejected', message)
}

export const friendRepository: FriendRepository = {
  async listFriendships() {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, participant_low_id, participant_high_id, requested_by, status,
        accepted_at, archived_at, created_at, updated_at
      `)
      .order('updated_at', { ascending: false })
    if (error) throw serverRejected(error.message)
    return ((data ?? []) as FriendshipRow[]).map(mapFriendship)
  },

  async listAcceptedFriends() {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { data: currentParticipant, error: participantError } = await supabase.rpc('current_participant_id')
    if (participantError || typeof currentParticipant !== 'string') {
      throw serverRejected(participantError?.message ?? 'participant_not_found')
    }
    const friendships = (await this.listFriendships()).filter((friendship) => friendship.status === 'accepted')
    const friendIds = friendships.map((friendship) => (
      friendship.participantLowId === currentParticipant
        ? friendship.participantHighId
        : friendship.participantLowId
    ))
    if (friendIds.length === 0) return []
    const { data, error } = await supabase
      .from('participants')
      .select('id, display_name')
      .in('id', friendIds)
    if (error) throw serverRejected(error.message)
    const names = new Map((data ?? []).map((row) => [row.id, row.display_name]))
    return friendships.flatMap((friendship) => {
      const participantId = friendship.participantLowId === currentParticipant
        ? friendship.participantHighId
        : friendship.participantLowId
      const displayName = names.get(participantId)
      return displayName
        ? [{ friendship, participant: { id: participantId, displayName } }]
        : []
    })
  },

  async listArchivedFriends() {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { data: currentParticipant, error: participantError } = await supabase.rpc('current_participant_id')
    if (participantError || typeof currentParticipant !== 'string') {
      throw serverRejected(participantError?.message ?? 'participant_not_found')
    }
    const friendships = (await this.listFriendships()).filter((friendship) => friendship.status === 'archived')
    const friendIds = friendships.map((friendship) => (
      friendship.participantLowId === currentParticipant
        ? friendship.participantHighId
        : friendship.participantLowId
    ))
    if (friendIds.length === 0) return []
    const { data, error } = await supabase
      .from('participants')
      .select('id, display_name')
      .in('id', friendIds)
    if (error) throw serverRejected(error.message)
    const names = new Map((data ?? []).map((row) => [row.id, row.display_name]))
    return friendships.flatMap((friendship) => {
      const participantId = friendship.participantLowId === currentParticipant
        ? friendship.participantHighId
        : friendship.participantLowId
      const displayName = names.get(participantId)
      return displayName
        ? [{ friendship, participant: { id: participantId, displayName } }]
        : []
    })
  },

  async listManualParticipants() {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw serverRejected(authError?.message ?? 'not_authenticated')
    const { data, error } = await supabase
      .from('participants')
      .select('id, display_name')
      .eq('kind', 'manual')
      .eq('created_by', authData.user.id)
      .order('display_name')
    if (error) throw serverRejected(error.message)
    return (data ?? []).map((row) => ({ id: row.id, displayName: row.display_name }))
  },

  async createManualParticipant(displayName) {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('create_manual_participant', {
      display_name: displayName,
    })
    if (error || typeof data !== 'string') {
      throw serverRejected(error?.message ?? 'manual_participant_create_failed')
    }
    return data
  },

  async listLinkRequests() {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { data, error } = await supabase
      .from('participant_link_requests')
      .select('id, manual_participant_id, target_participant_id, requested_by, status, created_at')
      .order('created_at', { ascending: false })
    if (error) {
      if (error.code === '42P01') return []
      throw serverRejected(error.message)
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      manualParticipantId: row.manual_participant_id,
      targetParticipantId: row.target_participant_id,
      requestedBy: row.requested_by,
      status: row.status as ParticipantLinkRequest['status'],
      createdAt: row.created_at,
    }))
  },

  async requestManualLink(manualParticipantId, targetParticipantId) {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('request_manual_participant_link', {
      manual_participant_id: manualParticipantId,
      target_participant_id: targetParticipantId,
    })
    if (error || typeof data !== 'string') {
      throw serverRejected(error?.message ?? 'manual_link_request_failed')
    }
    return data
  },

  async respondManualLink(requestId, response) {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { error } = await supabase.rpc('respond_manual_participant_link', {
      target_request_id: requestId,
      response,
    })
    if (error) throw serverRejected(error.message)
  },

  async createInvite() {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('create_friend_invite')
    if (error || typeof data !== 'string') {
      throw serverRejected(error?.message ?? 'friend_invite_create_failed')
    }
    return data
  },

  async acceptInvite(token) {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('accept_friend_invite', {
      raw_token: token,
    })
    if (error || typeof data !== 'string') {
      throw serverRejected(error?.message ?? 'friend_invite_accept_failed')
    }
    return data
  },

  async revokeInvite(inviteId) {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { error } = await supabase.rpc('revoke_friend_invite', {
      target_invite_id: inviteId,
    })
    if (error) throw serverRejected(error.message)
  },

  async archiveFriendship(friendshipId) {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { error } = await supabase.rpc('archive_friendship', {
      target_friendship_id: friendshipId,
    })
    if (error) throw serverRejected(error.message)
  },

  async blockFriendship(friendshipId) {
    if (!supabase) throw new FriendRepositoryError('not_configured')
    const { error } = await supabase.rpc('block_friendship', {
      target_friendship_id: friendshipId,
    })
    if (error) throw serverRejected(error.message)
  },
}

export class InMemoryFriendRepository implements FriendRepository {
  private readonly friendships = new Map<string, Friendship>()
  private readonly activeInviteIds = new Set<string>()
  private inviteCounter = 0
  private manualCounter = 0

  constructor(initialFriendships: Friendship[] = []) {
    for (const friendship of initialFriendships) {
      this.friendships.set(friendship.id, { ...friendship })
    }
  }

  async listFriendships(): Promise<Friendship[]> {
    return [...this.friendships.values()].map((friendship) => ({ ...friendship }))
  }

  async listAcceptedFriends(): Promise<FriendProfile[]> {
    return [...this.friendships.values()]
      .filter((friendship) => friendship.status === 'accepted')
      .map((friendship) => ({
        friendship: { ...friendship },
        participant: {
          id: friendship.participantHighId,
          displayName: friendship.participantHighId,
        },
      }))
  }

  async listArchivedFriends(): Promise<FriendProfile[]> {
    return [...this.friendships.values()]
      .filter((friendship) => friendship.status === 'archived')
      .map((friendship) => ({
        friendship: { ...friendship },
        participant: {
          id: friendship.participantHighId,
          displayName: friendship.participantHighId,
        },
      }))
  }

  async listManualParticipants(): Promise<NamedParticipant[]> {
    return []
  }

  async createManualParticipant(): Promise<string> {
    this.manualCounter += 1
    return `manual-${this.manualCounter}`
  }

  async listLinkRequests(): Promise<ParticipantLinkRequest[]> {
    return []
  }

  async requestManualLink(): Promise<string> {
    return 'link-request-1'
  }

  async respondManualLink(): Promise<void> {
    return
  }

  async createInvite(): Promise<string> {
    this.inviteCounter += 1
    const inviteId = `friend-invite-${this.inviteCounter}`
    this.activeInviteIds.add(inviteId)
    return inviteId
  }

  async acceptInvite(token: string): Promise<string> {
    if (!this.activeInviteIds.delete(token)) {
      throw new FriendRepositoryError('not_found')
    }
    return `friendship-${token}`
  }

  async revokeInvite(inviteId: string): Promise<void> {
    if (!this.activeInviteIds.delete(inviteId)) {
      throw new FriendRepositoryError('not_found')
    }
  }

  async archiveFriendship(friendshipId: string): Promise<void> {
    this.setStatus(friendshipId, 'archived')
  }

  async blockFriendship(friendshipId: string): Promise<void> {
    this.setStatus(friendshipId, 'blocked')
  }

  private setStatus(friendshipId: string, status: Extract<FriendshipStatus, 'archived' | 'blocked'>): void {
    const friendship = this.friendships.get(friendshipId)
    if (!friendship) throw new FriendRepositoryError('not_found')
    friendship.status = status
    friendship.archivedAt = '2026-08-30T00:00:00.000Z'
    friendship.updatedAt = friendship.archivedAt
  }
}
