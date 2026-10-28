import type { Location, NavigateFunction } from 'react-router-dom'
const prefix = 'tt:trip-members-origin:'
type Origin = { identity: string; trip: string; path: string; index: number; key: string; unavailable?: boolean }
const memory = new Map<string,Origin>()
export const tripMembersPath = (id: string) => `/space/${encodeURIComponent(id)}/members`
export const tripOverviewPath = (id: string) => `/travel/trip/${encodeURIComponent(id)}`
export function validMembersOriginPath(path: string, trip: string) {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  const [pathname,search=''] = path.split('?')
  return (pathname === tripOverviewPath(trip) || pathname === `/space/${encodeURIComponent(trip)}`) && new URLSearchParams(search).get('section') !== 'members'
}
function save(token:string,origin:Origin) {
  memory.set(token,origin);if(memory.size>40)memory.delete(memory.keys().next().value!)
  try{sessionStorage.setItem(prefix+token,JSON.stringify(origin))}catch{/* In-memory provenance remains usable for this session. */}
}
export function readMembersOrigin(state: unknown, identity: string, trip: string): Origin | null {
  const token = (state as {tripMembersOrigin?:unknown}|null)?.tripMembersOrigin
  if (typeof token !== 'string' || !/^[a-f0-9-]{36}$/i.test(token)) return null
  try {
    const value=memory.get(token) ?? JSON.parse(sessionStorage.getItem(prefix+token)??'null') as Origin|null
    return value && value.identity === identity && value.trip === trip && (validMembersOriginPath(value.path,trip)||(value.unavailable===true&&value.path==='/shared?tab=trips')) && Number.isSafeInteger(value.index) && typeof value.key === 'string' ? value : null
  }catch{return null}
}
/** Replace the source entry with its scroll state before pushing a single Members entry. */
export function openTripMembers(navigate: NavigateFunction, location: Pick<Location,'pathname'|'search'|'state'>, identity:string, trip:string) {
  const path=location.pathname+location.search
  if(!validMembersOriginPath(path,trip))return
  navigate(path,{replace:true,state:{...location.state,restoreScroll:window.scrollY}})
  const token=crypto.randomUUID()
  save(token,{identity,trip,path,index:window.history.state?.idx??0,key:window.history.state?.key??''})
  navigate(tripMembersPath(trip),{state:{tripMembersOrigin:token}})
}
/** Seed a deterministic same-trip entry for direct links/reloads without trusted provenance. */
export function prepareMembersBack(navigate:NavigateFunction, state:unknown, identity:string,trip:string,unavailable=false) {
  const origin=readMembersOrigin(state,identity,trip)
  if(origin && window.history.state?.idx === origin.index+1 && (!unavailable||origin.unavailable))return
  const path=unavailable?'/shared?tab=trips':tripOverviewPath(trip)
  navigate(path,{replace:true,state:{restoreScroll:0}})
  const token=crypto.randomUUID()
  save(token,{identity,trip,path,unavailable,index:window.history.state?.idx??0,key:window.history.state?.key??''})
  navigate(tripMembersPath(trip),{state:{tripMembersOrigin:token}})
}
export function backFromMembers(navigate:NavigateFunction,state:unknown,identity:string,trip:string,unavailable=false) {
  const origin=readMembersOrigin(state,identity,trip)
  if(origin && window.history.state?.idx === origin.index+1)navigate(-1)
  else navigate(unavailable?'/shared?tab=trips':tripOverviewPath(trip),{replace:true})
}
