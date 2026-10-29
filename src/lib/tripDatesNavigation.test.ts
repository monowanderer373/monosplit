/** @vitest-environment jsdom */
import { beforeEach, expect, it, vi } from 'vitest'
import type { NavigateFunction } from 'react-router-dom'
import { armTripDatesReturn, pendingTripDatesReturn, backFromTripDates, openTripDates, prepareTripDatesBack, readTripDatesOrigin } from './tripDatesNavigation'
const trip = '00000000-0000-4000-8000-000000000001'
beforeEach(() => { sessionStorage.clear(); window.history.replaceState({ idx: 3, key: 'source' }, '', '/'); vi.stubGlobal('scrollY', 460) })
function navigator() { return vi.fn((path: unknown, options?: { replace?: boolean; state?: unknown }) => { if (typeof path === 'string') { const idx = window.history.state?.idx ?? 0; window.history[options?.replace ? 'replaceState' : 'pushState']({ idx: options?.replace ? idx : idx + 1, usr: options?.state }, '', path) } }) as unknown as NavigateFunction }
it('binds return paths and saved source position to the same account and Trip', () => {
  const navigate = navigator(); openTripDates(navigate, { pathname: `/space/${trip}`, search: '?section=info', state: { retained: 'filter' } }, 'actor', trip)
  const state = window.history.state.usr
  expect(readTripDatesOrigin(state, 'actor', trip)?.path).toBe(`/space/${trip}?section=info`)
  expect(readTripDatesOrigin(state, 'other', trip)).toBeNull(); expect(readTripDatesOrigin(state, 'actor', 'other')).toBeNull()
  expect(navigate).toHaveBeenNthCalledWith(1, `/space/${trip}?section=info`, expect.objectContaining({ replace: true, state: expect.objectContaining({ retained: 'filter', restoreScroll: 460 }) }))
  backFromTripDates(navigate, state, 'actor', trip); expect(navigate).toHaveBeenLastCalledWith(-1)
})
it('rejects foreign, legacy-list and another Trip origin; seeds a safe same-Trip back entry', () => {
  const navigate = navigator()
  for (const path of ['//evil.test', 'https://evil.test', '/spaces', '/travel/trip/other']) openTripDates(navigate, { pathname: path, search: '', state: null }, 'actor', trip)
  expect(navigate).not.toHaveBeenCalled()
  prepareTripDatesBack(navigate, { from: 'https://evil.test' }, 'actor', trip)
  expect(readTripDatesOrigin(window.history.state.usr, 'actor', trip)?.path).toBe(`/travel/trip/${trip}`)
  expect(prepareTripDatesBack(navigate, window.history.state.usr, 'actor', trip)).toBe(true)
  expect(navigate).toHaveBeenCalledTimes(2)
})
it('replaces inaccessible provenance with Shared Trips for header and native Back', () => {
  const navigate = navigator(); prepareTripDatesBack(navigate, null, 'actor', trip, true)
  expect(readTripDatesOrigin(window.history.state.usr, 'actor', trip)?.path).toBe('/shared?tab=trips')
  backFromTripDates(navigate, window.history.state.usr, 'actor', trip, true); expect(navigate).toHaveBeenLastCalledWith(-1)
  backFromTripDates(navigate, null, 'actor', trip, true); expect(navigate).toHaveBeenLastCalledWith('/shared?tab=trips', { replace: true })
})

it('restores date-entry focus once per Dates visit, without taking focus after Members or other pages',()=>{const navigate=navigator();openTripDates(navigate,{pathname:`/travel/trip/${trip}`,search:'',state:null},'actor',trip);const date=window.history.state.usr,source=(navigate as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].state;armTripDatesReturn(date);expect(pendingTripDatesReturn(source,true)).toBe(true);expect(pendingTripDatesReturn(source,true)).toBe(false);armTripDatesReturn(date);expect(pendingTripDatesReturn(source,true)).toBe(true)})
