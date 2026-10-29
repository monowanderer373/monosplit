import {saveNavigationSession} from './navigationStorage'
import type { Location, NavigateFunction } from 'react-router-dom'
import type { SpaceType } from '../types'
import { readSharedOrigin } from './sharedAOrigin'
import { useStore } from '../store/useStore'

type PageLocation = Pick<Location, 'pathname' | 'search' | 'state'>
type ParentState = { spaceNav?: string; ledgerOrigin?: string; tripDatesReturn?: string }
export type SpaceOrigin = { actor: string; target: string; source: string; index: number; key: string; scroll: number; focus: string; parent: ParentState; travel?: { selected: string | null; density: 'detailed' | 'compact' } }
const memory = new Map<string, SpaceOrigin>(), prefix = 'tt:space-nav:'
const uuid = /^[a-f0-9-]{36}$/i
export const sharedSpacePath = (type: SpaceType) => '/shared?tab=' + (type === 'group' ? 'groups' : 'trips')
export function canonicalShared(search: string, fallback: 'groups' | 'trips' | 'friends' = 'friends') {
  const input = new URLSearchParams(search), p = new URLSearchParams()
  const tab = ['groups', 'trips', 'friends'].includes(input.get('tab') ?? '') ? input.get('tab')! : fallback
  if (tab !== 'friends') p.set('tab', tab)
  if (input.get('search') === '1') p.set('search', '1')
  if (input.get('q')) p.set('q', input.get('q')!.slice(0, 300))
  if (tab === 'friends') {
    if (input.get('view') === 'review') p.set('view', 'review')
    if (input.get('filter') === 'balances') p.set('filter', 'balances')
    if (/^[A-Z]{3}$/.test(input.get('currency') ?? '')) p.set('currency', input.get('currency')!)
  } else if (input.get('create') === '1') p.set('create', '1')
  if (tab === 'trips' && input.get('return') === 'travel') p.set('return', 'travel')
  return '/shared' + (p.size ? '?' + p.toString() : '')
}
export function legacySpaceDestination(path: string, search: string, actor = '', currency = 'MYR') {
  // The retired component read only create and return. Never invent legacy
  // type/ID/search/token semantics from other query parameters.
  const old = new URLSearchParams(search), p = new URLSearchParams()
  const actual = path === '/spaces' || path === '/travel/manage'
  if(actual&&old.get('create')==='1')p.set('create','1')
  if(path==='/travel/manage'&&old.get('return')==='travel')p.set('return','travel')
  const preferred = actor ? readSharedOrigin(actor, currency).tab : 'trips'
  const tab = path.startsWith('/group/') ? 'groups' : path === '/travel/manage' || p.get('create') === '1' ? 'trips' : preferred === 'groups' ? 'groups' : 'trips'
  return canonicalShared('?'+p.toString(), tab)
}
function validPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length > 1800 || !path.startsWith('/') || path.startsWith('//') || /[\\#]/.test(path)) return false
  try { decodeURIComponent(path) } catch { return false }
  if (path === '/') return true
  if (path.startsWith('/shared')) {if(path.split('?')[0]!=='/shared')return false;const actual=new URLSearchParams(path.split('?')[1]??''),expected=new URLSearchParams(canonicalShared(path.slice('/shared'.length)).split('?')[1]??'');actual.sort();expected.sort();return actual.toString()===expected.toString()}
  return /^\/(?:space|travel\/trip)\/[a-zA-Z0-9:%_-]+$/.test(path) && !/[\\/?#]/.test(decodeURIComponent(path.split('/').pop()!))
}
function targetPath(path: string) { return path.split('?')[0] }
function save(token: string, origin: SpaceOrigin) {
  memory.set(token, origin)
  try { saveNavigationSession(prefix,token,JSON.stringify(origin)) } catch { /* Same-session memory works without storage. */ }
  while (memory.size > 40) { const oldest = memory.keys().next().value!; memory.delete(oldest); try { sessionStorage.removeItem(prefix + oldest) } catch { /* optional */ } }
}
export function readSpaceOrigin(state: unknown, actor: string, target: string): SpaceOrigin | null {
  const token = (state as { spaceNav?: unknown } | null)?.spaceNav
  if (!actor || typeof token !== 'string' || !uuid.test(token)) return null
  try {
    const v = memory.get(token) ?? JSON.parse(sessionStorage.getItem(prefix + token) ?? 'null') as SpaceOrigin | null
    if (!v || v.actor !== actor || v.target !== targetPath(target) || !validPath(v.source) || targetPath(v.source) === targetPath(target) || !Number.isSafeInteger(v.index) || v.index < 0 || typeof v.key !== 'string' || !Number.isFinite(v.scroll) || v.scroll < 0 || typeof v.focus !== 'string' || v.focus.length>200 || v.scroll>10000000 || (v.travel&&(!['compact','detailed'].includes(v.travel.density)||(v.travel.selected!==null&&(typeof v.travel.selected!=='string'||v.travel.selected.length>200))))) return null
    // An overview may parent only the same Trip ledger; never another Trip.
    if (v.source.startsWith('/travel/trip/') && v.target.startsWith('/space/') && v.source.split('/').pop() !== v.target.split('/').pop()) return null
    return {...v,parent:{...(uuid.test(v.parent?.spaceNav??'')?{spaceNav:v.parent.spaceNav}:{}),...(uuid.test(v.parent?.ledgerOrigin??'')?{ledgerOrigin:v.parent.ledgerOrigin}:{}),...(uuid.test(v.parent?.tripDatesReturn??'')?{tripDatesReturn:v.parent.tripDatesReturn}:{})}}
  } catch { return null }
}
export function spaceParentState(state: unknown, actor: string, path: string): ParentState {
  const value = state as ParentState | null
  if(!readSpaceOrigin(state,actor,path))return {}
  return {spaceNav:value?.spaceNav,...(uuid.test(value?.ledgerOrigin??'')?{ledgerOrigin:value!.ledgerOrigin}:{}),...(uuid.test(value?.tripDatesReturn??'')?{tripDatesReturn:value!.tripDatesReturn}:{})}
}
export function openSpaceNavigation(navigate: NavigateFunction, location: PageLocation, actor: string, target: string, focus = '') {
  const source = location.pathname + location.search
  if (!actor || !validPath(source) || !validPath(targetPath(target)) || targetPath(target) === location.pathname) return
  if(source.startsWith('/travel/trip/')&&targetPath(target).startsWith('/space/')&&location.pathname.split('/').pop()!==targetPath(target).split('/').pop())return
  const token = crypto.randomUUID(), parent = spaceParentState(location.state, actor, location.pathname)
  navigate(source, { replace: true, state: { ...location.state, restoreScroll: window.scrollY, spaceReturn: token } })
  const origin: SpaceOrigin = { actor, target: targetPath(target), source, index: window.history.state?.idx ?? 0, key: window.history.state?.key ?? '', scroll: window.scrollY, focus, parent }
  if (source === '/' || source.startsWith('/travel/trip/')) { const store = useStore.getState(); origin.travel = { selected: store.travelTripByIdentity[actor] ?? null, density: store.homeUi.density } }
  save(token, origin)
  navigate(target, { state: { spaceNav: token, restoreScroll: 0 } })
}
export function restoreTravelOrigin(origin: SpaceOrigin, selected?: string) {
  if (origin.travel) { useStore.getState().setHomeUi({ mode: 'travel', density: origin.travel.density }); useStore.getState().setTravelTrip(origin.actor, selected ?? origin.travel.selected) }
}
export function backSpaceNavigation(navigate: NavigateFunction, state: unknown, actor: string, target: string, fallback: string, selected?: string) {
  const origin = readSpaceOrigin(state, actor, target)
  if (origin) {
    restoreTravelOrigin(origin, selected)
    if (window.history.state?.idx === origin.index + 1) navigate(-1)
    else navigate(origin.source, { replace: true, state: { ...origin.parent, restoreScroll: origin.scroll, spaceReturn: (state as ParentState).spaceNav } })
  } else navigate(fallback, { replace: true })
}
/** Seed one safe parent only for a source-less detail; never infer a parent's permissions. */
export function prepareSpaceBack(navigate: NavigateFunction, location: PageLocation, actor: string, fallback: string) {
  if (!actor) return
  const origin = readSpaceOrigin(location.state, actor, location.pathname)
  if (origin && window.history.state?.idx === origin.index + 1) return
  if (!origin && location.state?.spaceBackSeed === actor + ':' + location.pathname) return
  const source = origin?.source ?? fallback
  if (!validPath(source) || source === location.pathname) return
  const scroll = origin?.scroll ?? 0, token = crypto.randomUUID()
  navigate(source, { replace: true, state: { ...origin?.parent, restoreScroll: scroll, spaceReturn: token } })
  save(token, { ...(origin ?? { actor, target: location.pathname, focus: '', parent: {} }), source, scroll, index: window.history.state?.idx ?? 0, key: window.history.state?.key ?? '' })
  navigate(location.pathname + location.search, { state: { ...location.state, spaceNav: token, spaceBackSeed: actor + ':' + location.pathname, restoreScroll: location.state?.restoreScroll ?? 0 } })
}
export function readSpaceReturn(state: unknown, actor: string, source: string) {
  const token = (state as { spaceReturn?: unknown } | null)?.spaceReturn
  if (typeof token !== 'string' || !uuid.test(token)) return null
  try {
    const origin = memory.get(token) ?? JSON.parse(sessionStorage.getItem(prefix + token) ?? 'null') as SpaceOrigin | null
    return origin && readSpaceOrigin({ spaceNav: token }, actor, origin.target) && origin.source === source ? origin : null
  } catch { return null }
}
