/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useTravelMembers, type TravelMembers } from './useTravelMembers'
const calls: Array<{ resolve: (data: TravelMembers) => void; reject: () => void }> = []
vi.mock('../lib/spaceRepository', () => ({ spaceRepository: { listMembers: () => new Promise((resolve, reject) => calls.push({ resolve, reject })) } }))
vi.mock('../lib/supabase',()=>({supabase:null}))
const rows=[{participant:{id:'one',displayName:'One',kind:'account'},member:{participantId:'one',role:'owner',removedAt:null}}]as TravelMembers
const tick=()=>act(async()=>{})
afterEach(() => { cleanup(); calls.length = 0;vi.useRealTimers() })
it('ignores late trip results and resets immediately when the identity changes', async () => {
  const view = renderHook(({ owner, trip }) => useTravelMembers(owner, trip, ''), { initialProps: { owner: 'one', trip: 'a' } });await tick()
  view.rerender({ owner: 'one', trip: 'b' });await tick()
  await act(async () => { calls[1].resolve(rows) })
  expect(view.result.current.status).toBe('ready')
  await act(async () => { calls[0].reject() })
  expect(view.result.current.status).toBe('ready')
  view.rerender({ owner: 'two', trip: 'b' })
  expect(view.result.current.status).toBe('loading');expect(view.result.current.data).toEqual([])
})
it('does not request shared members for a personal label',async () => {
 renderHook(() => useTravelMembers('one', 'affiliation:a', ''));await tick();expect(calls).toHaveLength(0)
})
it('never presents a successfully empty or removed-owner snapshot as zero people',async()=>{
 const view=renderHook(()=>useTravelMembers('one','a',''));await tick();await act(async()=>calls[0].resolve([]));expect(view.result.current.status).toBe('error');expect(view.result.current.data).toEqual([])
})
it('refreshes the preview on successful membership changes',async()=>{
 const view=renderHook(()=>useTravelMembers('one','a',''));await tick();await act(async()=>calls[0].resolve(rows));vi.useFakeTimers()
 await act(async()=>{window.dispatchEvent(new CustomEvent('tt:space-members-changed',{detail:{spaceId:'a'}}));vi.advanceTimersByTime(100)})
 expect(view.result.current.status).toBe('loading');expect(calls).toHaveLength(2)
})
