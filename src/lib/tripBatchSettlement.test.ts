import {describe,it,expect,beforeEach} from 'vitest'
import {batchCash,batchPairPreview,batchRate,nativeBatchTotals,readBatchRecovery,saveBatchRecovery,clearBatchRecovery} from './tripBatchSettlement'
import {unavailableFx,fraction} from './fx'
const rateFor=(c:string)=>c==='MYR'?fraction(1n):fraction(6000n)
const person=(id:string,minor:number)=>({id,name:id,youOwe:[{currency:'MYR',amountMinor:minor}],theyOwe:[]})
describe('Trip batch reuses Issue08 coverage and keeps cash currencies separate',()=>{
 it('matches the mixed cash example without turning reference value into cash',()=>{
  const rows=[batchPairPreview(person('A',24560),{selected:true,myr:'150',vnd:'573600'},true,rateFor),batchPairPreview(person('B',12040),{selected:true,myr:'120.40',vnd:''},true,rateFor),batchPairPreview(person('C',8525),{selected:true,myr:'85.25',vnd:''},true,rateFor)]
  expect(nativeBatchTotals(rows)).toEqual({MYR:35565n,VND:573600n});expect(rows.reduce((s,r)=>s+r.cash,0n)).toBe(45125n);expect(rows[0].remaining).toBe(0n)
 })
 it('partial leaves exact original balance; switching to MYR removes VND without increasing MYR',()=>{
  const draft={selected:true,myr:'150',vnd:'300000'},c=person('A',24560)
  expect(batchPairPreview(c,draft,true,rateFor).remaining).toBe(4560n)
  expect(batchPairPreview(c,draft,false,rateFor)).toMatchObject({cash:15000n,remaining:9560n,cashLegs:[{currency:'MYR',amountMinor:15000}]})
  expect(draft.vnd).toBe('300000')
 })
 it('supports VND-only, Full uses original coverage rather than ratio residue',()=>{
  const q=batchPairPreview(person('A',24560),{selected:true,myr:'0',vnd:'1473600'},true,rateFor)
  expect(q.cashLegs).toEqual([{currency:'VND',amountMinor:1473600}]);expect(q.quote.coverages[0].remainingMinor).toBe(0n)
 })
 it.each(['0','-1','1.1','1.00','1e3','NaN','9007199254740992'])('rejects invalid VND cash %s',raw=>{
  if(raw==='0')expect(()=>batchPairPreview(person('A',100),{selected:true,myr:'0',vnd:raw},true,rateFor)).toThrow()
  else expect(()=>batchCash(raw,'VND')).toThrow()
 })
 it('rejects overpayment even by one MYR minor',()=>expect(()=>batchPairPreview(person('A',24560),{selected:true,myr:'245.61',vnd:''},false,rateFor)).toThrow())
 it('rounds VND cash once per person and records no arbitrary debt waiver',()=>{
  const q=batchPairPreview(person('A',100),{selected:true,myr:'0',vnd:'5971'},true,rateFor)
  expect(q.cash).toBe(100n);expect(q.remaining).toBe(0n)
  expect(()=>batchPairPreview(person('A',100),{selected:true,myr:'0',vnd:'6030'},true,rateFor)).toThrow()
 })
 it('rate change preserves cash while recalculating remaining',()=>{
  const d={selected:true,myr:'150',vnd:'300000'}
  expect(batchPairPreview(person('A',24560),d,true,c=>c==='MYR'?fraction(1n):fraction(6200n)).remaining).toBe(4721n)
  expect(d).toEqual({selected:true,myr:'150',vnd:'300000'})
 })
 it('missing rate is never zero/identity; custom overrides VND only',()=>{
  expect(batchRate('VND','system','6000',unavailableFx)).toBeNull();expect(batchRate('VND','custom','6000',unavailableFx)).toEqual(fraction(6000n));expect(batchRate('USD','custom','6000',unavailableFx)).toBeNull()
  expect(()=>batchPairPreview(person('A',100),{selected:true,myr:'0',vnd:'100'},true,c=>c==='MYR'?fraction(1n):null)).toThrow('fx_rate_unavailable')
 })
 it('net collect/offset or zero effective coverage is excluded',()=>{
  expect(()=>batchPairPreview({...person('A',100),theyOwe:[{currency:'MYR',amountMinor:200}]},{selected:true,myr:'1',vnd:''},false,rateFor)).toThrow('not_net_payer')
 })
})
describe('batch unknown-result recovery holds only opaque scoped identifiers',()=>{
 const a='00000000-0000-4000-8000-000000000001',t='00000000-0000-4000-8000-000000000002',r={requestId:'00000000-0000-4000-8000-000000000003',quoteId:'00000000-0000-4000-8000-000000000004'}
 beforeEach(()=>localStorage.clear())
 it('survives remount and is isolated by actor and trip',()=>{saveBatchRecovery(a,t,r);expect(readBatchRecovery(a,t)).toEqual(r);expect(readBatchRecovery(t,a)).toBeNull();expect(localStorage.getItem(localStorage.key(0)!)).toBe(JSON.stringify(r));clearBatchRecovery(a,t);expect(readBatchRecovery(a,t)).toBeNull()})
})
