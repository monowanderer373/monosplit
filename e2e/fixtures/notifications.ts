import {setup as base,apiExpense} from './insightsUi'
import {noticeSnapshot,funding,noticeExpense} from '../../src/test/notificationFixtures'
import type {Page} from '@playwright/test'
/** Mocked real application API contract. Never imported by production runtime. */
export async function setupNotifications(page:Page,{hidden=false,many=false,lang='en'}={}){
 const state={snapshot:noticeSnapshot(),failRead:false,failWrite:false,commitThenFail:false,writes:[] as Record<string,unknown>[],delayFirst:0}
 const operations=new Map<string,unknown>(),legs:Record<string,unknown>[]=[]
 if(many)for(let i=3;i<23;i++){const e=noticeExpense('expense-'+i,'A very long record name for notification '+i+' with enough context to identify it');state.snapshot.expenses.push(e);state.snapshot.funding.push(funding('fund-'+i,e.id))}
 if(many)state.snapshot.funding.forEach((f,index)=>{const id='group-account-'+index;state.snapshot.accounts.push({...state.snapshot.accounts[1],id,name:'Long account name for notification '+index});f.account_id=id})
 const entries=state.snapshot.accounts.map((a,i)=>({id:'entry-'+i,account_id:a.id,amount_minor:a.entrySumMinor,currency:a.currency}))
 await base(page,state.snapshot.expenses,200,hidden,lang)
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const path=new URL(route.request().url()).pathname
  if(path.endsWith('/rpc/get_personal_ledger_period_state'))return route.fulfill({json:{schema_version:1,owner_id:'owner',periods:[],archived_expense_ids:[],archived_transaction_ids:[],later_funding:[]}})
  if(path.includes('/participants'))return route.fulfill({json:{id:'owner'}})
  if(path.endsWith('/expenses'))return route.fulfill({json:state.snapshot.expenses.map(apiExpense)})
  if(path.endsWith('/rpc/get_personal_multicurrency_accounts'))return route.fulfill({json:{schema_version:1,accounts:state.snapshot.accounts.map(a=>({id:a.id,parent_account_id:a.parentAccountId??a.id,name:a.name,account_class:a.accountClass,account_type:a.accountType,currency:a.currency,archived_at:a.archived?'2026-10-14':null,opening_status:a.openingStatus,version:a.version??1,parent_version:a.parentVersion??1,display_order:a.displayOrder??0,is_default:a.id==='bank',entry_sum_minor:String(entries.filter(e=>e.account_id===a.id).reduce((sum,e)=>sum+e.amount_minor,0)),entry_count:'1'}))}})
  if(path.endsWith('/personal_funding_bundles'))return route.fulfill({json:state.snapshot.money?.bundles??[]})
  if(path.endsWith('/personal_account_balance_anchors'))return route.fulfill({json:state.snapshot.money?.anchors??[]})
  if(path.endsWith('/personal_funding_bundle_legs'))return route.fulfill({json:legs})
  if(path.endsWith('/rpc/get_personal_money_operation'))return route.fulfill({json:operations.get(route.request().postDataJSON().request_id)??null})
  if(path.endsWith('/rpc/reconcile_personal_money_operation')){
   const result=operations.get(route.request().postDataJSON().request_id)
   return route.fulfill({json:result?{state:'committed',result}:{state:'not_posted'}})
  }
  if(path.endsWith('/rpc/review_changed_personal_funding')){
   const body=route.request().postDataJSON(),row=state.snapshot.funding.find(f=>f.id===body.target_funding_intent_id)!
   row.version++
   state.snapshot.money??={bundles:[],anchors:[]}
   state.snapshot.money.bundles.push({funding_intent_id:row.id,primary_account_id:row.account_id as string|null,confirmed_operation_id:null})
   const result={funding_intent_id:row.id,funding_status:'pending',version:row.version};operations.set(body.request_id,result)
   return route.fulfill({json:result})
  }
  if(path.endsWith('/rpc/confirm_personal_funding_bundle')){
   const body=route.request().postDataJSON();state.writes.push(body)
   if(state.failWrite)return route.abort('failed')
   const row=state.snapshot.funding.find(f=>f.id===body.target_funding_intent_id)!
   for(const [index,leg] of body.actual_legs.entries()){
    const account=state.snapshot.accounts.find(a=>a.id===leg.account_id)!
    entries.push({id:'movement-'+row.id+'-'+index,account_id:account.id,amount_minor:-leg.amount_minor,currency:account.currency})
    legs.push({id:row.id+'-'+index,funding_intent_id:row.id,account_id:account.id,amount_minor:leg.amount_minor,currency:account.currency})
    account.version=(account.version??1)+1;account.parentVersion=account.version
   }
   row.status='posted';row.version++;row.account_id=body.actual_legs[0].account_id;row.account_amount_minor=body.actual_legs[0].amount_minor;row.account_currency=state.snapshot.accounts.find(a=>a.id===row.account_id)!.currency
   const result={funding_intent_id:row.id,funding_status:'posted'};operations.set(body.request_id,result)
   if(state.commitThenFail)return route.abort('failed')
   return route.fulfill({json:result})
  }
  if(path.endsWith('/personal_recurring_rules'))return route.fulfill({json:state.snapshot.rules})
  if(path.endsWith('/personal_recurring_occurrences'))return route.fulfill({json:state.snapshot.recurring})
  if(path.endsWith('/personal_accounts'))return route.fulfill({json:state.snapshot.accounts.map(a=>({id:a.id,name:a.name,account_class:a.accountClass,account_type:a.accountType,currency:a.currency,archived_at:a.archived?'2026-10-14':null,opening_status:a.openingStatus}))})
  if(path.endsWith('/personal_account_entries'))return route.fulfill({json:entries})
  if(path.endsWith('/personal_funding_intents')){
   if(state.failRead)return route.fulfill({status:503,json:{message:'Test-only unavailable',code:'test'}})
   const response=structuredClone(state.snapshot.funding)
   const delayed=state.delayFirst>0
   if(state.delayFirst){const delay=state.delayFirst;state.delayFirst=0;await new Promise(r=>setTimeout(r,delay))}
   return route.fulfill({headers:delayed?{'x-qa-held':'1'}:{},json:response})
  }
  if(path.endsWith('/rpc/complete_pending_funding')){
   const body=route.request().postDataJSON();state.writes.push(body)
   if(state.failWrite)return route.abort('failed')
   const row=state.snapshot.funding.find(f=>f.id===body.target_funding_intent_id)!
   row.status='posted';row.version++;row.account_id=body.target_account_id;row.account_amount_minor=body.account_amount_minor;row.account_currency=state.snapshot.accounts.find(a=>a.id===row.account_id)!.currency
   entries.push({id:'movement-'+row.id,account_id:row.account_id!,amount_minor:-body.account_amount_minor,currency:row.account_currency!})
   if(state.commitThenFail)return route.abort('failed')
   return route.fulfill({json:{funding_intent_id:row.id,funding_status:'posted'}})
  }
  return route.fallback()
 })
 return Object.assign(state,{entries,operations,legs})
}
