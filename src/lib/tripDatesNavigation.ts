import {saveNavigationSession} from './navigationStorage'
import {spaceParentState} from './spaceNavigation'
import type { Location, NavigateFunction } from 'react-router-dom'
import { tripOverviewPath, validMembersOriginPath } from './tripMembersNavigation'
type Origin = { identity: string; trip: string; path: string; index: number; unavailable?: boolean; parent?: ReturnType<typeof spaceParentState>; scroll?:number }
const prefix = 'tt:trip-dates-origin:', memory = new Map<string, Origin>()
const focusReturns = new Set<string>()
export function armTripDatesReturn(state: unknown) {
  const token = (state as { tripDatesOrigin?: unknown } | null)?.tripDatesOrigin
  if (typeof token === 'string') { focusReturns.add(token); if (focusReturns.size > 40) focusReturns.delete(focusReturns.values().next().value!) }
}
export function pendingTripDatesReturn(state: unknown, consume = false) {
  const token = (state as { tripDatesReturn?: unknown } | null)?.tripDatesReturn
  if (typeof token !== 'string' || !focusReturns.has(token)) return false
  if (consume) focusReturns.delete(token)
  return true
}
export const tripDatesPath = (id: string) => `${tripOverviewPath(id)}/dates`
function store(token: string, origin: Origin) {
  memory.set(token, origin); if (memory.size > 40) memory.delete(memory.keys().next().value!)
  try { saveNavigationSession(prefix,token,JSON.stringify(origin)) } catch { /* Same-session memory retains trusted provenance. */ }
}
export function readTripDatesOrigin(state: unknown, identity: string, trip: string, returning = false): Origin | null {
  const token = (state as { tripDatesOrigin?: unknown; tripDatesReturn?: unknown } | null)?.[returning ? 'tripDatesReturn' : 'tripDatesOrigin']
  if (typeof token !== 'string' || !/^[a-f0-9-]{36}$/i.test(token)) return null
  try {
    const origin = memory.get(token) ?? JSON.parse(sessionStorage.getItem(prefix + token) ?? 'null') as Origin | null
    return origin && origin.identity === identity && origin.trip === trip && Number.isSafeInteger(origin.index) && (validMembersOriginPath(origin.path, trip) || origin.unavailable === true && ['/shared?tab=trips','/'].includes(origin.path)) ? origin : null
  } catch { return null }
}
export function openTripDates(navigate: NavigateFunction, location: Pick<Location, 'pathname' | 'search' | 'state'>, identity: string, trip: string) {
  const path = location.pathname.replace(/\/+$/, '') + location.search
  if (!validMembersOriginPath(path, trip)) return
  const token = crypto.randomUUID()
  navigate(path, { replace: true, state: { ...location.state, restoreScroll: window.scrollY, tripDatesReturn: token } })
  store(token, { identity, trip, path, index: window.history.state?.idx ?? 0, parent:spaceParentState(location.state,identity,location.pathname),scroll:window.scrollY })
  navigate(tripDatesPath(trip), { state: { tripDatesOrigin: token } })
}
export function prepareTripDatesBack(navigate: NavigateFunction, state: unknown, identity: string, trip: string, unavailable = false, guest = false) {
  const origin = readTripDatesOrigin(state, identity, trip)
  if (origin && window.history.state?.idx === origin.index + 1 && (!unavailable || origin.unavailable)) return true
  const path = unavailable ? (guest?'/':'/shared?tab=trips') : origin?.path??tripOverviewPath(trip), token = crypto.randomUUID()
  navigate(path, { replace: true, state: { ...origin?.parent,restoreScroll: origin?.scroll??0, tripDatesReturn: token } })
  store(token, { identity, trip, path, unavailable, parent:origin?.parent,scroll:origin?.scroll,index: window.history.state?.idx ?? 0 })
  navigate(tripDatesPath(trip), { state: { tripDatesOrigin: token } })
  return false
}
export function backFromTripDates(navigate: NavigateFunction, state: unknown, identity: string, trip: string, unavailable = false, guest = false) {
  const origin = readTripDatesOrigin(state, identity, trip)
  if (origin && (!unavailable || origin.unavailable) && window.history.state?.idx === origin.index + 1) navigate(-1)
  else navigate(unavailable ? (guest?'/':'/shared?tab=trips') : origin?.path??tripOverviewPath(trip), origin?{ replace: true,state:{...origin.parent,restoreScroll:origin.scroll??0} }:{replace:true})
}
