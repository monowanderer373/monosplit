/** @vitest-environment jsdom */
import { renderHook, cleanup, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useHomeModel from './useHomeModel'
import { defaultHomeUi } from '../store/useStore'
import { compileLedgerExpense, type LedgerExpenseDraft } from '../lib/compileExpense'
import { buildOptimisticExpense } from '../lib/ledgerOutbox'
import { derivePersonalLedgerRows } from '../lib/ledgerSummary'
import type { useHomeData } from './useHomeData'
import type { Space } from '../types'

afterEach(() => { cleanup(); vi.useRealTimers() })
const a: Space = { id: 'a', type: 'trip', name: 'Mountain weekend', ownerParticipantId: 'owner', startDate: null, endDate: null, defaultCurrency: 'MYR', status: 'active', version: 1, createdAt: '', updatedAt: '' }
const b: Space = { ...a, id: 'b', name: 'Coastal weekend', defaultCurrency: 'USD' }
function expense(trip: string, currency: string, amount: string) {
  const draft: LedgerExpenseDraft = { clientRequestId: `${trip}-${currency}`, currentParticipantId: 'owner', scope: 'space', spaceId: trip,
    amount, currency, category: 'Food', description: `Record ${trip} ${currency}`, occurredOn: '2026-10-09',
    participants: [{ id: 'owner', displayName: 'Me', kind: 'account' }, { id: 'guest', displayName: 'Guest', kind: 'manual' }],
    payerAmounts: { owner: amount, guest: '0' }, splitMode: 'equal', exactShareAmounts: {} }
  const result = compileLedgerExpense(draft)
  if (!result.ok) throw new Error(result.error)
  return buildOptimisticExpense(draft, result.command)
}
const expenses = [expense('a', 'MYR', '48'), expense('a', 'USD', '10'), expense('b', 'USD', '20')]
function input(id = 'a', spacesStatus: 'ready' | 'error' | 'loading' = 'ready', affiliationStatus: 'ready' | 'error' = 'ready') {
  const home: ReturnType<typeof useHomeData> = {
    accounts: { status: 'ready', data: null }, people: { status: 'ready', data: [] }, settlements: { status: 'ready', data: [] },
    spaces: { status: spacesStatus, data: spacesStatus === 'ready' ? [{ space: a, role: 'owner' }, { space: b, role: 'owner' }] : null },
    affiliations: { status: affiliationStatus, data: affiliationStatus === 'ready' ? [] : null }, refreshing: false,
  }
  return { participantId: 'owner', timezone: 'Asia/Kuala_Lumpur', expensesStatus: 'ready' as const, expenses,
    rows: derivePersonalLedgerRows(expenses, 'owner'), home, homeUi: { ...defaultHomeUi, mode: 'travel' as const, selectedTripId: id } }
}
describe('Travel financial and selection model', () => {
  it('uses my share rather than full payment, and separates currencies', () => {
    const view = renderHook(() => useHomeModel(input()))
    expect(view.result.current.tripSpending).toEqual([{ currency: 'MYR', amountMinor: 2400 }, { currency: 'USD', amountMinor: 500 }])
  })
  it('switches name, currency, amount and records atomically during rapid A/B/A selection', () => {
    const view = renderHook(({ id }) => useHomeModel(input(id)), { initialProps: { id: 'a' } })
    for (const id of ['b', 'a', 'b', 'a']) {
      view.rerender({ id })
      expect(view.result.current.trip?.trip.id).toBe(id)
      expect(view.result.current.flatRecords.every(record => record.spaceId === id)).toBe(true)
      expect(view.result.current.tripSpending).toEqual(id === 'b' ? [{ currency: 'USD', amountMinor: 1000 }] : [{ currency: 'MYR', amountMinor: 2400 }, { currency: 'USD', amountMinor: 500 }])
    }
  })
  it('marks failed affiliations unavailable while preserving a readable real Trip', () => {
    const view = renderHook(() => useHomeModel(input('a', 'ready', 'error')))
    expect(view.result.current.trip?.trip.id).toBe('a')
    expect(view.result.current.travelStatus).toBe('error')
    expect(view.result.current.tripSpendingStatus).toBe('error')
  })
  it.each(['loading', 'error'] as const)('does not invent a trip from expense records during %s', status => {
    const view = renderHook(() => useHomeModel(input('a', status)))
    expect(view.result.current.trip).toBeNull()
    expect(view.result.current.recordGroups).toEqual([])
    expect(view.result.current.travelStatus).toBe(status)
  })
})

it('refreshes an unchanged Home model across midnight in the account timezone', () => {
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T15:59:30Z'))
 const stable = input(); stable.home.spaces.data![0].space = { ...a, startDate: '2026-10-01', endDate: '2026-10-10' }
 const view = renderHook(() => useHomeModel(stable))
 expect(view.result.current.trip?.phase).toBe('active'); expect(view.result.current.localToday).toBe('2026-10-10')
 act(() => vi.advanceTimersByTime(60_000)); expect(view.result.current.trip?.phase).toBe('ended'); expect(view.result.current.localToday).toBe('2026-10-11')
})
it('updates immediately after returning from background suspension and respects account timezone', () => {
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T15:00:00Z'))
 const stable = input(); stable.timezone = 'America/New_York'; stable.home.spaces.data![0].space = { ...a, startDate:'2026-10-01', endDate:'2026-10-10' }
 const view = renderHook(() => useHomeModel(stable)); expect(view.result.current.trip?.phase).toBe('active')
 act(() => { vi.setSystemTime(new Date('2026-10-11T05:00:00Z')); window.dispatchEvent(new Event('focus')) })
 expect(view.result.current.trip?.phase).toBe('ended'); view.unmount(); expect(vi.getTimerCount()).toBe(0)
})
