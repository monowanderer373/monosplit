/** @vitest-environment jsdom */
import { act,cleanup,renderHook,waitFor } from '@testing-library/react'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { useInsightsFx } from './useInsightsFx'
const api=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../lib/supabase',()=>({supabase:api}))
const snapshot=(id:string)=>({id,rates:{USD:{currency:'USD',quote:'MYR',numerator:'1',denominator:'0.25',direction:'MYR-per-foreign',rateDate:'2026-10-13',fetchedAt:'2026-10-13T09:00:00Z',provider:'Frankfurter'}},status:'fresh',fetchedAt:'2026-10-13T09:00:00Z'})
beforeEach(()=>api.rpc.mockReset())
afterEach(()=>{cleanup();vi.useRealTimers()})
it('drops a slow snapshot from an old identity',async()=>{
 let first!:(v:unknown)=>void,second!:(v:unknown)=>void
 api.rpc.mockImplementationOnce(()=>new Promise(r=>{first=r})).mockImplementationOnce(()=>new Promise(r=>{second=r}))
 const hook=renderHook(({identity})=>useInsightsFx(identity,true),{initialProps:{identity:'race-old'}})
 await waitFor(()=>expect(api.rpc).toHaveBeenCalledTimes(1));hook.rerender({identity:'race-new'})
 await waitFor(()=>expect(api.rpc).toHaveBeenCalledTimes(2))
 const newer='10000000-0000-4000-8000-000000000002'
 await act(async()=>second({data:snapshot(newer),error:null}))
 await waitFor(()=>expect(hook.result.current.snapshot.id).toBe(newer))
 await act(async()=>first({data:snapshot('10000000-0000-4000-8000-000000000001'),error:null}))
 expect(hook.result.current.snapshot.id).toBe(newer)
})
it('deduplicates the exact pinned snapshot across route remounts',async()=>{
 const id='10000000-0000-4000-8000-000000000003'
 api.rpc.mockResolvedValue({data:snapshot(id),error:null})
 const a=renderHook(()=>useInsightsFx('route-pinned',true,id));await waitFor(()=>expect(a.result.current.snapshot.id).toBe(id));a.unmount()
 const b=renderHook(()=>useInsightsFx('route-pinned',true,id));await waitFor(()=>expect(b.result.current.snapshot.id).toBe(id))
 expect(api.rpc).toHaveBeenCalledTimes(1);expect(api.rpc).toHaveBeenCalledWith('insights_fx_snapshot',{p_snapshot_id:id})
})
it('keeps last-good quotes on transport failure and enforces retry cooldown',async()=>{
 const id='10000000-0000-4000-8000-000000000004'
 api.rpc.mockResolvedValueOnce({data:snapshot(id),error:null}).mockResolvedValue({data:null,error:new Error('offline')})
 const hook=renderHook(()=>useInsightsFx('network-retry',true));await waitFor(()=>expect(hook.result.current.snapshot.id).toBe(id))
 vi.setSystemTime(new Date(Date.now()+61_000))
 await act(async()=>hook.result.current.retry())
 expect(hook.result.current.snapshot.status).toBe('cached');expect(hook.result.current.snapshot.rates.USD.denominator).toBe('0.25')
 await act(async()=>hook.result.current.retry());expect(api.rpc).toHaveBeenCalledTimes(2)
})
it('retains the same actual cache during a pinned-to-latest refresh',async()=>{
 const id='10000000-0000-4000-8000-000000000005'
 let resolve!:(value:unknown)=>void
 api.rpc.mockResolvedValueOnce({data:snapshot(id),error:null}).mockImplementationOnce(()=>new Promise(r=>{resolve=r}))
 const hook=renderHook(({pinned}:{pinned:string|undefined})=>useInsightsFx('retained-refresh',true,pinned),{initialProps:{pinned:id as string|undefined}})
 await waitFor(()=>expect(hook.result.current.snapshot.id).toBe(id))
 hook.rerender({pinned:undefined});await waitFor(()=>expect(api.rpc).toHaveBeenCalledTimes(2))
 expect(hook.result.current.updating).toBe(true);expect(hook.result.current.snapshot.id).toBe(id)
 await act(async()=>resolve({data:null,error:new Error('offline')}))
 await waitFor(()=>expect(hook.result.current.snapshot.status).toBe('cached'))
 expect(hook.result.current.snapshot.id).toBe(id)
})
