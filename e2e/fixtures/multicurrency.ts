import { type Page } from '@playwright/test'
import { setupNotifications } from './notifications'
/** Application contract only. Real accounting invariants run separately in PostgreSQL. */
export async function setupMulticurrency(page:Page,options:{hidden?:boolean;lang?:string;missingRates?:boolean}={}){
 const state=await setupNotifications(page,{hidden:options.hidden??false,lang:options.lang??'en'})
 const parent=state.snapshot.accounts[1];parent.name='Wise';parent.accountType='ewallet';parent.parentAccountId=parent.id;parent.version=1;parent.parentVersion=1
 const cash=state.snapshot.accounts[0];cash.name='Cash';cash.accountType='cash';cash.parentAccountId=cash.id
 for(const [id,currency,amount,unknown] of [['vnd-unit','VND',900000,false],['jpy-unit','JPY',-50,true],['usd-unit','USD',0,false],['eur-unit','EUR',25000,false]] as const){
  state.snapshot.accounts.push({...parent,id,currency,parentAccountId:parent.id,displayOrder:state.snapshot.accounts.length-1,openingStatus:unknown?'unknown':'posted',entrySumMinor:amount})
  state.entries.push({id:'opening-'+id,account_id:id,amount_minor:amount,currency})
 }
 state.snapshot.money={bundles:state.snapshot.funding.map(f=>({funding_intent_id:f.id,primary_account_id:'bank',confirmed_operation_id:null})),anchors:[]}
 const movements:Record<string,unknown>[]=[];const fees:Record<string,unknown>[]=[]
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname
  if(options.missingRates&&path.endsWith('/rpc/insights_fx_snapshot'))return route.fulfill({json:{id:null,rates:{},status:'unavailable',fetchedAt:null}})
  if(path.endsWith('/personal_account_entries')&&url.searchParams.get('select')?.includes('transaction:')){
   const id=url.searchParams.get('account_id')?.slice(3)
   return route.fulfill({json:state.entries.filter(e=>!id||e.account_id===id).map(e=>({...e,transaction:{kind:'opening',occurred_on:'2026-10-16',memo:'Disposable UI fixture'}}))})
  }
  if(path.endsWith('/rpc/record_personal_money_movement')){
   const body=route.request().postDataJSON(),p=body.movement_payload;state.writes.push({rpc:'record_personal_money_movement',...body})
   if(state.failWrite)return route.abort('failed')
   const source=state.snapshot.accounts.find(a=>a.id===p.source_account_id)!,destination=state.snapshot.accounts.find(a=>a.id===p.destination_account_id)!
   const id='movement-'+(movements.length+1)
   movements.push({id,version:1,kind:p.kind,source_account_id:source.id,destination_account_id:destination.id,source_total_minor:p.source_total_minor,destination_net_minor:p.destination_net_minor,source_currency:source.currency,destination_currency:destination.currency,occurred_on:p.occurred_on,memo:p.memo,reversed_operation_id:null})
   state.entries.push({id:id+'-out',account_id:source.id,amount_minor:-p.source_total_minor,currency:source.currency},{id:id+'-in',account_id:destination.id,amount_minor:p.destination_net_minor,currency:destination.currency})
   if(p.fee)fees.push({id:id+'-fee',movement_id:id,...p.fee})
   const result={movement_id:id};state.operations.set(body.request_id,result)
   return route.fulfill({json:result})
  }
  if(path.endsWith('/personal_money_movements')){
   const id=url.searchParams.get('id')?.slice(3)
   return route.fulfill({json:id?movements.find(m=>m.id===id)??null:movements})
  }
  if(path.endsWith('/personal_money_movement_fees'))return route.fulfill({json:fees.filter(f=>!url.searchParams.get('movement_id')||f.movement_id===url.searchParams.get('movement_id')?.slice(3))})
  return route.fallback()
 })
 return state
}
