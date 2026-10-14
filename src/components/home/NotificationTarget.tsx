import {isAvailableMoneyAccount} from '../../lib/homeView'
import {formatDate} from '../../lib/locale'
import {useCallback,useEffect,useEffectEvent,useRef,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {HomeSheet} from './HomeScreen'
import AmountInput from '../AmountInput'
import ExpenseActionSheet from '../ExpenseActionSheet'
import ExpenseHistoryList from '../ExpenseHistoryList'
import ExpenseChangeRequestCard from '../ExpenseChangeRequestCard'
import DirectExpenseReviewCard from '../DirectExpenseReviewCard'
import PendingExpenseRecoveryActions from '../PendingExpenseRecoveryActions'
import {useStore} from '../../store/useStore'
import {useT,friendlyErrorKey} from '../../lib/i18n'
import {parseMajorAmount,currencyExponent,formatMinorAmount} from '../../lib/money'
import {loadNotificationSnapshot,notificationRpc,noticeQueryFailure} from '../../lib/notificationRepository'
import {resolveNotice,noticeKey,noticePath,noticeCalendarDate,type NoticeRef,type NoticeResolution,type NoticeSnapshot,type HomeNotification} from '../../lib/homeNotifications'
import {collectPayService} from '../../lib/collectPayRepository'
import {buildCollectPayItems} from '../../lib/collectPay'
import {generateId} from '../../lib/id'
import type {usePersonalLedger} from '../../hooks/usePersonalLedger'

type Props={timezone?:string;sourceVersion?:string;owner:string;identity:string;target:NoticeRef;ledger:ReturnType<typeof usePersonalLedger>;onClose:()=>void;onViewed:(notice:HomeNotification)=>void;onChange:()=>Promise<unknown>}
export default function NotificationTarget(props:Props){
 const lang=useStore(s=>s.lang),t=useT(),navigate=useNavigate(),hidden=useStore(s=>s.homeUi.balanceHidden),setHomeUi=useStore(s=>s.setHomeUi)
 const key=noticeKey(props.target),[reload,setReload]=useState(0),[result,setResult]=useState<{key:string;owner:string;value:NoticeResolution}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[checking,setChecking]=useState(true)
 const lock=useRef(false),epoch=useRef(0),returnFocus=useRef<HTMLElement|null>(null)
 const viewed=useEffectEvent((n:HomeNotification)=>props.onViewed(n)),changed=props.onChange
 const invalidate=useCallback(()=>{epoch.current++},[])
 const outbox=useEffectEvent(()=>props.ledger.outbox)
 useEffect(()=>{returnFocus.current=document.querySelector('[data-testid="home-account-notice"]')},[])
 useEffect(()=>{
  const token=++epoch.current;let cancelled=false
  setChecking(true);setError('')
  void loadNotificationSnapshot(props.owner).then(snapshot=>{
    if(cancelled||token!==epoch.current)return
    const value=resolveNotice(snapshot,props.target,outbox());setResult({key,owner:props.owner,value});setChecking(false)
  }).catch(cause=>{if(!cancelled&&token===epoch.current){setResult({key,owner:props.owner,value:noticeQueryFailure(cause)});setChecking(false)}})
  return()=>{cancelled=true;invalidate()}
 },[key,props.owner,props.target,reload,props.sourceVersion,invalidate])
 const resolution=result?.key===key&&result.owner===props.owner?result.value:null
 const reconcile=useEffectEvent(()=>props.onChange())
 useEffect(()=>{if(resolution&&(resolution.state==='completed'||resolution.state==='changed'||resolution.state==='unavailable'||resolution.state==='ready'&&(['completed','changed'].includes(resolution.notice.state)||resolution.notice.ref.kind==='account')))void reconcile()},[resolution])
 const notice=resolution?.state==='ready'?resolution.notice:null
 useEffect(()=>{if(notice&&!['payment','request'].includes(notice.ref.kind))viewed(notice)},[notice])
 const snapshot=resolution&&'snapshot'in resolution?resolution.snapshot:null
 const row=snapshot?.[props.target.kind==='funding'?'funding':props.target.kind==='recurring'?'recurring':props.target.kind==='installment'?'installments':'funding'].find(r=>r.id===props.target.id)
 const plan=snapshot?.plans.find(p=>p.id===row?.plan_id),rule=snapshot?.rules.find(r=>r.id===row?.rule_id)
 const reviewAmount=props.target.kind==='recurring'?row?.effective_amount_minor??rule?.amount_minor:row?.principal_minor
 const reviewCurrency=props.target.kind==='recurring'?row?.effective_currency??rule?.currency:plan?.currency
 const expense=snapshot?.expenses.find(e=>e.id===(props.target.kind==='expense'?props.target.id:props.target.kind==='outbox'?snapshot?.expenses.find(e=>e.clientRequestId===props.target.id)?.id:row?.expense_id??plan?.purchase_expense_id))
 const reloadTarget=()=>{setReload(n=>n+1)}
 const perform=async(work:(guard:()=>void)=>Promise<unknown>)=>{
  if(lock.current||checking)return
  lock.current=true;setBusy(true);setError('');const token=epoch.current
  const guard=()=>{if(token!==epoch.current)throw new Error('notification_context_changed')}
  try{guard();await work(guard);if(token!==epoch.current)return;await changed();if(token===epoch.current)reloadTarget()}
  catch(cause){if(token===epoch.current)setError(t(friendlyErrorKey(cause)))}
  finally{lock.current=false;setBusy(false)}
 }
 const openPayment=async()=>{
  if(lock.current||checking)return
  lock.current=true;setBusy(true);setError('');const token=epoch.current
  try{
    const fresh=await collectPayService.load(props.owner)
    if(token!==epoch.current)return
    const item=buildCollectPayItems(fresh).find(i=>props.target.kind==='payment'?i.payments.some(p=>p.id===props.target.id):i.requests.some(p=>p.id===props.target.id))
    if(!item){setResult({key,owner:props.owner,value:{state:'unavailable'}});return}
    navigate(`/collect-pay/${item.direction}?${new URLSearchParams({item:item.key,noticeType:props.target.kind,noticeTarget:props.target.id,noticeVersion:notice?.version??''})}`,{replace:true,state:{cpBack:true}})
  }catch{if(token===epoch.current)setError(t('notice.error'))}finally{lock.current=false;setBusy(false)}
 }
 const followPayment=useEffectEvent(()=>{void openPayment()})
 useEffect(()=>{if(notice&&!checking&&!hidden&&['payment','request'].includes(notice.ref.kind))followPayment()},[notice,hidden,checking])
 const accountId=notice?.relatedAccountId??(props.target.kind==='account'?props.target.id:null),account=snapshot?.accounts.find(a=>a.id===accountId)
 const completed=resolution?.state==='completed'||notice?.state==='completed',changedState=resolution?.state==='changed'||notice?.state==='changed'
 const change=snapshot?.changes.find(c=>c.id===props.target.id),targetExpense=snapshot?.expenses.find(e=>e.id===change?.targetExpenseId)
 const draft=props.ledger.outbox.find(i=>i.command.requestId===props.target.id)
 return <HomeSheet title={notice?t(notice.title):t('notice.title')} testId="notification-target" onClose={props.onClose} dismissible={!busy} returnFocusRef={returnFocus}>
  <div className="home-notice-target" aria-busy={!resolution||busy||checking}>
   {(!resolution||checking)?<p role="status">{t('home.loading')}</p>:null}
   {resolution?.state==='retry'?<div role="alert"><p>{t('notice.error')}</p><button type="button" className="ms-btn-ghost" onClick={reloadTarget}>{t('common.retry')}</button></div>:null}
   {resolution?.state==='login'?<section><p>{t('notice.login')}</p><button type="button" className="ms-btn-primary" onClick={()=>navigate(`/login?redirect=${encodeURIComponent(noticePath(props.target))}`)}>{t('common.signIn')}</button></section>:null}
   {resolution?.state==='unavailable'?<p role="status">{t('notice.unavailable')}</p>:null}
   {notice?.description&&props.target.kind!=='account'?<h3>{notice.description}</h3>:expense?<h3>{expense.description??expense.category}</h3>:null}
   {notice?.date?<p className="home-meta">{formatDate(noticeCalendarDate(notice.date,props.timezone??'Asia/Kuala_Lumpur'),lang)}</p>:null}
   {completed?<p role="status">{t('notice.finished')}</p>:null}
   {changedState?<p role="status">{props.target.kind==='installment'&&row?.status==='scheduled'?t('notice.rescheduled',{date:row.due_on?formatDate(row.due_on,lang):''}):props.target.kind==='account'&&account?.archived?t('notice.archivedAccount'):t('notice.changed')}</p>:null}
   {error?<div role="alert"><p>{error}</p><p>{t('notice.retryInfo')}</p><button type="button" className="ms-btn-ghost" disabled={busy||checking} onClick={reloadTarget}>{t('notice.check')}</button></div>:null}
   {snapshot&&props.target.kind==='account'&&account?<section><h3>{account.name}</h3><p>{t('notice.balance')}</p><strong>{hidden?'••••':account.openingStatus==='posted'?formatMinorAmount(account.entrySumMinor,account.currency):t('home.balanceIncomplete')}</strong>{isAvailableMoneyAccount(account)?<button type="button" className="ms-btn-ghost" onClick={()=>{setHomeUi({mode:'daily',selectedAccountId:account.id});navigate('/',{replace:true})}}>{t('notice.records')}</button>:null}</section>:null}
   {notice?.state==='completed'&&props.target.kind==='funding'&&row&&account?<section><p>{account.name}</p><p>{t('notice.amount',{currency:row.account_currency??account.currency})}</p><strong>{hidden?'••••':row.account_amount_minor!=null?formatMinorAmount(Number(row.account_amount_minor),row.account_currency??account.currency):t('home.amountUnavailable')}</strong></section>:null}
   {notice?.state==='pending'&&hidden?<section><p>{t('notice.hiddenReview')}</p><button type="button" className="ms-btn-ghost" onClick={()=>setHomeUi({balanceHidden:false})}>{t('notice.show')}</button></section>:null}
   {notice?.state==='pending'&&!hidden&&props.target.kind==='funding'&&row&&snapshot&&expense?<FundingForm key={`${key}:${row.version}`} identity={props.identity} row={row} snapshot={snapshot} busy={busy||checking} onSubmit={work=>perform(work)} />:null}
   {notice?.state==='pending'&&!hidden&&props.target.kind==='expense'&&expense?<DirectExpenseReviewCard expense={expense} participantId={props.owner} busy={busy||checking} onRespond={(id,response,version)=>perform(async guard=>{
      const fresh=await loadNotificationSnapshot(props.owner),current=resolveNotice(fresh,props.target,props.ledger.outbox)
      guard()
      if(current.state!=='ready'||current.notice.state!=='pending'){reloadTarget();return}
      await notificationRpc('respond_to_direct_expense',{target_expense_id:id,response,expected_expense_version:version},props.identity,guard)
   })}/>:null}
   {notice?.state==='pending'&&!hidden&&props.target.kind==='change'&&change&&targetExpense?<ExpenseChangeRequestCard request={change} targetExpense={targetExpense} replacementExpense={snapshot!.expenses.find(e=>e.id===change.replacementExpenseId)??null} currentParticipantId={props.owner} onRefresh={async()=>{await changed();reloadTarget()}}/>:null}
   {notice?.state==='pending'&&!hidden&&['recurring','installment'].includes(props.target.kind)&&row?<section>
    {reviewAmount!=null&&reviewCurrency?<p>{t('notice.reviewAmount')} · {formatMinorAmount(Number(reviewAmount),reviewCurrency)}</p>:null}
    {props.target.kind==='installment'&&account&&row.asset_payment_minor!=null?<p>{t('notice.amount',{currency:account.currency})} · {formatMinorAmount(Number(row.asset_payment_minor),account.currency)}</p>:null}
    <p>{t('notice.reason')}</p><p>{row.error_code?t(friendlyErrorKey({message:row.error_code})):t('notice.status.pending')}</p>
    {account?<p>{account.name}</p>:null}
    <button type="button" className="ms-btn-primary" disabled={busy||checking} onClick={()=>void perform(async guard=>{
       const fresh=await loadNotificationSnapshot(props.owner),current=resolveNotice(fresh,props.target,props.ledger.outbox)
      guard()
       if(current.state!=='ready'||current.notice.state!=='pending'){reloadTarget();return}
       const latest=props.target.kind==='recurring'?fresh.recurring.find(r=>r.id===row.id):fresh.installments.find(r=>r.id===row.id)
       if(!latest)throw new Error('not_found')
       await notificationRpc(props.target.kind==='installment'?'retry_installment_repayment':latest.status==='failed'?'retry_personal_recurring_occurrence':'post_personal_recurring_occurrence',props.target.kind==='installment'?{target_installment_id:row.id}:{target_occurrence_id:row.id},props.identity,guard)
    })}>{t(row.status==='failed'?'common.retry':'notice.post')}</button>
    {account?<button type="button" className="ms-btn-ghost" onClick={()=>navigate(noticePath({kind:'account',id:account.id}),{replace:true})}>{t('notice.account')}</button>:null}
   </section>:null}
   {notice?.state==='pending'&&!hidden&&props.target.kind==='outbox'&&draft?<section><p>{t('notice.local')}</p><PendingExpenseRecoveryActions item={draft} onUndoAdd={id=>{const done=props.ledger.discardLocalCreate(id);reloadTarget();return done}} onDiscardFailed={id=>{const done=props.ledger.discardFailedCreate(id);reloadTarget();return done}} onRetry={id=>perform(async guard=>{
     const fresh=await loadNotificationSnapshot(props.owner)
     guard()
     if(fresh.expenses.some(e=>e.clientRequestId===id)){await props.ledger.refresh();return}
     await props.ledger.retryCommand(id)
   })}/></section>:null}
   {notice&&!hidden&&['payment','request'].includes(props.target.kind)?<button type="button" className="ms-btn-primary" disabled={busy||checking} onClick={()=>void openPayment()}>{t('notice.review')}</button>:null}
   {expense&&props.target.kind!=='outbox'?<ExpenseActionSheet expense={expense} currentParticipantId={props.owner} trigger={<span>{t('notice.original')}</span>} triggerClassName="ms-btn-ghost" readOnlyFallback onRefresh={async()=>{await changed();reloadTarget()}}/>:null}
   {snapshot&&!hidden&&(completed||changedState)&&expense?<ExpenseHistoryList expenses={snapshot.expenses.filter(e=>e.id===expense.id||e.correctsExpenseId===expense.id)} directRequests={snapshot.changes.filter(c=>c.targetExpenseId===expense.id)}/>:null}
  </div>
 </HomeSheet>
}
function plainMinor(value:number|string,currency:string){const digits=currencyExponent(currency),n=BigInt(value),base=10n**BigInt(digits);return `${n/base}${digits?'.'+(n%base).toString().padStart(digits,'0'):''}`}
function FundingForm({identity,row,snapshot,busy,onSubmit}:{identity:string;row:NoticeSnapshot['funding'][number];snapshot:NoticeSnapshot;busy:boolean;onSubmit:(work:(guard:()=>void)=>Promise<unknown>)=>Promise<void>}){
 const t=useT(),[accountId,setAccountId]=useState(row.account_id??''),[amount,setAmount]=useState(()=>row.account_id&&snapshot.accounts.find(a=>a.id===row.account_id)?.currency===row.expense_currency&&row.expense_amount_minor!=null?plainMinor(row.expense_amount_minor,row.expense_currency!):'')
 const account=snapshot.accounts.find(a=>a.id===accountId),storedAccount=snapshot.accounts.find(a=>a.id===row.account_id)
 const same=account?.currency===row.expense_currency
 const actual=amount
 const valid=()=>{try{return actual&&account&&!account.archived&&parseMajorAmount(actual,account.currency)>0}catch{return false}}
 return <form className="home-notice-form" onSubmit={e=>{e.preventDefault();if(!valid()||busy||!account)return;void onSubmit(async guard=>{
  const fresh=await loadNotificationSnapshot(snapshot.owner),current=fresh.funding.find(f=>f.id===row.id),expense=fresh.expenses.find(e=>e.id===row.expense_id)
  guard()
  if(!current||!expense||expense.status==='voided')throw new Error('not_found')
  if(current.status!=='pending')return
  if(current.version!==row.version)throw new Error('version_conflict')
  const minor=parseMajorAmount(actual,account.currency),payload={target_funding_intent_id:row.id,target_account_id:account.id,account_amount_minor:minor}
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))))).map(v=>v.toString(16).padStart(2,'0')).join('')
  const key=`tt-funding-attempt:${identity}:${row.id}`;let requestId=generateId()
  // Persist only opaque request/fingerprint metadata, never amount/account payloads.
  try{const previous=JSON.parse(sessionStorage.getItem(key)??'null');if(previous?.fingerprint===fingerprint&&typeof previous.requestId==='string')requestId=previous.requestId;sessionStorage.setItem(key,JSON.stringify({fingerprint,requestId}))}catch{/* Backend still locks the original intent. */}
  guard()
  await notificationRpc('complete_pending_funding',{request_id:requestId,...payload},identity,guard)
 })}}>
  <p>{t('notice.savedExpense')}</p>
  <label>{t('notice.choose')}<select aria-label={t('notice.choose')} value={accountId} disabled={busy||!!row.account_id} onChange={e=>{setAccountId(e.target.value);setAmount(snapshot.accounts.find(a=>a.id===e.target.value)?.currency===row.expense_currency&&row.expense_amount_minor!=null?plainMinor(row.expense_amount_minor,row.expense_currency!):'')}} autoFocus>
   <option value="">{t('notice.pick')}</option>{snapshot.accounts.filter(a=>!a.archived||a.id===row.account_id).map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
  </select></label>
  {account?.archived?<p role="status">{t('notice.accountArchived')}</p>:null}
  {row.account_id&&!storedAccount?<p role="status">{t('notice.unavailable')}</p>:null}
  {account?<label>{t('notice.amount',{currency:account.currency})}<AmountInput aria-label={t('notice.amount',{currency:account.currency})} value={actual} onValueChange={setAmount} disabled={busy} inputMode="decimal" /></label>:null}
  {account&&!same?<p>{t('notice.actual')}</p>:null}
  <button className="ms-btn-primary" type="submit" disabled={busy||!valid()}>{t('notice.complete')}</button>
 </form>
}
