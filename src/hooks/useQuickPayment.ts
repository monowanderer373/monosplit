import { useEffect, useEffectEvent, useState } from 'react'
import { currencyExponent } from '../lib/money'
import { exactAmount } from '../lib/fx'
import { compileFundingSources, type BalanceAnchor, type CurrencyAccount, type FundingPlan, type SourceDraft } from '../lib/multicurrency'
import { loadFundingMetadata } from '../lib/multicurrencyRepository'
import { useStore } from '../store/useStore'

type Draft = { key: string; mode: 'actual'|'deferred'; sources: SourceDraft[]; edited: boolean; coveredPayment: number|null }
export function useQuickPayment({accounts,parentId,currency,selfPaid,identity,onPlan,offline=false,enabled=true,draftKey=''}:{offline?:boolean;enabled?:boolean;draftKey?:string;accounts:CurrencyAccount[];parentId:string|null;currency:string;selfPaid:number;identity:string;onPlan:(plan:FundingPlan|undefined,valid:boolean)=>void}) {
 const parent=accounts.find(a=>a.id===parentId)
 const suggestion=parent?.accountType==='cash'?accounts.find(a=>a.parentAccountId===parentId&&a.currency===currency&&!a.archived):undefined
 const hidden=useStore(s=>s.homeUi.balanceHidden)
 const key=JSON.stringify([identity,draftKey,parentId,currency])
 const initial:Draft={key,mode:suggestion?'actual':'deferred',sources:[{key:'primary',accountId:suggestion?.id??'',amount:'',coverage:''}],edited:false,coveredPayment:null}
 const [stored,setDraft]=useState(initial)
 const draft=stored.key===key?stored:initial
 const metadataKey=JSON.stringify([identity,draftKey])
 const [metadata,setMetadata]=useState<{key:string;anchors:BalanceAnchor[]}|null>(null)
 const [failed,setFailed]=useState(false)
 useEffect(()=>{
  if(!enabled)return
  let active=true
  void loadFundingMetadata().then(data=>{if(active){setMetadata({key:metadataKey,anchors:data.anchors});setFailed(false)}}).catch(()=>{if(active)setFailed(true)})
  return()=>{active=false}
 },[metadataKey,offline,enabled])
 const anchors=metadata?.key===metadataKey?metadata.anchors:null
 const sources=!draft.edited&&suggestion&&draft.sources.length===1?[{...draft.sources[0],amount:exactAmount(BigInt(selfPaid),currencyExponent(currency),'en')}]:draft.sources
 // Preserve the existing native cash suggestion; never infer a foreign debit.
 const accepted=draft.coveredPayment===selfPaid||!!suggestion&&!draft.edited&&sources.length===1
 let plan:FundingPlan|undefined,valid=!!anchors&&(!failed||offline)
 if(valid){
  if(draft.mode==='deferred')plan={mode:draft.mode,primary_account_id:parentId,legs:[],covers_owner_payment:false}
  else try{plan={mode:draft.mode,primary_account_id:parentId,legs:compileFundingSources(sources,accounts,anchors!),covers_owner_payment:accepted};valid=accepted}catch{valid=false}
 }
 if(offline&&!anchors){plan={mode:'deferred',primary_account_id:parentId,legs:[],covers_owner_payment:false};valid=true}
 valid=valid&&!hidden
 const signature=JSON.stringify(plan)
 const publish=useEffectEvent(()=>onPlan(valid?plan:undefined,valid))
 useEffect(()=>{publish()},[signature,valid])
 return {draft,restore:setDraft,mode:draft.mode,sources,accepted,anchors,failed,hidden,valid,plan:valid?plan:undefined,offline,
  setMode:(mode:Draft['mode'])=>setDraft({...draft,mode}),
  changeSources:(sources:SourceDraft[])=>setDraft({...draft,sources,edited:true,coveredPayment:null}),
  cover:(checked:boolean)=>setDraft({...draft,sources,edited:true,coveredPayment:checked?selfPaid:null}),
 }
}
export type QuickPaymentState=ReturnType<typeof useQuickPayment>
