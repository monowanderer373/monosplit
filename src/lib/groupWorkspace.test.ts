import { describe, expect, it, vi } from 'vitest'
import type { Group } from '../types'
import {
  buildDiagnosticsText,
  saveExpenseWithRecovery,
  shouldAutoClaim,
  shouldRegisterMembership,
} from './groupWorkspace'

describe('shouldAutoClaim', () => {
  const base = {
    authUserId: 'voo',
    groupId: 'group-1',
    claimStatus: 'idle' as const,
    syncStatus: 'synced' as const,
    ownerId: null,
  }

  it('claims when signed in, idle, synced (or errored), and unclaimed', () => {
    expect(shouldAutoClaim(base)).toBe(true)
    expect(shouldAutoClaim({ ...base, syncStatus: 'error' })).toBe(true)
  })

  it('does not claim when signed out', () => {
    expect(shouldAutoClaim({ ...base, authUserId: undefined })).toBe(false)
  })

  it('does not claim while a claim is already in flight or done', () => {
    expect(shouldAutoClaim({ ...base, claimStatus: 'claiming' })).toBe(false)
    expect(shouldAutoClaim({ ...base, claimStatus: 'claimed' })).toBe(false)
  })

  it('does not claim before the group has finished loading', () => {
    expect(shouldAutoClaim({ ...base, syncStatus: 'loading' })).toBe(false)
    expect(shouldAutoClaim({ ...base, syncStatus: 'offline' })).toBe(false)
  })

  it('does not claim a group that already has an owner', () => {
    expect(shouldAutoClaim({ ...base, ownerId: 'someone-else' })).toBe(false)
  })
})

describe('shouldRegisterMembership', () => {
  const base = {
    authUserId: 'voo',
    groupId: 'group-1',
    hasGroup: true,
    role: 'full_access' as const,
    isAlreadyMember: false,
  }

  it('registers when signed in, the group is loaded, a role resolved, and no row exists yet', () => {
    expect(shouldRegisterMembership(base)).toBe(true)
  })

  it('never registers an owner (ownership lives on the group row, not user_groups)', () => {
    expect(shouldRegisterMembership({ ...base, role: 'owner' })).toBe(false)
  })

  it('does not register twice', () => {
    expect(shouldRegisterMembership({ ...base, isAlreadyMember: true })).toBe(false)
  })

  it('does not register before a role can be resolved', () => {
    expect(shouldRegisterMembership({ ...base, role: null })).toBe(false)
  })

  it('does not register when signed out or the group has not loaded', () => {
    expect(shouldRegisterMembership({ ...base, authUserId: undefined })).toBe(false)
    expect(shouldRegisterMembership({ ...base, hasGroup: false })).toBe(false)
  })
})

describe('buildDiagnosticsText', () => {
  const t = (key: string) => `[${key}]`

  it('joins every field into one line each, falling back to the "none" label for missing values', () => {
    const text = buildDiagnosticsText(t, {
      syncStatus: 'error',
      lastError: 'boom',
      groupId: 'group-1',
      ownerId: null,
      authUserId: undefined,
      role: null,
      membershipRole: null,
      linkedPerson: null,
      canEditExpenseData: false,
    })

    expect(text).toContain('[group.syncDebugStatus]: error')
    expect(text).toContain('[group.syncDebugLastError]: boom')
    expect(text).toContain('[group.syncDebugOwnerId]: [group.syncDebugNone]')
    expect(text).toContain('[group.syncDebugCanEditExpenses]: [group.syncDebugNo]')
  })

  it('formats the linked person as "name (id)"', () => {
    const text = buildDiagnosticsText(t, {
      syncStatus: 'synced',
      lastError: null,
      groupId: 'group-1',
      ownerId: 'voo',
      authUserId: 'voo',
      role: 'owner',
      membershipRole: null,
      linkedPerson: { id: 'p1', name: 'Voo' },
      canEditExpenseData: true,
    })

    expect(text).toContain('[group.syncDebugLinkedPerson]: Voo (p1)')
    expect(text).toContain('[group.syncDebugCanEditExpenses]: [group.syncDebugYes]')
  })
})

describe('saveExpenseWithRecovery', () => {
  function buildGroup(overrides: Partial<Group> = {}): Group {
    return {
      id: 'group-1',
      name: 'Trip',
      startDate: null,
      endDate: null,
      defaultPaidCurrency: 'JPY',
      defaultRepayCurrency: 'MYR',
      people: [],
      expenses: [],
      settlementPayments: [],
      comments: [],
      createdAt: '2026-04-23T00:00:00.000Z',
      ...overrides,
    }
  }

  it('returns the first save result when it succeeds, without registering membership', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, error: null })
    const registerMembership = vi.fn().mockResolvedValue(undefined)

    const result = await saveExpenseWithRecovery(
      { save, registerMembership },
      { group: buildGroup(), ownerId: 'someone-else', authUserId: 'voo' },
    )

    expect(result).toEqual({ ok: true, error: null })
    expect(registerMembership).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('backfills membership and retries once when the first save fails and the user is not the owner', async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'RLS denied' })
      .mockResolvedValueOnce({ ok: true, error: null })
    const registerMembership = vi.fn().mockResolvedValue(undefined)

    const result = await saveExpenseWithRecovery(
      { save, registerMembership },
      { group: buildGroup(), ownerId: 'someone-else', authUserId: 'voo' },
    )

    expect(result).toEqual({ ok: true, error: null })
    expect(registerMembership).toHaveBeenCalledWith('group-1', 'full_access')
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('surfaces the retry result even when the backfill does not fix it', async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'RLS denied' })
      .mockResolvedValueOnce({ ok: false, error: 'still denied' })
    const registerMembership = vi.fn().mockResolvedValue(undefined)

    const result = await saveExpenseWithRecovery(
      { save, registerMembership },
      { group: buildGroup(), ownerId: 'someone-else', authUserId: 'voo' },
    )

    expect(result).toEqual({ ok: false, error: 'still denied' })
    expect(registerMembership).toHaveBeenCalledWith('group-1', 'full_access')
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('does not retry when the user is the owner (a permission backfill could not help)', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, error: 'network down' })
    const registerMembership = vi.fn().mockResolvedValue(undefined)

    const result = await saveExpenseWithRecovery(
      { save, registerMembership },
      { group: buildGroup(), ownerId: 'voo', authUserId: 'voo' },
    )

    expect(result).toEqual({ ok: false, error: 'network down' })
    expect(registerMembership).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does not retry when there is no signed-in user to attribute the membership to', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, error: 'RLS denied' })
    const registerMembership = vi.fn().mockResolvedValue(undefined)

    const result = await saveExpenseWithRecovery(
      { save, registerMembership },
      { group: buildGroup(), ownerId: null, authUserId: undefined },
    )

    expect(result).toEqual({ ok: false, error: 'RLS denied' })
    expect(registerMembership).not.toHaveBeenCalled()
  })
})
