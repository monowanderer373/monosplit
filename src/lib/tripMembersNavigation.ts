import {saveNavigationSession} from './navigationStorage'
import {spaceParentState} from './spaceNavigation'
import type { Location, NavigateFunction } from 'react-router-dom'
const prefix = 'tt:trip-members-origin:'
type Origin = { identity: string; trip: string; path: string; index: number; key: string; unavailable?: boolean; parent?: ReturnType<typeof spaceParentState>; scroll?:number;focus?:string }
const memory = new Map<string,Origin>()
export const tripMembersPath = (id: string) => `/space/${encodeURIComponent(id)}/members`
export const tripOverviewPath = (id: string) => `/travel/trip/${encodeURIComponent(id)}`
export function validMembersOriginPath(path: string, trip: string) {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\#]/.test(path)) return false
  try{decodeURIComponent(path)}catch{return false}
  const [rawPathname,search=''] = path.split('?')
  const pathname=rawPathname.replace(/\/+$/,'')
  return (pathname === tripOverviewPath(trip) || pathname === `/space/${encodeURIComponent(trip)}`) && new URLSearchParams(search).get('section') !== 'members'
}
function save(token:string,origin:Origin) {
  memory.set(token,origin);if(memory.size>40)memory.delete(memory.keys().next().value!)
  try{saveNavigationSession(prefix,token,JSON.stringify(origin))}catch{/* In-memory provenance remains usable for this session. */}
}
export function readMembersOrigin(state: unknown, identity: string, trip: string): Origin | null {
  const token = (state as {tripMembersOrigin?:unknown}|null)?.tripMembersOrigin
  if (typeof token !== 'string' || !/^[a-f0-9-]{36}$/i.test(token)) return null
  try {
    const value=memory.get(token) ?? JSON.parse(sessionStorage.getItem(prefix+token)??'null') as Origin|null
    return value && value.identity === identity && value.trip === trip && (validMembersOriginPath(value.path,trip)||(value.unavailable===true&&['/shared?tab=trips','/'].includes(value.path))) && Number.isSafeInteger(value.index) && typeof value.key === 'string' ? value : null
  }catch{return null}
}
/** Replace the source entry with its scroll state before pushing a single Members entry. */
export function openTripMembers(navigate: NavigateFunction, location: Pick<Location,'pathname'|'search'|'state'>, identity:string, trip:string,focus='trip-members') {
  const path=location.pathname.replace(/\/+$/,'')+location.search
  if(!validMembersOriginPath(path,trip))return
  const token=crypto.randomUUID()
  navigate(path,{replace:true,state:{...location.state,spaceReturn:undefined,tripDatesReturn:undefined,membersReturn:token,restoreScroll:window.scrollY}})
  save(token,{identity,trip,path,index:window.history.state?.idx??0,key:window.history.state?.key??'',parent:spaceParentState(location.state,identity,location.pathname),scroll:window.scrollY,focus})
  navigate(tripMembersPath(trip),{state:{tripMembersOrigin:token}})
}
/** Seed a deterministic same-trip entry for direct links/reloads without trusted provenance. */
export function prepareMembersBack(navigate:NavigateFunction, state:unknown, identity:string,trip:string,unavailable=false,guest=false) {
  const origin=readMembersOrigin(state,identity,trip)
  if(origin && window.history.state?.idx === origin.index+1 && (!unavailable||origin.unavailable))return
  const path=unavailable?(guest?'/':'/shared?tab=trips'):origin?.path??tripOverviewPath(trip)
  const token=crypto.randomUUID()
  navigate(path,{replace:true,state:{...origin?.parent,...(origin?.focus?{membersReturn:token}:{}),restoreScroll:origin?.scroll??0}})
  save(token,{identity,trip,path,unavailable,parent:origin?.parent,scroll:origin?.scroll,focus:origin?.focus,index:window.history.state?.idx??0,key:window.history.state?.key??''})
  navigate(tripMembersPath(trip),{state:{tripMembersOrigin:token}})
}
export function backFromMembers(navigate:NavigateFunction,state:unknown,identity:string,trip:string,unavailable=false,guest=false) {
  const origin=readMembersOrigin(state,identity,trip)
  if(origin && window.history.state?.idx === origin.index+1)navigate(-1)
  else navigate(unavailable?(guest?'/':'/shared?tab=trips'):origin?.path??tripOverviewPath(trip),origin?{replace:true,state:{...origin.parent,membersReturn:(state as {tripMembersOrigin?:string})?.tripMembersOrigin,restoreScroll:origin.scroll??0}}:{replace:true})
}
