import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../lib/i18n'
import { formatMinorAmount } from '../../lib/money'
import { generateId } from '../../lib/id'
import { compileFundingSources, type CurrencyAccount, type SourceDraft } from '../../lib/multicurrency'
import { moneyOperation } from '../../lib/moneyOperation'
import type { NoticeSnapshot, NoticeRow } from '../../lib/homeNotifications'
import FundingSources from './FundingSources'
import { clearFundingDraft, readFundingDraft, saveFundingDraft } from '../../lib/moneyDrafts'

export default function FundingBundleForm({identity,row,snapshot,busy,onSubmit,next=false,hidden=false,onReveal}:{identity:string;row:NoticeRow;snapshot:NoticeSnapshot;busy:boolean;next?:boolean;hidden?:boolean;onReveal?:()=>void;onSubmit:(work:(guard:()=>void)=>Promise<unknown>)=>Promise<void>}){
  const t=useT(),navigate=useNavigate()
  const accounts=snapshot.accounts as CurrencyAccount[],bundle=snapshot.money?.bundles.find(b=>b.funding_intent_id===row.id)
  // Legacy pinned funding is constrained by the server. New parent intent never guesses a currency.
  const initial=!bundle&&row.account_id ? row.account_id : ''
  const cached=readFundingDraft(identity,row.id,row.version)
  const [sources,setSources]=useState<SourceDraft[]>(()=>cached?.sources??[{key:generateId(),accountId:initial,amount:'',coverage:''}])
  const [covers,setCovers]=useState(cached?.covers??false)
  const remember=(sources:SourceDraft[],covers:boolean)=>saveFundingDraft(identity,row.id,{version:row.version,sources,covers})
  const expense=snapshot.expenses.find(e=>e.id===row.expense_id)
  let valid=false
  try{compileFundingSources(sources,accounts,snapshot.money?.anchors??[]);valid=covers&&!!expense}catch{/* Keep all drafts for review. */}
  if(hidden)return <section className="ttmc-module"><p>{t('notice.hiddenReview')}</p><button type="button" onClick={onReveal}>{t('mc.common.reveal')}</button></section>
  if(!accounts.some(a=>!a.archived))return <section className="ttmc-module"><p>{t('noticeA.funding.accountHelp')}</p><button type="button" disabled={busy} onClick={()=>navigate('/?'+new URLSearchParams({accountPanel:'manage',returnNotice:'funding',returnTarget:row.id}),{state:{noticeBack:true}})}>{t('noticeA.state.accounts')}</button></section>
  return <form className="ttmc-module home-notice-form" onSubmit={e=>{
    e.preventDefault();if(busy||!valid||!expense)return
    const legs=compileFundingSources(sources,accounts,snapshot.money?.anchors??[])
    void onSubmit(async guard=>{
      const result=await moneyOperation('confirm_personal_funding_bundle',{
        target_funding_intent_id:row.id,expected_intent_version:row.version,expected_expense_version:expense.version,
        actual_legs:legs,covers_owner_payment:covers,
      },identity,`funding:${row.id}`,guard)
      guard();clearFundingDraft(identity,row.id);return result
    })
  }}>
    <p>{t('mc.funding.saved')}</p>
    {row.expense_amount_minor!=null&&row.expense_currency?<dl><dt>{t('mc.funding.yourPayment')}</dt><dd>{formatMinorAmount(Number(row.expense_amount_minor),row.expense_currency)}</dd></dl>:null}
    <FundingSources accounts={accounts} anchors={snapshot.money?.anchors??[]} sources={sources} onChange={next=>{setSources(next);setCovers(false);remember(next,false)}} busy={busy}/>
    <label className="ttmc-check"><input type="checkbox" checked={covers} disabled={busy} onChange={e=>{setCovers(e.target.checked);remember(sources,e.target.checked)}}/>{t('mc.coversPayment')}</label>
    <button className="ms-btn-primary" type="submit" disabled={busy||!valid}>{t(busy?'mc.common.saving':next?'mc.verify.next':'mc.verify.finish')}</button>
  </form>
}
