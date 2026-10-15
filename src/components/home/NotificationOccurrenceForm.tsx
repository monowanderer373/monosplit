import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useT} from '../../lib/i18n'
import {parseMajorAmount,formatMinorAmount} from '../../lib/money'
import {notificationAmountInput as plainMinor} from '../../lib/notificationPresentation'
import {loadNotificationSnapshot,notificationRpc} from '../../lib/notificationRepository'
import type {NoticeRef,NoticeRow,NoticeSnapshot} from '../../lib/homeNotifications'
import AmountInput from '../AmountInput'

type Props={identity:string;target:NoticeRef;row:NoticeRow;snapshot:NoticeSnapshot;busy:boolean;allowScheduled:boolean;onSubmit:(work:(guard:()=>void)=>Promise<unknown>)=>Promise<void>}
export default function NotificationOccurrenceForm({identity,target,row,snapshot,busy,allowScheduled,onSubmit}:Props){
 const t=useT(),navigate=useNavigate(),installment=target.kind==='installment'
 const rule=snapshot.rules.find(r=>r.id===row.rule_id),plan=snapshot.plans.find(p=>p.id===row.plan_id)
 const currency=installment?plan?.currency:row.effective_currency??rule?.currency
 const shownAmount=installment?row.principal_minor:row.effective_amount_minor??rule?.amount_minor
 const originalAccount=installment?row.repayment_account_id:row.effective_account_id??rule?.funding_account_id
 const [accountId,setAccountId]=useState(originalAccount??''),[amount,setAmount]=useState(row.asset_payment_minor!=null&&snapshot.accounts.find(a=>a.id===originalAccount)?.currency?plainMinor(row.asset_payment_minor,snapshot.accounts.find(a=>a.id===originalAccount)!.currency):'')
 const account=snapshot.accounts.find(a=>a.id===accountId),foreign=!!account&&account.currency!==currency
 const eligible=snapshot.accounts.filter(a=>!a.archived&&(!installment||a.accountClass==='asset'))
 const actual=installment?(foreign?amount:row.asset_payment_minor!=null&&account&&accountId===originalAccount?plainMinor(row.asset_payment_minor,account!.currency):shownAmount!=null&&account?plainMinor(shownAmount,account.currency):''):''
 const reason=row.error_code==='account_archived'?'noticeA.reason.archived':row.error_code==='actual_payment_required'?'noticeA.reason.actual':row.error_code==='liability_invalid'?'noticeA.reason.liability':row.error_code==='contribution_missing'?'noticeA.reason.contribution':['account_missing','account_invalid','account_owner_mismatch'].includes(row.error_code??'')?'noticeA.reason.account':['funding_conflict','idempotency_conflict'].includes(row.error_code??'')?'noticeA.reason.changed':['invalid_amount','invalid_currency'].includes(row.error_code??'')?'noticeA.reason.amount':'noticeA.reason.failed'
 const valid=()=>{try{return !!account&&!account.archived&&!!currency&&shownAmount!=null&&(!installment||!!actual&&parseMajorAmount(actual,account.currency)>0)}catch{return false}}
 if(!eligible.length)return <section className="notification-a-state"><h3>{t('noticeA.state.noAccount')}</h3><p>{t('noticeA.funding.accountHelp')}</p><button type="button" className="ms-btn-primary" disabled={busy} onClick={()=>navigate('/?'+new URLSearchParams({accountPanel:'manage',returnNotice:target.kind,returnTarget:target.id}),{state:{noticeBack:true}})}>{t('noticeA.state.accounts')}</button></section>
 return <form className="home-notice-form" onSubmit={event=>{event.preventDefault();if(!valid()||busy||!account)return;void onSubmit(async guard=>{
  let fresh=await loadNotificationSnapshot(snapshot.owner);guard()
  let current=installment?fresh.installments.find(r=>r.id===row.id):fresh.recurring.find(r=>r.id===row.id)
  if(!current)throw new Error('not_found')
  if(current.status==='posted')return
  if(current.version!==row.version)throw new Error('version_conflict')
  if(!['failed','pending_review'].includes(current.status)&&!(installment&&allowScheduled&&current.status==='scheduled'))return
  const currentAccount=fresh.accounts.find(a=>a.id===accountId),freshRule=fresh.rules.find(r=>r.id===current!.rule_id),freshPlan=fresh.plans.find(p=>p.id===current!.plan_id)
  if(!currentAccount||currentAccount.archived||currentAccount.currency!==account.currency||installment&&currentAccount.accountClass!=='asset')throw new Error('personal_account_archived')
  const currentCurrency=installment?freshPlan?.currency:current.effective_currency??freshRule?.currency
  const currentAmount=installment?current.principal_minor:current.effective_amount_minor??freshRule?.amount_minor
  if(currentCurrency!==currency||String(currentAmount)!==String(shownAmount))throw new Error('version_conflict')
  const amountMinor=installment?parseMajorAmount(actual,account.currency):null
  const accountChanged=(installment?current.repayment_account_id:current.effective_account_id??freshRule?.funding_account_id)!==accountId
  // Edits are the original versioned occurrence-only RPCs, never schedule or canonical-history rewrites.
  const needsEdit=accountChanged||installment&&foreign&&String(current.asset_payment_minor??'')!==String(amountMinor)
  if(needsEdit){
   const oldDate=current.due_on??current.scheduled_for
   const edited=await notificationRpc(installment?'edit_future_installment':'update_personal_recurring_occurrence',installment?{target_installment_id:row.id,expected_version:current.version,replacement_due_on:current.due_on,replacement_repayment_account_id:accountId,replacement_asset_payment_minor:amountMinor}:{target_occurrence_id:row.id,expected_version:current.version,override_amount_minor:current.effective_amount_minor??null,override_currency:current.effective_currency??null,override_account_id:accountId,override_occurred_on:current.effective_occurred_on??null},identity,guard)
   if(!edited||!Number.isSafeInteger(edited.version))throw new Error('financial_invariant_violation')
   fresh=await loadNotificationSnapshot(snapshot.owner);guard();current=installment?fresh.installments.find(r=>r.id===row.id):fresh.recurring.find(r=>r.id===row.id)
   if(current?.status==='posted')return
   if(!current||current.version!==edited.version||(current.due_on??current.scheduled_for)!==oldDate||(installment?current.repayment_account_id:current.effective_account_id)!==accountId)throw new Error('version_conflict')
  }
  const finalAccount=fresh.accounts.find(a=>a.id===accountId)
  const finalRule=fresh.rules.find(r=>r.id===current.rule_id),finalPlan=fresh.plans.find(p=>p.id===current.plan_id)
  if(!finalAccount||finalAccount.archived||finalAccount.currency!==account.currency)throw new Error('personal_account_archived')
  if((installment?finalPlan?.currency:current.effective_currency??finalRule?.currency)!==currency||String(installment?current.principal_minor:current.effective_amount_minor??finalRule?.amount_minor)!==String(shownAmount))throw new Error('version_conflict')
  guard()
  const rpc=installment?(current.status==='scheduled'?'post_installment_repayment':'retry_installment_repayment'):current.status==='failed'?'retry_personal_recurring_occurrence':'post_personal_recurring_occurrence'
  await notificationRpc(rpc,installment?{target_installment_id:row.id}:{target_occurrence_id:row.id},identity,guard)
 })}}>
  <label><span className="home-sr">{t('notice.choose')}</span><select aria-label={t('notice.choose')} value={accountId} disabled={busy} onChange={event=>{const next=snapshot.accounts.find(a=>a.id===event.target.value);setAccountId(event.target.value);setAmount(next&&next.currency===currency&&shownAmount!=null?plainMinor(shownAmount,next.currency):'')}}><option value="">{t('notice.pick')}</option>{snapshot.accounts.filter(a=>!a.archived&&(!installment||a.accountClass==='asset')||a.id===originalAccount).map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>
  {installment&&foreign&&account?<label>{t('noticeA.funding.actualLabel',{currency:account.currency})}<AmountInput aria-label={t('noticeA.funding.actualLabel',{currency:account.currency})} value={amount} disabled={busy} onValueChange={setAmount} inputMode="decimal"/><small>{t('noticeA.funding.actualHelp')}</small></label>:null}
  {installment&&!foreign&&row.asset_payment_minor!=null&&String(row.asset_payment_minor)!==String(row.principal_minor)&&account?<p>{t('noticeA.paymentOnly')} · {formatMinorAmount(Number(row.asset_payment_minor),account.currency)}</p>:null}
  {row.error_code?<p className="notification-a-helper">{t(reason)}</p>:null}
  {!installment&&foreign?<p className="notification-a-helper">{t('noticeA.recurringForeign')}</p>:null}
  <p className="notification-a-helper">{t('noticeA.recurring.help')}</p>
  <button type="submit" className="ms-btn-primary" disabled={busy||!valid()}>{t(busy?'noticeA.common.saving':'noticeA.recurring.paid')}</button>
 </form>
}
