import { useEffect, useEffectEvent, useState } from 'react'
import { useT } from '../../lib/i18n'
import { generateId } from '../../lib/id'
import { currencyExponent } from '../../lib/money'
import { exactAmount } from '../../lib/fx'
import { compileFundingSources, type BalanceAnchor, type CurrencyAccount, type FundingPlan, type SourceDraft } from '../../lib/multicurrency'
import { loadFundingMetadata } from '../../lib/multicurrencyRepository'
import FundingSources from './FundingSources'
import { useStore } from '../../store/useStore'

export default function QuickPayment({accounts,parentId,currency,selfPaid,identity,busy,onPlan}:{accounts:CurrencyAccount[];parentId:string|null;currency:string;selfPaid:number;identity:string;busy:boolean;onPlan:(plan:FundingPlan|undefined,valid:boolean)=>void}){
 const t=useT(),parent=accounts.find(a=>a.id===parentId),suggestion=parent?.accountType==='cash'?accounts.find(a=>a.parentAccountId===parentId&&a.currency===currency&&!a.archived):undefined
 const hidden=useStore(s=>s.homeUi.balanceHidden),setHomeUi=useStore(s=>s.setHomeUi)
 const [mode,setMode]=useState<'actual'|'deferred'>(suggestion?'actual':'deferred')
 const [sources,setSources]=useState<SourceDraft[]>([{key:generateId(),accountId:suggestion?.id??'',amount:'',coverage:''}])
 const [edited,setEdited]=useState(false),[covers,setCovers]=useState(false),[anchors,setAnchors]=useState<BalanceAnchor[]|null>(null),[failed,setFailed]=useState(false)
 useEffect(()=>{let active=true;void loadFundingMetadata().then(data=>{if(active)setAnchors(data.anchors)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[identity])
 const actualSources=!edited&&suggestion&&sources.length===1?[{...sources[0],amount:exactAmount(BigInt(selfPaid),currencyExponent(currency),'en')}]:sources
 // A visible same-currency cash suggestion is confirmed by the existing Save action.
 const accepted=covers||!!suggestion&&!edited&&sources.length===1
 let plan:FundingPlan|undefined,valid=!!anchors&&!failed
 if(valid){
  if(mode==='deferred')plan={mode,primary_account_id:parentId,legs:[],covers_owner_payment:false}
  else try{plan={mode,primary_account_id:parentId,legs:compileFundingSources(actualSources,accounts,anchors!),covers_owner_payment:accepted};valid=accepted}catch{valid=false}
 }
 const signature=JSON.stringify(plan)
 const publish=useEffectEvent(()=>onPlan(valid&&!hidden?plan:undefined,valid&&!hidden))
 useEffect(()=>{publish()},[signature,valid,hidden])
 if(hidden)return <section className="ttmc-module"><p>{t('notice.hiddenReview')}</p><button type="button" onClick={()=>setHomeUi({balanceHidden:false})}>{t('mc.common.reveal')}</button></section>
 return <section className="ttmc-module ttmc-paper">
  <h3>{t('mc.funding.paidFrom')}</h3>
  <div className="ttmc-actions"><button type="button" aria-pressed={mode==='deferred'} onClick={()=>setMode('deferred')} disabled={busy}>{t('mc.funding.later')}</button><button type="button" aria-pressed={mode==='actual'} onClick={()=>setMode('actual')} disabled={busy}>{t('mc.funding.known')}</button></div>
  {failed?<p role="alert">{t('mc.capability')}</p>:!anchors?<p role="status">{t('mc.state.loading')}</p>:mode==='deferred'?<p>{t('mc.funding.beforeSave')}</p>:<>
   <FundingSources accounts={accounts} anchors={anchors} sources={actualSources} onChange={next=>{setEdited(true);setSources(next);setCovers(false)}} busy={busy}/>
   <label className="ttmc-check"><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>{setEdited(true);setSources(actualSources);setCovers(e.target.checked)}}/>{t('mc.coversPayment')}</label>
  </>}
 </section>
}
