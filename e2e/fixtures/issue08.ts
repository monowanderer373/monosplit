import type{Page}from'@playwright/test'
import{setupTripLedger,tripLedgerId}from'./tripLedger'
import{tripLedgerExpense}from'../../src/test/tripLedgerFixtures'
import{autoFxSnapshot}from'./autoFx'
import type{FxBundle}from'../../src/lib/pairSettlement'
export{tripLedgerId}
export async function setupIssue08(page:Page,options:{payer?:boolean;missing?:boolean;hidden?:boolean}={}){
 const ledger=await setupTripLedger(page,{hidden:options.hidden});ledger.payments=[]
 const ids=['owner','alex','mia','sam'];const paid=options.payer?'alex':'owner'
 ledger.expenses=[tripLedgerExpense('00000000-0000-4000-8000-000000001801','Example bus',ids.map(id=>[id,id===paid?57400:0,14350]as const)),tripLedgerExpense('00000000-0000-4000-8000-000000001802','Example meal',ids.map(id=>[id,id===paid?17200:0,4300]as const)),tripLedgerExpense('00000000-0000-4000-8000-000000001803','Example hotel',ids.map(id=>[id,id===paid?1044000:0,261000]as const),'VND')]
 const state={ledger,missing:!!options.missing,fxError:false,accountError:false,failSubmit:false,commitThenFail:false,rows:[]as FxBundle[],calls:[]as {rpc:string;body:Record<string,unknown>}[],accountReads:0}
 await page.route('http://127.0.0.1:54321/**',async route=>{
  const u=new URL(route.request().url()),path=u.pathname
  if(path.endsWith('/space_members')&&!u.searchParams.get('select')?.includes('spaces('))return route.fulfill({json:ids.map((id,i)=>({space_id:tripLedgerId,participant_id:id,role:i?'full_access':'owner',joined_at:'2026-11-01T00:00:00Z',removed_at:null,participants:{id,kind:'account',display_name:i===0?'You':i===1?'Alex':i===2?'Jordan':'Sam',auth_user_id:id,created_by:null}}))})
  if(path.endsWith('/rpc/insights_fx_snapshot'))return route.fulfill({json:state.missing?{...autoFxSnapshot,rates:{},status:'unavailable'}:{...autoFxSnapshot,fetchedAt:'2026-11-04T09:10:00Z',rates:{...autoFxSnapshot.rates,VND:{...autoFxSnapshot.rates.VND,denominator:'6320',rateDate:'2026-11-04',fetchedAt:'2026-11-04T09:10:00Z'}}}})
  if(path.endsWith('/rpc/get_personal_multicurrency_accounts')){state.accountReads++;if(state.accountError)return route.fulfill({status:503,json:{message:'Synthetic account read failure'}});return route.fallback()}
  if(path.endsWith('/settlement_fx_bundles')){
   if(state.fxError)return route.fulfill({status:503,json:{message:'Synthetic bundle read failure'}})
   const receipt=u.searchParams.get('client_request_id');return route.fulfill({json:receipt?state.rows.filter(b=>b.id===receipt.slice(3)).map(b=>({id:b.id})):state.rows})
  }
  if(path.endsWith('/rpc/propose_fx_settlement_bundle')){
   const body=route.request().postDataJSON();state.calls.push({rpc:'propose_fx_settlement_bundle',body});if(state.failSubmit)return route.fulfill({status:503,json:{message:'Synthetic retryable failure'}})
   state.rows.push({id:body.request_id,version:1,status:'pending',payer_participant_id:'owner',counterparty_participant_id:body.counterparty_id,cash_minor:body.cash_minor,full_net_minor:body.expected_full_minor,target_currency:body.target_currency,rate_mode:body.rate_mode,created_at:'2026-11-04T12:00:00Z',quote:{expenses:body.expected_expenses,rates:{},coverages:[]}})
   if(state.commitThenFail)return route.abort('failed')
   return route.fulfill({json:{bundle_id:body.request_id,status:'pending',version:1}})
  }
  if(path.endsWith('/rpc/respond_fx_settlement_bundle')||path.endsWith('/rpc/cancel_fx_settlement_bundle')||path.endsWith('/rpc/reverse_fx_settlement_bundle')){const body=route.request().postDataJSON(),rpc=path.split('/').pop()!;state.calls.push({rpc,body});const row=state.rows.find(b=>b.id===body.target_bundle_id);if(row){row.status=rpc.startsWith('respond')?body.response:rpc.startsWith('cancel')?'cancelled':'reversed';row.version++}return route.fulfill({json:{bundle_id:row?.id,status:row?.status,version:row?.version}})}
  return route.fallback()
 })
 return state
}
