import {useEffect,useId,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import AmountInput from '../AmountInput'
import {useT} from '../../lib/i18n'
import {parseMajorAmount,formatMinorAmount} from '../../lib/money'
import {loadNotificationSnapshot,notificationRpc} from '../../lib/notificationRepository'
import type {NoticeSnapshot} from '../../lib/homeNotifications'
import {generateId} from '../../lib/id'

import {notificationFundingDrafts as drafts} from '../../lib/notificationDrafts'

import {notificationAmountInput as plainMinor} from '../../lib/notificationPresentation'

export default function FundingForm({identity,row,snapshot,busy,onModeChange,onSubmit}:{identity:string;row:NoticeSnapshot['funding'][number];snapshot:NoticeSnapshot;busy:boolean;onModeChange:(needsAmount:boolean)=>void;onSubmit:(work:(guard:()=>void)=>Promise<unknown>)=>Promise<void>}){
 const t=useT(),navigate=useNavigate(),helpId=useId(),draftKey=identity+':'+row.id,cached=drafts.get(draftKey)
 const initial=cached?.version===row.version?cached:null
 const [accountId,setAccountId]=useState(initial?.accountId??row.account_id??''),[amount,setAmount]=useState(initial?.amount??(row.account_id&&snapshot.accounts.find(a=>a.id===row.account_id)?.currency===row.expense_currency&&row.expense_amount_minor!=null?plainMinor(row.expense_amount_minor,row.expense_currency!):'')),[accountChanged,setAccountChanged]=useState(false)
 const account=snapshot.accounts.find(a=>a.id===accountId),storedAccount=snapshot.accounts.find(a=>a.id===row.account_id),same=account?.currency===row.expense_currency
 const knownSame=!!account&&same&&row.expense_amount_minor!=null
 const actual=knownSame?plainMinor(row.expense_amount_minor!,row.expense_currency!):amount
 const eligible=snapshot.accounts.filter(a=>!a.archived),expense=snapshot.expenses.find(e=>e.id===row.expense_id)
 const remember=(accountId:string,amount:string)=>{drafts.set(draftKey,{version:row.version,accountId,amount});while(drafts.size>20)drafts.delete(drafts.keys().next().value!)}
 useEffect(()=>{onModeChange(!!account&&!knownSame)},[account,knownSame,onModeChange])
 const valid=()=>{try{return !!actual&&!!account&&!account.archived&&parseMajorAmount(actual,account.currency)>0}catch{return false}}
 if(!eligible.length&&!row.account_id)return <section className="notification-a-state"><p>{t('noticeA.funding.accountHelp')}</p><button type="button" className="ms-btn-primary" disabled={busy} onClick={()=>navigate('/?'+new URLSearchParams({accountPanel:'manage',returnNotice:'funding',returnTarget:row.id}),{state:{noticeBack:true}})}>{t('noticeA.state.accounts')}</button></section>
 return <form className="home-notice-form" onSubmit={e=>{e.preventDefault();if(!valid()||busy||!account)return;void onSubmit(async guard=>{
  const fresh=await loadNotificationSnapshot(snapshot.owner),current=fresh.funding.find(f=>f.id===row.id),expense=fresh.expenses.find(e=>e.id===row.expense_id)
  guard()
  if(!current||!expense||expense.status==='voided')throw new Error('not_found')
  if(current.status!=='pending')return
  if(current.version!==row.version)throw new Error('version_conflict')
  const latestAccount=fresh.accounts.find(a=>a.id===account.id)
  if(!latestAccount||latestAccount.archived||latestAccount.currency!==account.currency)throw new Error('personal_account_archived')
  const minor=parseMajorAmount(actual,account.currency),payload={target_funding_intent_id:row.id,target_account_id:account.id,account_amount_minor:minor}
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))))).map(v=>v.toString(16).padStart(2,'0')).join('')
  const key=`tt-funding-attempt:${identity}:${row.id}`;let requestId=generateId()
  // Persist only opaque request/fingerprint metadata, never amount/account payloads.
  try{const previous=JSON.parse(sessionStorage.getItem(key)??'null');if(previous?.fingerprint===fingerprint&&typeof previous.requestId==='string')requestId=previous.requestId;sessionStorage.setItem(key,JSON.stringify({fingerprint,requestId}))}catch{/* Backend still locks the original intent. */}
  guard()
  await notificationRpc('complete_pending_funding',{request_id:requestId,...payload},identity,guard)
 })}}>
  <p className="notification-a-helper">{t('noticeA.expenseSaved')}</p>
  <label><span className="home-sr">{t('notice.choose')}</span><select aria-label={t('notice.choose')} value={accountId} disabled={busy||!!row.account_id} onChange={e=>{
   const id=e.target.value,next=snapshot.accounts.find(a=>a.id===id),raw=next?.currency===row.expense_currency&&row.expense_amount_minor!=null?plainMinor(row.expense_amount_minor,row.expense_currency!):''
   setAccountId(id);setAmount(raw);remember(id,raw);setAccountChanged(!!account&&account.currency!==next?.currency)
  }}><option value="">{t('notice.pick')}</option>{snapshot.accounts.filter(a=>!a.archived||a.id===row.account_id).map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>
  {account?.archived?<p role="status">{t('notice.accountArchived')}</p>:null}
  {row.account_id&&!storedAccount?<p role="status">{t('notice.unavailable')}</p>:null}
  {knownSame&&row.expense_amount_minor!==expense?.totalMinor?<dl className="notification-a-facts"><div><dt>{t('noticeA.funding.yourPayment')}</dt><dd>{formatMinorAmount(Number(row.expense_amount_minor),row.expense_currency!)}</dd></div></dl>:null}
  {account&&!knownSame?<label>{t('noticeA.funding.actualLabel',{currency:account.currency})}<AmountInput aria-label={t('noticeA.funding.actualLabel',{currency:account.currency})} aria-describedby={helpId} value={amount} onValueChange={value=>{setAmount(value);remember(accountId,value)}} placeholder={t('noticeA.funding.placeholder')} disabled={busy||account.archived} inputMode="decimal" /></label>:null}
  {account&&!knownSame?<p id={helpId} className="notification-a-helper">{t(same?'noticeA.unknownPayment':'noticeA.funding.actualHelp')}</p>:null}
  {accountChanged?<p className="notification-a-helper" role="status">{t('noticeA.accountCurrencyReset')}</p>:null}
  {cached&&cached.version!==row.version?<p role="status">{t('noticeA.state.changed')}</p>:null}
  <button className="ms-btn-primary" type="submit" disabled={busy||!valid()}>{t(busy?'noticeA.common.saving':'noticeA.funding.updateBalance')}</button>
 </form>
}
