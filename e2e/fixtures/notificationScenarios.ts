import type {Page} from '@playwright/test'
import {setupNotifications} from './notifications'
import {noticeExpense} from '../../src/test/notificationFixtures'
import type {DirectExpenseChangeRequest} from '../../src/lib/expenseChangeRepository'
import type {NoticeRow} from '../../src/lib/homeNotifications'
import {obligation,payment} from '../../src/test/collectPayFixtures'
export function apiChange(c:DirectExpenseChangeRequest){return {id:c.id,client_request_id:c.clientRequestId,kind:c.kind,state:c.state,proposed_by:c.proposedBy,target_expense_id:c.targetExpenseId,replacement_expense_id:c.replacementExpenseId,target_version:c.targetVersion,version:c.version,reason:c.reason,created_at:c.createdAt,updated_at:c.updatedAt,approvals:c.approvals.map(a=>({participant_id:a.participantId,state:a.state,responded_at:a.respondedAt,created_at:a.createdAt}))}}
export async function notificationScenario(page:Page,scene:string){
 let releaseRead!:()=>void;const readGate=new Promise<void>(resolve=>{releaseRead=resolve})
 const state=await setupNotifications(page);state.snapshot.funding=[];state.snapshot.expenses=[]
 if(['A1','A2','L1','S1','S2','S3','S4','S5','S6','S7'].includes(scene)){
  const expense=noticeExpense('fixture-expense','Morning coffee');state.snapshot.expenses=[expense]
  state.snapshot.funding=[{id:'fixture-intent',status:scene==='S1'?'posted':scene==='S2'?'cancelled':'pending',version:1,updated_at:'2026-10-15T02:00:00Z',expense_id:expense.id,expense_amount_minor:1200,expense_currency:scene==='A2'?'VND':'MYR',account_id:scene==='A2'||scene==='S1'?'bank':null,account_amount_minor:scene==='S1'?1200:null,account_currency:scene==='S1'?'MYR':null}]
  expense.totalMinor=scene==='A2'?90000:1200;expense.currency=scene==='A2'?'VND':'MYR';expense.payerContributions[0].amountMinor=expense.totalMinor;expense.shares[0].amountMinor=expense.totalMinor
  if(scene==='S3')state.snapshot.funding=[]
  if(scene==='S4')state.failRead=true
  if(scene==='S7')state.snapshot.accounts=[]
 }
 if(scene==='A3'||scene==='L2'){
  state.snapshot.rules=[{id:'rule',title:'Internet bill',status:'active',version:1,updated_at:'2026-10-15',amount_minor:8000,currency:'MYR',funding_account_id:'bank',cadence:'monthly'}]
  state.snapshot.recurring=[{id:'occurrence',rule_id:'rule',status:'pending_review',version:2,updated_at:'2026-10-15T02:00:00Z',scheduled_for:'2026-10-15',effective_amount_minor:8000,effective_currency:'MYR',effective_account_id:'bank'}]
 }
 if(scene==='A4'||scene==='L3'){
  state.snapshot.expenses=[noticeExpense('camera','Camera')];state.snapshot.plans=[{id:'plan',purchase_expense_id:'camera',status:'active',version:1,updated_at:'2026-10-15',currency:'MYR',installment_count:6}]
  state.snapshot.installments=[{id:'installment',plan_id:'plan',status:'failed',version:2,sequence:3,updated_at:'2026-10-15T02:00:00Z',due_on:'2026-10-15',principal_minor:12000,asset_payment_minor:12000,repayment_account_id:'bank',error_code:'personal_account_archived'},{id:'upcoming',plan_id:'plan',status:'scheduled',version:1,sequence:4,updated_at:'2026-10-15',due_on:'2026-11-15',principal_minor:12000,repayment_account_id:'bank'}]
 }
 if(['A5','A6','A7'].includes(scene)){
  const e=obligation(7200,'pay','shared');e.description='Lunch with friends';e.participations.find(p=>p.participantId==='owner')!.state=scene==='A5'?'pending':'accepted';e.shares=[{expenseId:e.id,expenseParticipationId:e.participations.find(p=>p.participantId==='owner')!.id,amountMinor:2400},{expenseId:e.id,expenseParticipationId:e.participations.find(p=>p.participantId==='other')!.id,amountMinor:4800}];state.snapshot.expenses=[e]
  if(scene!=='A5'){
   const replacement={...structuredClone(e),id:'replacement',clientRequestId:'replacement-request',totalMinor:9000,status:'correction_pending' as const,description:'Updated lunch',payerContributions:[{expenseId:'replacement',expenseParticipationId:'replacement-other',amountMinor:9000}],participations:e.participations.map(p=>({...p,id:p.participantId==='owner'?'replacement-owner':'replacement-other',expenseId:'replacement'})),shares:[{expenseId:'replacement',expenseParticipationId:'replacement-owner',amountMinor:3000},{expenseId:'replacement',expenseParticipationId:'replacement-other',amountMinor:6000}]}
   if(scene==='A6')state.snapshot.expenses.push(replacement)
   state.snapshot.changes=[{id:'change',clientRequestId:'change-request',kind:scene==='A6'?'correction':'cancellation',state:'pending',proposedBy:'other',targetExpenseId:e.id,replacementExpenseId:scene==='A6'?'replacement':null,targetVersion:1,version:1,reason:'Updated the original receipt',createdAt:'2026-10-15T02:00:00Z',updatedAt:'2026-10-15T02:00:00Z',approvals:[{participantId:'owner',state:'pending',respondedAt:null,createdAt:'2026-10-15T02:00:00Z'}]}]
  }
 }
 if(scene==='A8'){state.snapshot.expenses=[obligation(5000,'collect')];state.snapshot.payments=[payment(3000,'collect')]}
 if(scene==='A9'){
  state.snapshot.expenses=[obligation(5000)];state.snapshot.requests=[{id:'request',status:'open',version:1,updated_at:'2026-10-15T02:00:00Z',created_at:'2026-10-15T02:00:00Z',scope:'direct',space_id:null,debtor_participant_id:'owner',creditor_participant_id:'other',amount_minor:3000,currency:'MYR',note:'Dinner payment'}]
 }
 if(scene==='A10'){
  const e=noticeExpense('pending:outbox-original','Taxi');e.totalMinor=1800;e.clientRequestId='outbox-original';e.payerContributions[0].amountMinor=1800;e.shares[0].amountMinor=1800
  await page.addInitScript(expense=>{const stored=JSON.parse(localStorage.getItem('monosplit-storage')!);stored.state.ledgerByIdentity={'ui-contract-user':{expenses:[],outbox:[{command:{requestId:'outbox-original',scope:'personal',spaceId:null,totalMinor:1800,currency:'MYR',description:'Taxi',category:'transport',occurredOn:'2026-10-15',participantIds:['owner'],contributionAmounts:[1800],shareAmounts:[1800]},optimisticExpense:expense,status:'rejected',commitState:'unknown',attempts:1,error:'network_error',createdAt:'2026-10-15T02:00:00Z',captureDurationMs:null,captureSource:'manual'}]}};localStorage.setItem('monosplit-storage',JSON.stringify(stored))},e)
 }
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname
  if(path.endsWith('/personal_funding_intents')&&scene==='S5'){await readGate;return route.fallback()}
  if(path.endsWith('/personal_funding_intents')&&scene==='S6')return route.fulfill({status:401,json:{code:'PGRST301',message:'Test-only expired session'}})
  const filtered=(rows:NoticeRow[])=>{const status=url.searchParams.get('status');return status?rows.filter(r=>status==='eq.'+r.status||status.startsWith('in.')&&status.slice(4,-1).split(',').includes(r.status)):rows}
  if(path.endsWith('/personal_recurring_rules'))return route.fulfill({json:state.snapshot.rules})
  if(path.endsWith('/personal_recurring_occurrences'))return route.fulfill({json:filtered(state.snapshot.recurring)})
  if(path.endsWith('/personal_installment_plans'))return route.fulfill({json:state.snapshot.plans})
  if(path.endsWith('/personal_installments'))return route.fulfill({json:filtered(state.snapshot.installments)})
  if(path.endsWith('/direct_expense_change_requests'))return route.fulfill({json:state.snapshot.changes.map(apiChange)})
  if(path.endsWith('/settlement_payment_requests'))return route.fulfill({json:state.snapshot.requests.map(r=>({...r,client_request_id:r.id}))})
  if(path.endsWith('/settlement_payments'))return route.fulfill({json:state.snapshot.payments.map(p=>({id:p.id,client_request_id:p.clientRequestId,scope:p.scope,space_id:p.spaceId,debtor_participant_id:p.debtorParticipantId,currency:p.currency,amount_minor:p.amountMinor,payment_date:p.paymentDate,status:p.status,version:p.version,note:p.note,reversed_at:null,reversed_by:null,created_at:p.createdAt,updated_at:p.updatedAt,cash_tracking_required:true,overpay_disposition:null,source_payment_request_id:null,expected_outstanding_minor:5000,allocations:p.allocations.map(a=>({id:a.id,settlement_payment_id:p.id,creditor_participant_id:a.creditorParticipantId,amount_minor:a.amountMinor,state:a.state,responded_at:a.respondedAt,created_at:a.createdAt,reversals:[]}))}))})
  if(path.endsWith('/person_relationships'))return route.fulfill({json:[{id:'person-other',owner_participant_id:'owner',display_name:'Friend',linked_participant_id:'other',merged_into_person_id:null}]})
  if(path.endsWith('/friendships'))return route.fulfill({json:[{participant_low_id:'other',participant_high_id:'owner',status:'accepted'}]})
  if(path.endsWith('/personal_account_entries')&&url.searchParams.get('select')?.includes('transaction:'))return route.fulfill({json:[{id:'entry',amount_minor:-1250,currency:'MYR',transaction:{kind:'opening',occurred_on:'2026-10-15',memo:'Opening balance'}}]})
  if(path.endsWith('/rpc/respond_to_direct_expense')){
   const args=route.request().postDataJSON();state.writes.push({rpc:'respond_to_direct_expense',...args});const e=state.snapshot.expenses.find(e=>e.id===args.target_expense_id)!;e.participations.find(p=>p.participantId==='owner')!.state=args.response;e.version++;return route.fulfill({json:{expense_id:e.id,version:e.version}})
  }
  if(path.endsWith('/rpc/respond_to_direct_expense_change')){
   const args=route.request().postDataJSON();state.writes.push({rpc:'respond_to_direct_expense_change',...args});const c=state.snapshot.changes.find(c=>c.id===args.target_request_id)!;c.approvals[0].state=args.response;c.state=args.response==='accepted'?'authoritative':'declined';c.version++
   if(c.state==='authoritative'){const e=state.snapshot.expenses.find(e=>e.id===c.targetExpenseId)!;e.status='voided';e.terminationKind=c.kind==='correction'?'corrected':'cancelled';e.version++;const replacement=state.snapshot.expenses.find(e=>e.id===c.replacementExpenseId);if(replacement){replacement.status='active';replacement.correctsExpenseId=e.id}}
   return route.fulfill({json:{request_id:c.id,request_version:c.version,request_state:c.state,replacement_expense_id:c.replacementExpenseId}})
  }
  if(path.endsWith('/rpc/post_personal_recurring_occurrence')||path.endsWith('/rpc/retry_personal_recurring_occurrence')||path.endsWith('/rpc/retry_installment_repayment')){
   const args=route.request().postDataJSON();state.writes.push({rpc:path.split('/').at(-1),...args});const row=state.snapshot.recurring.find(r=>r.id===args.target_occurrence_id)??state.snapshot.installments.find(r=>r.id===args.target_installment_id)!;row.status='posted';row.version++;return route.fulfill({json:{status:'posted',version:row.version}})
  }
  return route.fallback()
 })
 const targets:Record<string,string>={A1:'/?notice=funding&target=fixture-intent',A2:'/?notice=funding&target=fixture-intent',A3:'/?notice=recurring&target=occurrence',A4:'/?notice=installment&target=installment',A5:'/notifications/expense/shared',A6:'/notifications/change/change',A7:'/notifications/change/change',A8:'/notifications/payment/payment',A9:'/notifications/request/request',A10:'/?notice=outbox&target=outbox-original',A11:'/notifications/account/wallet-1',L1:'/notifications/funding/fixture-intent?details=1',L2:'/notifications/recurring/occurrence?details=1',L3:'/notifications/installment/installment?details=1'}
 return {state,releaseRead,path:targets[scene]??'/?notice=funding&target=fixture-intent'}
}
