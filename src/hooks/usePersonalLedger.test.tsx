/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PersonalLedgerProvider, usePersonalLedger } from './usePersonalLedger'
import { useStore } from '../store/useStore'
import { spendingExpense } from '../test/spendingFixtures'
import type { CanonicalExpense } from '../types'
const mocks = vi.hoisted(() => ({ identity: 'first', list: vi.fn() }))
vi.mock('./useAuth', () => ({ useAuth: () => ({ authUser: { id: mocks.identity, participantId: 'you' } }) }))
vi.mock('../lib/supabase', () => ({ supabase: null }))
vi.mock('../lib/ledgerRepository', async original => ({ ...await original<typeof import('../lib/ledgerRepository')>(), ledgerRepository: { listExpenses: mocks.list } }))
function deferred() { let resolve!: (data: CanonicalExpense[]) => void; const promise = new Promise<CanonicalExpense[]>(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => { mocks.identity = 'first'; mocks.list.mockReset(); useStore.setState({ ledgerByIdentity: {} }); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('authoritative ledger read isolation', () => {
  it('performs one startup expense read for an online identity with no outbox', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    mocks.list.mockResolvedValue([])
    const view = renderHook(() => usePersonalLedger(), { wrapper: PersonalLedgerProvider })
    await waitFor(() => expect(view.result.current.expensesStatus).toBe('ready'))
    expect(mocks.list).toHaveBeenCalledTimes(1)
  })
  it('discards an older refresh arriving after a newer verified result', async () => {
    const old = deferred(), latest = deferred()
    mocks.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    const view = renderHook(() => usePersonalLedger(), { wrapper: PersonalLedgerProvider })
    expect(view.result.current.expensesStatus).toBe('loading')
    let refresh!: Promise<void>
    act(() => { refresh = view.result.current.refresh() })
    await act(async () => { latest.resolve([spendingExpense('new')]); await refresh })
    await waitFor(() => expect(view.result.current.rows[0].expense.id).toBe('new'))
    await act(async () => { old.resolve([spendingExpense('old')]) })
    expect(view.result.current.rows[0].expense.id).toBe('new')
    expect(view.result.current.expensesStatus).toBe('ready')
  })
  it('cannot publish an old identity response after account switching', async () => {
    const first = deferred(), second = deferred()
    mocks.list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = renderHook(() => usePersonalLedger(), { wrapper: PersonalLedgerProvider })
    mocks.identity = 'second'; view.rerender()
    expect(view.result.current.expensesStatus).toBe('loading')
    await act(async () => { first.resolve([spendingExpense('private-first')]) })
    expect(view.result.current.rows).toEqual([])
    expect(useStore.getState().ledgerByIdentity.first).toBeUndefined()
    await act(async () => { second.resolve([spendingExpense('private-second')]) })
    expect(view.result.current.rows[0].expense.id).toBe('private-second')
    expect(view.result.current.expensesStatus).toBe('ready')
  })
})
