import { describe, expect, it } from 'vitest'
import {
  FriendRepositoryError,
  InMemoryFriendRepository,
  type Friendship,
} from './friendRepository'

const friendship: Friendship = {
  id: 'friendship-1',
  participantLowId: 'alice',
  participantHighId: 'bob',
  requestedBy: 'alice',
  status: 'accepted',
  acceptedAt: '2026-08-30T00:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
}

describe('InMemoryFriendRepository contract', () => {
  it('archives a friendship without deleting its history', async () => {
    const repository = new InMemoryFriendRepository([friendship])

    await repository.archiveFriendship(friendship.id)

    expect(await repository.listFriendships()).toEqual([
      expect.objectContaining({
        id: friendship.id,
        status: 'archived',
        acceptedAt: friendship.acceptedAt,
        archivedAt: expect.any(String),
      }),
    ])
  })

  it('blocks a friendship while retaining the same record', async () => {
    const repository = new InMemoryFriendRepository([friendship])

    await repository.blockFriendship(friendship.id)

    expect(await repository.listFriendships()).toEqual([
      expect.objectContaining({ id: friendship.id, status: 'blocked' }),
    ])
  })

  it('does not report a missing invite revocation as success', async () => {
    const repository = new InMemoryFriendRepository()

    await expect(repository.revokeInvite('missing')).rejects.toEqual(
      expect.objectContaining<Partial<FriendRepositoryError>>({
        code: 'not_found',
      }),
    )
  })
})
