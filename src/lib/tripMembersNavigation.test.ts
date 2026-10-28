/** @vitest-environment jsdom */
import {beforeEach,expect,it,vi} from 'vitest'
import type {NavigateFunction} from 'react-router-dom'
import {validMembersOriginPath,openTripMembers,readMembersOrigin,prepareMembersBack,backFromMembers} from './tripMembersNavigation'
const trip='00000000-0000-4000-8000-000000000001'
beforeEach(()=>{sessionStorage.clear();window.history.replaceState({idx:3,key:'source'},'', '/');vi.stubGlobal('scrollY',250)})
function navigator(){return vi.fn((path:unknown,options?:{replace?:boolean;state?:unknown})=>{if(typeof path==='string'){const idx=window.history.state?.idx??0;window.history[options?.replace?'replaceState':'pushState']({idx:options?.replace?idx:idx+1,key:'key-'+Math.random(),usr:options?.state},'',path)}})as unknown as NavigateFunction}
it('allows only same-Trip app origins; refuses foreign URLs and legacy redirect loops',()=>{
 for(const path of ['https://evil.test','//evil.test','/spaces','/travel/trip/other',`/space/${trip}?section=members`])expect(validMembersOriginPath(path,trip)).toBe(false)
 expect(validMembersOriginPath(`/space/${trip}?section=info`,trip)).toBe(true)
})
it('stores source scroll and provenance, rejects another identity/trip, and returns one history entry',()=>{
 const navigate=navigator();openTripMembers(navigate,{pathname:`/space/${trip}`,search:'?section=info',state:{filter:'keep'}},'owner',trip)
 const state=window.history.state.usr
 expect(readMembersOrigin(state,'owner',trip)?.path).toBe(`/space/${trip}?section=info`)
 expect(readMembersOrigin(state,'other',trip)).toBeNull();expect(readMembersOrigin(state,'owner','other')).toBeNull()
 backFromMembers(navigate,state,'owner',trip);expect(navigate).toHaveBeenLastCalledWith(-1)
})
it('seeds same-Trip history for a direct/reloaded URL and never trusts a supplied from URL',()=>{
 const navigate=navigator();prepareMembersBack(navigate,{from:'https://evil.test'},'owner',trip)
 expect(navigate).toHaveBeenNthCalledWith(1,`/travel/trip/${trip}`,{replace:true,state:{restoreScroll:0}})
 expect(readMembersOrigin(window.history.state.usr,'owner',trip)?.path).toBe(`/travel/trip/${trip}`)
 backFromMembers(navigate,{from:'/spaces'},'owner',trip);expect(navigate).toHaveBeenLastCalledWith(`/travel/trip/${trip}`,{replace:true})
})
