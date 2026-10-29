import type{Page}from'@playwright/test'
import{setupMulticurrency}from'./multicurrency'
import{apiExpense}from'./insightsUi'
import{tripLedgerScenario,tripLedgerPayment,tripLedgerId}from'../../src/test/tripLedgerFixtures'
export{tripLedgerId}
export async function setupTripLedger(page:Page,options:{hidden?:boolean;lang?:string}={}){
 await setupMulticurrency(page,options)
 const state={space:{id:tripLedgerId,name:'Hanoi Trip',type:'trip',owner_participant_id:'owner',status:'active',default_currency:'MYR',version:1,start_date:'2026-11-05',end_date:'2026-11-10',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'},role:'owner',expenses:tripLedgerScenario(),payments:[tripLedgerPayment()],failRead:false,failWrite:false,commitThenFail:false,activityReads:0,writes:[]as{rpc:string;body:Record<string,unknown>}[]}
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const u=new URL(route.request().url()),p=u.pathname
  if(p.endsWith('/rpc/current_participant_id'))return route.fulfill({json:'owner'})
  if(p.endsWith('/space_members')){
   if(state.failRead)return route.fulfill({status:503,json:{message:'Synthetic unavailable read'}})
   if(u.searchParams.get('select')?.includes('spaces('))return route.fulfill({json:[{role:state.role,spaces:state.space}]})
   return route.fulfill({json:['owner','alex','mia'].map((id,i)=>({space_id:tripLedgerId,participant_id:id,role:i?'full_access':state.role,joined_at:'2026-10-01T00:00:00Z',removed_at:null,participants:{id,kind:'account',display_name:i===0?'You':i===1?'Alex':'Mia',auth_user_id:id,created_by:null}}))})
  }
  if(p.endsWith('/expenses'))return route.fulfill({json:state.expenses.map(apiExpense)})
  if(p.endsWith('/settlement_payments'))return route.fulfill({json:state.payments.map(s=>({id:s.id,client_request_id:s.clientRequestId,scope:s.scope,space_id:s.spaceId,debtor_participant_id:s.debtorParticipantId,currency:s.currency,amount_minor:s.amountMinor,payment_date:s.paymentDate,status:s.status,version:s.version,note:s.note,reversed_at:s.reversedAt,reversed_by:s.reversedBy,created_at:s.createdAt,updated_at:s.updatedAt,allocations:s.allocations.map(a=>({id:a.id,settlement_payment_id:a.settlementPaymentId,creditor_participant_id:a.creditorParticipantId,amount_minor:a.amountMinor,state:a.state,responded_at:a.respondedAt,created_at:a.createdAt,shared_restart_cleared:a.sharedRestartCleared,reversals:a.reversalMinor?[{id:'reverse-'+a.id,amount_minor:a.reversalMinor}]:[]}))}))})
  if(p.endsWith('/financial_events')){state.activityReads++;return route.fulfill({json:[]})}
  if(p.endsWith('/rpc/get_trip_friend_states')||p.endsWith('/rpc/get_pending_trip_friend_requests'))return route.fulfill({json:[]})
  if(p.endsWith('/rpc/propose_settlement')){const body=route.request().postDataJSON();state.writes.push({rpc:'propose_settlement',body});let payment=state.payments.find(s=>s.clientRequestId===body.request_id);if(!payment){payment={...tripLedgerPayment(),id:'00000000-0000-4000-8000-000000000460',clientRequestId:body.request_id,debtorParticipantId:'owner',amountMinor:body.total_amount_minor,allocations:[{...tripLedgerPayment().allocations[0],id:'00000000-0000-4000-8000-000000000461',creditorParticipantId:body.creditor_ids[0],amountMinor:body.total_amount_minor}]};state.payments.push(payment)}if(state.failWrite||state.commitThenFail)return route.abort('failed');return route.fulfill({json:payment.id})}
  if(['/rpc/respond_to_settlement','/rpc/reverse_settlement_allocation','/rpc/cancel_pending_settlement'].some(v=>p.endsWith(v))){const body=route.request().postDataJSON();state.writes.push({rpc:p.split('/').pop()!,body});if(state.failWrite)return route.abort('failed');const payment=state.payments.find(s=>s.allocations.some(a=>a.id===body.target_allocation_id))!,allocation=payment.allocations.find(a=>a.id===body.target_allocation_id)!;payment.version++;if(p.endsWith('respond_to_settlement')){allocation.state=body.response;payment.status=body.response==='accepted'?'confirmed':'declined'}else if(p.endsWith('reverse_settlement_allocation'))allocation.reversalMinor=allocation.amountMinor;else allocation.state='cancelled';return route.fulfill({json:{settlement_payment_id:payment.id,allocation_id:allocation.id,payment_status:payment.status,payment_version:payment.version,allocation_state:allocation.state}})}
  return route.fallback()
 })
 return state
}
