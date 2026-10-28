/** @vitest-environment jsdom */
import {act,cleanup,renderHook} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {useTripMembership} from './useTripMembership'
const calls:Array<{resolve:(value:unknown)=>void;reject:(error:unknown)=>void}>=[]
vi.mock('../lib/tripMembers',()=>({validTripId:(id:string)=>id!=='invalid',readTripMembership:()=>new Promise((resolve,reject)=>calls.push({resolve,reject}))}))
vi.mock('../lib/supabase',()=>({supabase:null}))
const tick=()=>act(async()=>{})
afterEach(()=>{cleanup();calls.length=0})
it('isolates accounts/Trips and ignores out-of-order access responses',async()=>{
 const view=renderHook(({identity,trip})=>useTripMembership(identity,identity,trip),{initialProps:{identity:'a',trip:'one'}});await tick()
 view.rerender({identity:'b',trip:'two'});expect(view.result.current.status).toBe('loading');expect(view.result.current.data).toBeNull();await tick()
 await act(async()=>calls[1].resolve({entry:{space:{id:'two'}},members:[]}));expect(view.result.current.status).toBe('ready')
 await act(async()=>calls[0].resolve({entry:{space:{id:'one'}},members:[]}));expect(view.result.current.data?.entry.space.id).toBe('two')
})
it('clears cached management data when a revalidation fails or membership disappears',async()=>{
 const view=renderHook(()=>useTripMembership('a','a','one'));await tick();await act(async()=>calls[0].resolve({entry:{space:{id:'one'}},members:[]}))
 let done:Promise<unknown>;act(()=>{done=view.result.current.refresh()});expect(view.result.current.data).toBeNull()
 await act(async()=>{calls[1].reject(new Error('network'));await done!});expect(view.result.current.status).toBe('error');expect(view.result.current.data).toBeNull()
 act(()=>{done=view.result.current.refresh()});await act(async()=>{calls[2].resolve(null);await done!});expect(view.result.current.status).toBe('unavailable')
})
