import {expect,it,vi} from 'vitest'
import {createCollectPayRepository,createCollectPayService} from './collectPayRepository'
import {createSettlementRepository} from './settlementRepository'
import {financialFingerprint,buildCollectPayItems} from './collectPay'
import {obligation,payment,snapshot} from '../test/collectPayFixtures'
import {supabase} from './supabase'
vi.mock('./supabase',()=>({supabase:{rpc:vi.fn()}}))
it('routes original versioned settlement mutations through the bound normal actor transport, including decline/cancel/reversal',async()=>{
 const call=vi.fn(async()=>({data:{payment_status:'confirmed',payment_version:2,allocation_state:'accepted'},error:null}))
 const repository=createSettlementRepository(call)
 await repository.respondToAllocation('allocation','declined',4);await repository.cancelPendingAllocation('allocation',5);await repository.reverseAllocation('original-request','allocation',6)
 expect(call.mock.calls).toMatchObject([
  ['respond_to_settlement',{target_allocation_id:'allocation',response:'declined',expected_payment_version:4}],
  ['cancel_pending_settlement_allocation',{target_allocation_id:'allocation',expected_payment_version:5}],
  ['reverse_settlement_allocation',{reversal_request_id:'original-request',target_allocation_id:'allocation',expected_payment_version:6}],
 ]);expect(supabase!.rpc).not.toHaveBeenCalled()
})
it('cannot continue from a delayed fresh receipt read after target context closed, so neither cash authorization nor confirmation dispatches',async()=>{
 let active=true,release!:(s:ReturnType<typeof snapshot>)=>void
 const s=snapshot([obligation(500,'collect')]),p=payment(500,'collect');s.payments=[p];s.cashTrackedPaymentIds=[p.id]
 const dispatched:string[]=[]
 const call=async(name:string)=>{if(!active)throw new Error('notification_context_changed');dispatched.push(name);return {cash_leg_id:'leg'}}
 const settlements=createSettlementRepository(async(name)=>({data:await call(name),error:null}))
 const repo={...createCollectPayRepository(call,settlements),load:()=>new Promise<ReturnType<typeof snapshot>>(r=>{release=r}),directOutstanding:async()=>-500}
 const service=createCollectPayService(repo),fingerprint=financialFingerprint(s,buildCollectPayItems(s)[0])
 const work=service.confirmReceived('owner',p,'allocation','wallet','request',fingerprint);active=false;release(s)
 await expect(work).rejects.toThrow('notification_context_changed');expect(dispatched).toEqual([]);expect(supabase!.rpc).not.toHaveBeenCalled()
})
