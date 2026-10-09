/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useTravelMembers, type TravelMembers } from './useTravelMembers'
const calls: Array<{ resolve: (data: TravelMembers) => void; reject: () => void }> = []
vi.mock('../lib/spaceRepository', () => ({ spaceRepository: { listMembers: () => new Promise((resolve, reject) => calls.push({ resolve, reject })) } }))
afterEach(() => { cleanup(); calls.length = 0 })
it('ignores late trip results and resets immediately when the identity changes', async () => {
  const view = renderHook(({ owner, trip }) => useTravelMembers(owner, trip, ''), { initialProps: { owner: 'one', trip: 'a' } })
  view.rerender({ owner: 'one', trip: 'b' })
  await act(async () => { calls[1].resolve([]) })
  expect(view.result.current.status).toBe('ready')
  await act(async () => { calls[0].reject() })
  expect(view.result.current.status).toBe('ready')
  view.rerender({ owner: 'two', trip: 'b' })
  expect(view.result.current.status).toBe('loading')
  expect(view.result.current.data).toEqual([])
})
it('does not request shared members for a personal label', () => {
  renderHook(() => useTravelMembers('one', 'affiliation:a', ''))
  expect(calls).toHaveLength(0)
})
