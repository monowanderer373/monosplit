import {setup as base,apiExpense} from './insightsUi'
import {noticeSnapshot,funding,noticeExpense} from '../../src/test/notificationFixtures'
import type {Page} from '@playwright/test'
/** Mocked real application API contract. Never imported by production runtime. */
export async function setupNotifications(page:Page,{hidden=false,many=false,lang='en'}={}){
 const state={snapshot:noticeSnapshot(),failRead:false,failWrite:false,commitThenFail:false,writes:[] as Record<string,unknown>[],delayFirst:0}
 if(many)for(let i=3;i<23;i++){const e=noticeExpense('expense-'+i,'A very long record name for notification '+i+' with enough context to identify it');state.snapshot.expenses.push(e);state.snapshot.funding.push(funding('fund-'+i,e.id))}
 const entries=state.snapshot.accounts.map((a,i)=>({id:'entry-'+i,account_id:a.id,amount_minor:a.entrySumMinor,currency:a.currency}))
 await base(page,state.snapshot.expenses,200,hidden,lang)
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const path=new URL(route.request().url()).pathname
  if(path.includes('/participants'))return route.fulfill({json:{id:'owner'}})
  if(path.endsWith('/expenses'))return route.fulfill({json:state.snapshot.expenses.map(apiExpense)})
  if(path.endsWith('/personal_accounts'))return route.fulfill({json:state.snapshot.accounts.map(a=>({id:a.id,name:a.name,account_class:a.accountClass,account_type:a.accountType,currency:a.currency,archived_at:a.archived?'2026-10-14':null,opening_status:a.openingStatus}))})
  if(path.endsWith('/personal_account_entries'))return route.fulfill({json:entries})
  if(path.endsWith('/personal_funding_intents')){
   if(state.failRead)return route.fulfill({status:503,json:{message:'Test-only unavailable',code:'test'}})
   const response=structuredClone(state.snapshot.funding)
   if(state.delayFirst){const delay=state.delayFirst;state.delayFirst=0;await new Promise(r=>setTimeout(r,delay))}
   return route.fulfill({json:response})
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
 return state
}
