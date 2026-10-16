import {formatDate} from '../../lib/locale'
import {useCallback,useEffect,useEffectEvent,useRef,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import NotificationSurface from './NotificationSurface'
import FundingForm from './NotificationFundingForm'
import FundingBundleForm from '../accounts/FundingBundleForm'
import NotificationOccurrenceForm from './NotificationOccurrenceForm'
import {localCalendarDate} from '../../lib/homeView'
import {NotificationContext,NotificationObjectDetails,NotificationAccountDetails} from './NotificationDetails'
import {noticePagePath,simpleNotice} from '../../lib/notificationPresentation'
import ExpenseHistoryList from '../ExpenseHistoryList'
import ExpenseChangeRequestCard from '../ExpenseChangeRequestCard'
import DirectExpenseReviewCard from '../DirectExpenseReviewCard'
import PendingExpenseRecoveryActions from '../PendingExpenseRecoveryActions'
import {useStore} from '../../store/useStore'
import {useT,friendlyErrorKey} from '../../lib/i18n'
import {formatMinorAmount} from '../../lib/money'
import {loadNotificationSnapshot,notificationRpc,noticeQueryFailure} from '../../lib/notificationRepository'
import {resolveNotice,noticeKey,noticePath,noticeCalendarDate,type NoticeRef,type NoticeResolution,type HomeNotification} from '../../lib/homeNotifications'
import {collectPayService} from '../../lib/collectPayRepository'
import {buildCollectPayItems} from '../../lib/collectPay'
import type {usePersonalLedger} from '../../hooks/usePersonalLedger'

type Props={reviewVersion?:number;details?:boolean;timezone?:string;sourceVersion?:string;owner:string;identity:string;target:NoticeRef;ledger:ReturnType<typeof usePersonalLedger>;onClose:()=>void;onViewed:(notice:HomeNotification)=>void;onChange:()=>Promise<unknown>}
export default function NotificationTarget(props:Props){
 const lang=useStore(s=>s.lang),t=useT(),navigate=useNavigate(),hidden=useStore(s=>s.homeUi.balanceHidden),setHomeUi=useStore(s=>s.setHomeUi)
 const [fundingNeedsAmount,setFundingNeedsAmount]=useState(false)
 const key=noticeKey(props.target),[reload,setReload]=useState(0),[result,setResult]=useState<{key:string;owner:string;value:NoticeResolution}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loadingSnapshot,setChecking]=useState(true)
 const checking=loadingSnapshot||props.sourceVersion?.startsWith('loading:')===true
 const actionEpoch=useRef(0)
 const lock=useRef(false),epoch=useRef(0),returnFocus=useRef<HTMLElement|null>(null)
 const viewed=useEffectEvent((n:HomeNotification)=>props.onViewed(n)),changed=props.onChange
 useEffect(()=>()=>{actionEpoch.current++},[key,props.owner,props.identity,props.details,props.reviewVersion])
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
 const reconciled=useRef('')
 useEffect(()=>{
  if(!resolution)return
  if(resolution.state==='completed'||resolution.state==='changed'||resolution.state==='unavailable'||resolution.state==='ready'&&(['completed','changed'].includes(resolution.notice.state)||resolution.notice.ref.kind==='account')){
   const stamp=key+':'+resolution.state+(resolution.state==='ready'?':'+resolution.notice.version:'')
   if(reconciled.current!==stamp){reconciled.current=stamp;void reconcile()}
  }
 },[resolution,key])
 const notice=resolution?.state==='ready'?resolution.notice:null
 useEffect(()=>{if(notice&&!['payment','request'].includes(notice.ref.kind))viewed(notice)},[notice])
 const snapshot=resolution&&'snapshot'in resolution?resolution.snapshot:null
 const row=snapshot?.[props.target.kind==='funding'?'funding':props.target.kind==='recurring'?'recurring':props.target.kind==='installment'?'installments':'funding'].find(r=>r.id===props.target.id)
 const plan=snapshot?.plans.find(p=>p.id===row?.plan_id),rule=snapshot?.rules.find(r=>r.id===row?.rule_id)
 const reviewAmount=props.target.kind==='recurring'?row?.effective_amount_minor??rule?.amount_minor:row?.principal_minor
 const reviewCurrency=props.target.kind==='recurring'?row?.effective_currency??rule?.currency:plan?.currency
 const change=snapshot?.changes.find(c=>c.id===props.target.id),targetExpense=snapshot?.expenses.find(e=>e.id===change?.targetExpenseId)
 const expense=snapshot?.expenses.find(e=>e.id===(props.target.kind==='change'?change?.targetExpenseId:props.target.kind==='expense'?props.target.id:props.target.kind==='outbox'?snapshot?.expenses.find(e=>e.clientRequestId===props.target.id)?.id:row?.expense_id??plan?.purchase_expense_id))
 const reloadTarget=()=>{setReload(n=>n+1)}
 const perform=async(work:(guard:()=>void)=>Promise<unknown>)=>{
  if(lock.current||checking)return
  lock.current=true;setBusy(true);setError('');const token=actionEpoch.current
  const guard=()=>{if(token!==actionEpoch.current)throw new Error('notification_context_changed')}
  try{guard();await work(guard);if(token!==actionEpoch.current)return;await changed();if(token===actionEpoch.current)reloadTarget()}
  catch(cause){if(token===actionEpoch.current){setError(t(friendlyErrorKey(cause)));if(cause instanceof Error&&['version_conflict','personal_account_archived','not_found'].includes(cause.message))reloadTarget()}}
  finally{lock.current=false;setBusy(false)}
 }
 const openPayment=async()=>{
  if(lock.current||checking)return
  lock.current=true;setBusy(true);setError('');const token=actionEpoch.current
  try{
    const fresh=await collectPayService.load(props.owner)
    if(token!==actionEpoch.current)return
    const item=buildCollectPayItems(fresh).find(i=>props.target.kind==='payment'?i.payments.some(p=>p.id===props.target.id):i.requests.some(p=>p.id===props.target.id))
    if(!item){setResult({key,owner:props.owner,value:{state:'unavailable'}});return}
    navigate(`/collect-pay/${item.direction}?${new URLSearchParams({item:item.key,noticeType:props.target.kind,noticeTarget:props.target.id,noticeVersion:notice?.version??''})}`,{replace:true,state:{cpBack:true}})
  }catch(cause){if(token===actionEpoch.current){if(noticeQueryFailure(cause).state==='login')setResult({key,owner:props.owner,value:{state:'login'}});else setError(t('notice.error'))}}finally{lock.current=false;setBusy(false)}
 }
 const followPayment=useEffectEvent(()=>{void openPayment()})
 useEffect(()=>{if(notice&&!checking&&!hidden&&['payment','request'].includes(notice.ref.kind))followPayment()},[notice,hidden,checking])
 const accountId=notice?.relatedAccountId??(props.target.kind==='account'?props.target.id:null),account=snapshot?.accounts.find(a=>a.id===accountId)
 const allowScheduled=props.target.kind==='installment'&&row?.status==='scheduled'&&props.reviewVersion===row.version&&!!row.due_on&&row.due_on<=localCalendarDate(new Date(),props.timezone??'Asia/Kuala_Lumpur')
 const completed=resolution?.state==='completed'||notice?.state==='completed',changedState=!allowScheduled&&(resolution?.state==='changed'||notice?.state==='changed')
 const draft=props.ledger.outbox.find(i=>i.command.requestId===props.target.id)
 const noEligible=notice?.state==='pending'&&props.target.kind==='funding'&&!row?.account_id&&!snapshot?.accounts.some(a=>!a.archived)
 const outcome=!resolution||checking?'loading':noEligible?'no-account':allowScheduled?'pending':resolution.state==='ready'?notice?.state:resolution.state
 const isPage=!!props.details||!simpleNotice(props.target)
 const title=noEligible?t('noticeA.state.noAccount'):props.details?t(props.target.kind==='recurring'?'noticeA.recurringDetails':props.target.kind==='installment'?'noticeA.installmentDetails':'noticeA.expenseDetails'):!resolution||checking?t('noticeA.state.loading'):resolution.state==='retry'?t('noticeA.state.retry'):resolution.state==='login'?t('noticeA.state.login'):resolution.state==='unavailable'?t('noticeA.state.unavailable'):props.target.kind==='account'?t('noticeA.common.account'):notice?.state==='info'&&props.target.kind==='change'?t('noticeA.awaitingApprovals'):completed&&!['payment','request'].includes(props.target.kind)?t('noticeA.state.completed'):changedState?t('noticeA.state.changed'):props.target.kind==='funding'&&snapshot?.money?t('mc.verify.single'):props.target.kind==='funding'?t(fundingNeedsAmount||row?.account_id?'noticeA.funding.addAmount':'noticeA.funding.chooseAccount'):t(props.target.kind==='expense'?'noticeA.direct.review':props.target.kind==='change'?(change?.kind==='cancellation'?'noticeA.cancel.title':'noticeA.change.title'):props.target.kind==='recurring'?'noticeA.recurring.title':props.target.kind==='installment'?'noticeA.installment.title':props.target.kind==='payment'?'noticeA.receipt.title':props.target.kind==='request'?'noticeA.payment.title':draft?.commitState==='unknown'?'noticeA.outboxUncertain':'noticeA.outbox.title')
 const toDetails=()=>navigate(noticePagePath(props.target,true),{replace:true,state:{noticeBack:true}})
 return <NotificationSurface outcome={outcome} page={isPage} title={title} onClose={props.onClose} busy={busy} returnFocus={returnFocus}>
  <div className="home-notice-target" aria-busy={!resolution||busy||checking}>
   {(!resolution||checking)?<p role="status">{t('home.loading')}</p>:null}
   {resolution?.state==='retry'?<div role="alert"><p>{t('notice.error')}</p><button type="button" className="ms-btn-primary" onClick={reloadTarget}>{t('common.retry')}</button></div>:null}
   {resolution?.state==='login'?<section><p>{t('notice.login')}</p><button type="button" className="ms-btn-primary" onClick={()=>navigate(`/login?redirect=${encodeURIComponent(noticePath(props.target))}`)}>{t('common.signIn')}</button></section>:null}
   {resolution?.state==='unavailable'?<p role="status">{t('notice.unavailable')}</p>:null}
   {!props.details&&['funding','recurring','installment','outbox'].includes(props.target.kind)&&(notice||expense||allowScheduled)?<NotificationContext name={notice?.description||expense?.description||expense?.category||t('noticeA.recordSummary')} amount={props.target.kind==='recurring'||props.target.kind==='installment'?reviewAmount:expense?.totalMinor??draft?.optimisticExpense.totalMinor} currency={props.target.kind==='recurring'||props.target.kind==='installment'?reviewCurrency:expense?.currency??draft?.optimisticExpense.currency} date={notice?.date?noticeCalendarDate(notice.date,props.timezone??'Asia/Kuala_Lumpur'):row?.due_on??row?.scheduled_for}/>:null}
   {props.details&&snapshot&&resolution?.state!=='unavailable'?<NotificationObjectDetails snapshot={snapshot} target={props.target} timezone={props.timezone} onRefresh={async()=>{await changed();reloadTarget()}}/>:null}
   {completed&&!['payment','request'].includes(props.target.kind)?<p role="status">{t('notice.finished')}</p>:null}
   {changedState?<p role="status">{props.target.kind==='change'&&change?.state==='declined'?t('noticeA.requestDeclined'):props.target.kind==='change'&&change?.state==='cancelled'?t('noticeA.requestWithdrawn'):props.target.kind==='installment'&&row?.status==='scheduled'?t('notice.rescheduled',{date:row.due_on?formatDate(row.due_on,lang):''}):props.target.kind==='account'&&account?.archived?t('notice.archivedAccount'):t('notice.changed')}</p>:null}
   {error?<div role="alert"><p>{error}</p><p>{t('notice.retryInfo')}</p><button type="button" className="ms-btn-ghost" disabled={busy||checking} onClick={reloadTarget}>{t('notice.check')}</button></div>:null}
   {snapshot&&props.target.kind==='account'&&account?<NotificationAccountDetails account={account} owner={props.owner} identity={props.identity} onRecords={()=>{setHomeUi({mode:'daily',selectedAccountId:account.id});navigate('/',{replace:true})}}/>:null}
   {notice?.state==='completed'&&props.target.kind==='funding'&&row&&account?<section><p>{account.name}</p><p>{t('notice.amount',{currency:row.account_currency??account.currency})}</p><strong>{hidden?'••••':row.account_amount_minor!=null?formatMinorAmount(Number(row.account_amount_minor),row.account_currency??account.currency):t('home.amountUnavailable')}</strong></section>:null}
   {(notice?.state==='pending'||allowScheduled)&&hidden&&!(props.target.kind==='funding'&&snapshot?.money)?<section><p>{t('notice.hiddenReview')}</p><button type="button" className="ms-btn-ghost" onClick={()=>setHomeUi({balanceHidden:false})}>{t('notice.show')}</button></section>:null}
   {!props.details&&notice?.state==='pending'&&props.target.kind==='funding'&&row&&snapshot&&expense?(snapshot.money?<FundingBundleForm hidden={hidden} onReveal={()=>setHomeUi({balanceHidden:false})} key={`${key}:${row.version}`} identity={props.identity} row={row} snapshot={snapshot} busy={busy||checking||!!error} onSubmit={work=>perform(work)}/>:!hidden?<FundingForm key={`${key}:${row.version}`} identity={props.identity} row={row} snapshot={snapshot} onModeChange={setFundingNeedsAmount} busy={busy||checking} onSubmit={work=>perform(work)} />:null):null}
   {notice?.state==='pending'&&!hidden&&props.target.kind==='expense'&&expense?<DirectExpenseReviewCard compact expense={expense} participantId={props.owner} busy={busy||checking} onRespond={(id,response,version)=>perform(async guard=>{
      const fresh=await loadNotificationSnapshot(props.owner),current=resolveNotice(fresh,props.target,props.ledger.outbox)
      guard()
      if(current.state!=='ready'||current.notice.state!=='pending'){reloadTarget();return}
      await notificationRpc('respond_to_direct_expense',{target_expense_id:id,response,expected_expense_version:version},props.identity,guard)
   })}/>:null}
   {notice?.state==='pending'&&!hidden&&props.target.kind==='change'&&change&&targetExpense?<ExpenseChangeRequestCard compact disabled={busy||checking} request={change} targetExpense={targetExpense} replacementExpense={snapshot!.expenses.find(e=>e.id===change.replacementExpenseId)??null} currentParticipantId={props.owner} onRespond={response=>perform(async guard=>{
     const fresh=await loadNotificationSnapshot(props.owner),current=resolveNotice(fresh,props.target,props.ledger.outbox),latest=fresh.changes.find(c=>c.id===change.id)
     guard()
     if(current.state!=='ready'||current.notice.state!=='pending'){reloadTarget();return}
     if(latest?.version!==change.version)throw new Error('version_conflict')
     await notificationRpc('respond_to_direct_expense_change',{target_request_id:change.id,response,expected_request_version:change.version},props.identity,guard)
   })} onRefresh={async()=>{await changed();reloadTarget()}}/>:null}
   {!props.details&&(notice?.state==='pending'||allowScheduled)&&!hidden&&['recurring','installment'].includes(props.target.kind)&&row&&snapshot?<NotificationOccurrenceForm key={`${key}:${row.version}`} identity={props.identity} target={props.target} row={row} snapshot={snapshot} busy={busy||checking} allowScheduled={allowScheduled} onSubmit={work=>perform(work)}/>:null}
   {notice?.state==='pending'&&!hidden&&props.target.kind==='outbox'&&draft?<section><p>{t('notice.local')}</p><PendingExpenseRecoveryActions notification disabled={busy||checking} item={draft} onUndoAdd={id=>{const done=props.ledger.discardLocalCreate(id);reloadTarget();return done}} onDiscardFailed={id=>{const done=props.ledger.discardFailedCreate(id);reloadTarget();return done}} onRetry={id=>perform(async guard=>{
     const fresh=await loadNotificationSnapshot(props.owner)
     guard()
     if(fresh.expenses.some(e=>e.clientRequestId===id)){await props.ledger.refresh();return}
     await props.ledger.retryCommand(id)
   })}/></section>:null}
   {notice&&!hidden&&['payment','request'].includes(props.target.kind)?<button type="button" className="ms-btn-primary" disabled={busy||checking} onClick={()=>void openPayment()}>{t('notice.review')}</button>:null}
   {notice?.state==='completed'&&props.target.kind==='recurring'&&row?.funding_intent_id&&snapshot?.funding.some(f=>f.id===row.funding_intent_id&&f.status==='pending')?<section><p>{t('noticeA.privatePaymentPending')}</p><button type="button" className="ms-btn-primary" onClick={()=>navigate(noticePath({kind:'funding',id:row.funding_intent_id!}),{replace:true,state:{noticeBack:true}})}>{t('noticeA.funding.addAmount')}</button></section>:null}
   {!props.details&&snapshot&&['funding','recurring','installment'].includes(props.target.kind)?<button type="button" className={completed||changedState?"ms-btn-primary":"notification-a-detail-link"} disabled={busy||checking} onClick={toDetails}>{t(props.target.kind==='funding'?'noticeA.common.viewRecord':props.target.kind==='recurring'?'noticeA.recurring.view':'noticeA.installment.view')}</button>:null}
   {!props.details&&completed&&props.target.kind==='expense'&&snapshot?<NotificationObjectDetails snapshot={snapshot} target={props.target} timezone={props.timezone} onRefresh={async()=>{await changed();reloadTarget()}}/>:null}
   {resolution?.state==='unavailable'?<button type="button" className="ms-btn-primary" onClick={props.onClose}>{t('noticeA.common.backNotifications')}</button>:null}
   {props.target.kind==='change'&&notice?.state!=='pending'&&targetExpense?<NotificationContext name={targetExpense.description??targetExpense.category} amount={targetExpense.totalMinor} currency={targetExpense.currency} date={targetExpense.occurredOn}/>:null}
   {notice?.state==='info'&&props.target.kind==='change'?<p role="status">{t('noticeA.yourResponseSaved')}</p>:null}
   {snapshot&&!hidden&&(completed||changedState)&&expense?<ExpenseHistoryList expenses={snapshot.expenses} directRequests={snapshot.changes} focusExpenseId={expense.id}/>:null}
  </div>
 </NotificationSurface>
}
