import{contraFixture}from'./contra'
import type{Page}from'@playwright/test'
import{setupRouted,tripLedgerId}from'./routedSettlement'
import{planSettlement,type Snapshot,type Payment}from'../../src/lib/routedSettlementCore'
import{tripLedgerExpense}from'../../src/test/tripLedgerFixtures'
import type{CreatorRecord,CreatorDraft,CreatorContext}from'../../src/lib/creatorSettlement'
export{tripLedgerId}
export async function setupCreator(page:Page){
 const base=await setupRouted(page)
 const names:Record<string,string>={owner:'Lii',alex:'PS',mia:'Dav',sam:'Alex'},edges:[string,string,number][]=[['alex','owner',280000],['owner','mia',400000],['owner','sam',100000],['alex','mia',250000],['alex','sam',20000]]
 base.ledger.expenses=edges.map(([debtor,creditor,n],i)=>tripLedgerExpense('00000000-0000-4000-8000-'+String(444000+i).padStart(12,'0'),'Creator source '+i,[[creditor,n,0],[debtor,0,n]],'VND'))
 const state={ledger:base.ledger,avatarFailure:false,canRecord:true,isCreator:true,failAfterCommit:false,failBeforeCommit:false,expired:false,calls:[]as{rpc:string;body:Record<string,unknown>}[],rows:[]as(CreatorRecord&{requestId:string})[],names,delegated:false}
 const context=():CreatorContext=>({canRecord:state.canRecord,isCreator:state.isCreator,policyVersion:'fixture-policy',name:names.owner,members:Object.entries(names).map(([id,name])=>({id,name,kind:'account',...(state.avatarFailure?{avatarUrl:'https://avatar.example.test/broken.png'}:{}),delegated:id==='alex'&&state.delegated}))})
 const projected=(draft:CreatorDraft)=>{const rate=draft.vndPerMyr??'6320',net=draft.edgeBasis==='net',ledgerCurrency=net?'MYR' as const:'VND' as const;const snapshot:Snapshot={tripId:tripLedgerId,revision:'one',quoteId:'fixture',ledgerCurrency,rates:net?{VND:{numerator:'100',denominator:rate}}:{MYR:{numerator:String(Number(rate)/100),denominator:'1'}},participants:Object.keys(names),edges:edges.map(([from,to,minor],i)=>({id:String(i),from,to,minor:net?Math.round(minor*100/Number(rate)):minor}))};const p=planSettlement(snapshot,draft.payments as Payment[]);const totals=new Map<string,{from:string;to:string;currency:'MYR'|'VND';minor:number}>();for(const line of p.lines)for(const c of line.coverage){const t=totals.get(c.edgeId)??{from:c.from,to:c.to,currency:ledgerCurrency,minor:0};t.minor+=c.minor;totals.set(c.edgeId,t)}return{ledgerCurrency,lines:p.lines.map(l=>({payment:l.payment,valueMinor:l.valueMinor,viaMinor:l.viaMinor,directMinor:l.directMinor,unappliedMinor:l.unappliedMinor})),coverage:[...totals.values()],remaining:p.remaining.map(e=>({...e,currency:ledgerCurrency})),issues:p.issues,rate:{numerator:rate,denominator:'1',source:'custom',provider:'Custom'}}}

 await page.route('http://127.0.0.1:54321/rest/v1/rpc/**',async route=>{const rpc=new URL(route.request().url()).pathname.split('/').pop()!,body=route.request().postDataJSON()as Record<string,unknown>;const send=(json:unknown)=>route.fulfill({json})
  if(rpc==='read_trip_contra_snapshot')return send(contraFixture(tripLedgerId,state.ledger.expenses,[],body,state.canRecord))
  if(rpc==='get_trip_creator_context')return send(context())
  if(rpc==='get_creator_settlement_notifications')return send({notices:[],managedPaymentIds:[]})
  if(rpc==='read_trip_creator_settlements')return send(state.rows.filter(r=>(!body.record_id||r.id===body.record_id)&&(!body.request_id||r.requestId===body.request_id)))
  if(rpc==='preview_trip_creator_settlement'){state.calls.push({rpc,body});const plan=projected(body.draft as CreatorDraft);return send({plan,digest:plan.issues.length?null:'a'.repeat(64),expiresAt:new Date(Date.now()+(state.expired?300:600000)).toISOString()})}
  if(rpc==='record_trip_creator_settlement'){state.calls.push({rpc,body});if(state.failBeforeCommit)return route.abort('failed');let record=state.rows.find(r=>r.requestId===body.request_id);const draft=body.draft as CreatorDraft;if(!record){record={id:'00000000-0000-4000-8000-000000559999',tripId:tripLedgerId,requestId:body.request_id as string,recordedByName:'Lii',occurredAt:draft.occurredAt,recordedAt:new Date().toISOString(),timeZone:'Asia/Kuala_Lumpur',status:'posted',version:1,note:draft.note,people:context().members,canManage:true,canReverse:true,canRequestCorrection:true,correctionPending:false,corrections:[],reversedAt:null,reverseReason:null,replacementFor:null,replacementId:null,ownCash:[],plan:projected(draft)};state.rows.push(record)}return state.failAfterCommit?route.abort('failed'):send(record)}
  if(rpc==='set_trip_creator_delegate'){state.calls.push({rpc,body});state.delegated=body.enabled as boolean;return send(context())}
  if(rpc==='reverse_trip_creator_settlement'){state.calls.push({rpc,body});const r=state.rows[0];r.status='reversed';r.version++;r.canReverse=false;r.canRequestCorrection=false;r.plan.remaining=[];return send(r)}
  if(rpc==='request_trip_creator_correction'){state.calls.push({rpc,body});const r=state.rows[0];r.correctionPending=true;r.corrections=[{id:'00000000-0000-4000-8000-000000559998',reason:body.reason as string,requesterName:'Dav',version:1,status:'pending',createdAt:new Date().toISOString(),resolution:null}];return send(r)}
  return route.fallback()
 })
 return state
}
