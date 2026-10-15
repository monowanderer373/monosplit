import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {formatDate} from '../../lib/locale'
import {formatMinorAmount} from '../../lib/money'
import {useStore} from '../../store/useStore'
import {useT} from '../../lib/i18n'
import {noticeCalendarDate,type NoticeRef,type NoticeSnapshot} from '../../lib/homeNotifications'
import {noticePath} from '../../lib/homeNotifications'
import {takeNoticeOrigin} from '../../lib/notificationPresentation'
import {isAvailableMoneyAccount,localCalendarDate,type HomeAccount} from '../../lib/homeView'
import {loadNotificationAccountEntries,type NotificationAccountEntry} from '../../lib/notificationRepository'
import ExpenseActionSheet from '../ExpenseActionSheet'
import ExpenseHistoryList from '../ExpenseHistoryList'
import QuickIcon from '../QuickIcon'

export function NotificationContext({name,amount,currency,date,icon='Bills'}:{name:string;amount?:number|string|null;currency?:string|null;date?:string;icon?:string}){
 const hidden=useStore(s=>s.homeUi.balanceHidden),lang=useStore(s=>s.lang)
 return <div className="notification-a-context"><span className="notification-a-context-icon"><QuickIcon name={icon} size={22}/></span><div><h3>{name}</h3><p className="home-meta">{amount!=null&&currency?<>{hidden?'••••':formatMinorAmount(Number(amount),currency)}{date?' · ':''}</>:null}{date?formatDate(date,lang):null}</p></div></div>
}
export function NotificationObjectDetails({snapshot,target,onRefresh,timezone='Asia/Kuala_Lumpur'}:{timezone?:string;snapshot:NoticeSnapshot;target:NoticeRef;onRefresh:()=>Promise<unknown>}){
 const t=useT(),navigate=useNavigate(),lang=useStore(s=>s.lang),hidden=useStore(s=>s.homeUi.balanceHidden)
 const row=target.kind==='funding'?snapshot.funding.find(r=>r.id===target.id):target.kind==='recurring'?snapshot.recurring.find(r=>r.id===target.id):snapshot.installments.find(r=>r.id===target.id)
 const rule=snapshot.rules.find(r=>r.id===row?.rule_id),plan=snapshot.plans.find(p=>p.id===row?.plan_id)
 const expense=snapshot.expenses.find(e=>e.id===(target.kind==='expense'?target.id:row?.expense_id??plan?.purchase_expense_id))
 const account=snapshot.accounts.find(a=>a.id===(row?.account_id??row?.effective_account_id??row?.repayment_account_id??rule?.funding_account_id))
 const amount=target.kind==='recurring'?row?.effective_amount_minor??rule?.amount_minor:target.kind==='installment'?row?.principal_minor:expense?.totalMinor,currency=target.kind==='recurring'?row?.effective_currency??rule?.currency:target.kind==='installment'?plan?.currency:expense?.currency
 const selectedDate=row?.effective_occurred_on??row?.scheduled_for??row?.due_on??expense?.occurredOn
 const upcoming=target.kind==='recurring'?snapshot.recurring.filter(r=>r.rule_id===rule?.id&&r.id!==row?.id&&(r.scheduled_for??'')>(selectedDate??'')):target.kind==='installment'?snapshot.installments.filter(r=>r.plan_id===plan?.id&&r.id!==row?.id&&(r.due_on??'')>(selectedDate??'')):[]
 return <section className="notification-a-panel">
  <NotificationContext name={rule?.title??expense?.description??expense?.category??t('noticeA.recordSummary')} amount={amount} currency={currency} date={selectedDate}/>
  <dl className="notification-a-facts"><div><dt>{t('notice.choose')}</dt><dd>{account?.name??t('noticeA.funding.noAccount')}</dd></div><div><dt>{t('notice.reason')}</dt><dd>{row&&['pending','failed','pending_review','scheduled'].includes(row.status)?t('noticeA.taskPending'):row?.status==='posted'?t('notice.status.completed'):t('notice.status.info')}</dd></div></dl>
  {row&&(['pending','failed','pending_review'].includes(row.status)||target.kind==='installment'&&row.status==='scheduled'&&!!row.due_on&&row.due_on<=localCalendarDate(new Date(),timezone))?<><p className="notification-a-helper">{t(target.kind==='funding'?'noticeA.expenseSaved':'noticeA.recurring.help')}</p><button type="button" className="ms-btn-primary" onClick={()=>navigate(target.kind==='installment'&&row.status==='scheduled'?noticePath(target)+'&review='+row.version:noticePath(target),{replace:true,state:{noticeBack:true}})}>{t(target.kind==='funding'?(row.account_id?'noticeA.funding.addAmount':'noticeA.funding.chooseAccount'):target.kind==='recurring'?'noticeA.recurring.paid':'noticeA.installment.title')}</button></>:null}
  {upcoming.length?<details className="notification-a-disclosure"><summary>{t('noticeA.details')}</summary>{upcoming.sort((a,b)=>(a.due_on??a.scheduled_for??'').localeCompare(b.due_on??b.scheduled_for??'')).map(item=><p key={item.id}>{formatDate(item.due_on??item.scheduled_for??'',lang)} · {t(item.status==='scheduled'?'noticeA.taskPending':item.status==='posted'?'notice.status.completed':'notice.status.info')}</p>)}</details>:null}
  {expense?<details className="notification-a-disclosure"><summary>{t('noticeA.common.viewRecord')}</summary><ExpenseActionSheet expense={expense} currentParticipantId={snapshot.owner} readOnlyFallback trigger={<span>{t('notice.original')}</span>} onRefresh={onRefresh}/>{!hidden?<ExpenseHistoryList expenses={snapshot.expenses} directRequests={snapshot.changes} focusExpenseId={expense.id}/>:null}</details>:null}
 </section>
}
export function NotificationAccountDetails({account,identity,owner,onRecords}:{account:HomeAccount;identity:string;owner:string;onRecords:()=>void}){
 const t=useT(),hidden=useStore(s=>s.homeUi.balanceHidden),lang=useStore(s=>s.lang),[epoch,setEpoch]=useState(0)
 const [result,setResult]=useState<{key:string;data:NotificationAccountEntry[];error:boolean}|null>(null),key=owner+':'+account.id+':'+account.attentionRevision
 useEffect(()=>{let active=true;void loadNotificationAccountEntries(account.id).then(data=>{if(active)setResult({key,data,error:false})}).catch(()=>{if(active)setResult({key,data:[],error:true})});return()=>{active=false}},[account.id,key,epoch])
 const current=result?.key===key?result:null
 return <section className="notification-a-panel"><NotificationContext name={account.name} icon="wallet"/><p>{t('notice.balance')}</p><strong className={`notification-a-account-balance ${account.entrySumMinor<0?'notification-a-negative':''}`}>{hidden?'••••':account.openingStatus==='posted'?formatMinorAmount(account.entrySumMinor,account.currency):t('home.balanceIncomplete')}</strong>
  {!account.archived&&account.openingStatus==='posted'&&account.entrySumMinor<0?<p className="notification-a-highlight">{t('noticeA.account.negative')}</p>:null}<p className="notification-a-helper">{t('noticeA.account.help')}</p>
  {!current?<p role="status">{t('home.loading')}</p>:current.error?<section role="alert"><p>{t('noticeA.account.recordsError')}</p><button type="button" className="ms-btn-ghost" onClick={()=>setEpoch(n=>n+1)}>{t('common.retry')}</button></section>:<div>{current.data.length?current.data.slice(0,5).map(entry=><div className="notification-a-entry" key={entry.id}><span>{entry.description??t('noticeA.recordSummary')}</span><strong>{hidden?'••••':formatMinorAmount(entry.amountMinor,entry.currency)}</strong><small>{formatDate(noticeCalendarDate(entry.date,'Asia/Kuala_Lumpur'),lang)}</small></div>):<p>{t('noticeA.noEntries')}</p>}</div>}
  {isAvailableMoneyAccount(account)?<button type="button" className="notification-a-detail-link" onClick={()=>{takeNoticeOrigin(identity);onRecords()}}>{t('noticeA.account.records')} →</button>:null}
 </section>
}
