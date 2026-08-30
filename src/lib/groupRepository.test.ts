import { describe, expect, it, vi } from 'vitest'
import type { Group } from '../types'
import { createInMemoryGroupRepository } from './groupRepository.inMemory'

function buildGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    name: 'Trip',
    startDate: null,
    endDate: null,
    defaultPaidCurrency: 'JPY',
    defaultRepayCurrency: 'JPY',
    people: [],
    expenses: [],
    settlementPayments: [],
    createdAt: '2026-04-23T00:00:00.000Z',
    ...overrides,
  }
}

describe('GroupRepository (in-memory adapter contract)', () => {
  it('fetch returns null when the group does not exist remotely', async () => {
    const repo = createInMemoryGroupRepository()
    const record = await repo.fetch('missing-group')
    expect(record).toBeNull()
  })

  it('fetch rejects when the underlying query fails', async () => {
    const repo = createInMemoryGroupRepository()
    repo.__setNextFetchError('network down')

    await expect(repo.fetch('group-1')).rejects.toThrow('network down')
  })

  it('save creates the group and returns version 1 on first write', async () => {
    const repo = createInMemoryGroupRepository()
    const group = buildGroup()

    const result = await repo.save(group.id, group, { version: 0, ownerId: 'user-1' })

    expect(result).toEqual({ ok: true, version: 1 })
    const record = await repo.fetch(group.id)
    expect(record).toEqual({ group, version: 1, ownerId: 'user-1' })
  })

  it('save increments the version on subsequent writes', async () => {
    const repo = createInMemoryGroupRepository()
    const group = buildGroup()
    await repo.save(group.id, group, { version: 0, ownerId: 'user-1' })

    const updated = { ...group, name: 'Trip (renamed)' }
    const result = await repo.save(group.id, updated, { version: 1, ownerId: 'user-1' })

    expect(result).toEqual({ ok: true, version: 2 })
    const record = await repo.fetch(group.id)
    expect(record).toEqual({ group: updated, version: 2, ownerId: 'user-1' })
  })

  it('save does not require an existing row — it always upserts (matches current uploadToSupabase behavior)', async () => {
    const repo = createInMemoryGroupRepository()
    const group = buildGroup({ id: 'brand-new' })

    const result = await repo.save(group.id, group, { version: 5, ownerId: null })

    expect(result).toEqual({ ok: true, version: 6 })
  })

  it('save can be made to fail, returning ok:false without mutating stored state', async () => {
    const repo = createInMemoryGroupRepository()
    const group = buildGroup()
    await repo.save(group.id, group, { version: 0, ownerId: 'user-1' })
    repo.__setNextSaveError('RLS violation')

    const updated = { ...group, name: 'Should not persist' }
    const result = await repo.save(group.id, updated, { version: 1, ownerId: 'user-1' })

    expect(result).toEqual({ ok: false, error: 'RLS violation' })
    const record = await repo.fetch(group.id)
    expect(record?.group.name).toBe('Trip')
    expect(record?.version).toBe(1)
  })

  it('fetchMany returns records for known ids and skips unknown ones', async () => {
    const repo = createInMemoryGroupRepository()
    const groupA = buildGroup({ id: 'a' })
    const groupB = buildGroup({ id: 'b' })
    await repo.save(groupA.id, groupA, { version: 0, ownerId: 'user-1' })
    await repo.save(groupB.id, groupB, { version: 0, ownerId: 'user-2' })

    const records = await repo.fetchMany(['a', 'b', 'missing'])

    expect(records).toHaveLength(2)
    expect(records.map((r) => r.group.id).sort()).toEqual(['a', 'b'])
  })

  it('listOwned returns only groups owned by the given user', async () => {
    const repo = createInMemoryGroupRepository()
    const mine = buildGroup({ id: 'mine' })
    const theirs = buildGroup({ id: 'theirs' })
    await repo.save(mine.id, mine, { version: 0, ownerId: 'user-1' })
    await repo.save(theirs.id, theirs, { version: 0, ownerId: 'user-2' })

    const records = await repo.listOwned('user-1')

    expect(records).toHaveLength(1)
    expect(records[0].group.id).toBe('mine')
  })

  it('softDelete marks the group as deleted without bumping the version', async () => {
    const repo = createInMemoryGroupRepository()
    const group = buildGroup()
    await repo.save(group.id, group, { version: 0, ownerId: 'user-1' })

    const deleted = { ...group, deletedAt: '2026-04-24T00:00:00.000Z', deletedBy: 'user-1' }
    const result = await repo.softDelete(group.id, deleted, 'user-1')

    expect(result).toEqual({ ok: true, error: null })
    const record = await repo.fetch(group.id)
    expect(record?.group.deletedAt).toBe('2026-04-24T00:00:00.000Z')
    expect(record?.version).toBe(1)
  })

  it('subscribe notifies listeners when the group is saved, and stops after unsubscribe', async () => {
    const repo = createInMemoryGroupRepository()
    const group = buildGroup()
    const onChange = vi.fn()
    const unsubscribe = repo.subscribe(group.id, onChange)

    await repo.save(group.id, group, { version: 0, ownerId: 'user-1' })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ group, version: 1, ownerId: 'user-1' })

    unsubscribe()
    await repo.save(group.id, { ...group, name: 'Renamed after unsubscribe' }, { version: 1, ownerId: 'user-1' })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('subscribe notifies listeners when the group is soft-deleted', async () => {
    const repo = createInMemoryGroupRepository()
    const group = buildGroup()
    await repo.save(group.id, group, { version: 0, ownerId: 'user-1' })
    const onChange = vi.fn()
    repo.subscribe(group.id, onChange)

    const deleted = { ...group, deletedAt: '2026-04-24T00:00:00.000Z', deletedBy: 'user-1' }
    await repo.softDelete(group.id, deleted, 'user-1')

    expect(onChange).toHaveBeenCalledWith({ group: deleted, version: 1, ownerId: 'user-1' })
  })

  it('subscribe only notifies listeners for the matching groupId', async () => {
    const repo = createInMemoryGroupRepository()
    const groupB = buildGroup({ id: 'b' })
    const onChangeA = vi.fn()
    repo.subscribe('a', onChangeA)

    await repo.save(groupB.id, groupB, { version: 0, ownerId: 'user-1' })

    expect(onChangeA).not.toHaveBeenCalled()
  })
})
