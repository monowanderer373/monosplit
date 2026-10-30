import type {CanonicalExpense,GroupRole} from '../../types'
import type {usePersonalLedger} from '../../hooks/usePersonalLedger'
import {categoryKey,useT} from '../../lib/i18n'
import {formatMinorAmount} from '../../lib/money'
import {formatDate,localeForLang} from '../../lib/locale'
import {shiftCalendarDay} from '../../lib/tripCalendar'
import {useStore} from '../../store/useStore'
import ExpenseActionSheet from '../ExpenseActionSheet'
import PendingExpenseRecoveryActions from '../PendingExpenseRecoveryActions'
import SharedRestartActions from '../SharedRestartActions'
import './trip-ledger.css'

/** One presentation of original bill, payer and share facts for ledger and overview. */
export default function TripExpenseList({expenses,self,role,names,ledger,today,refresh,onViewHistory}: {
  expenses:readonly CanonicalExpense[];self:string;role:GroupRole;names:ReadonlyMap<string,string>;
  ledger:ReturnType<typeof usePersonalLedger>;today:string;refresh:()=>Promise<unknown>;onViewHistory?:(id:string)=>void
}) {
  const t=useT(),lang=useStore(s=>s.lang),hidden=useStore(s=>s.homeUi.balanceHidden)
  const money=(amount:number,currency:string)=>hidden?'••••':formatMinorAmount(amount,currency,localeForLang(lang))
  return <div className="tl-paper-list">{expenses.map((expense,index)=>{
    const pending=ledger.outbox.find(item=>item.command.requestId===expense.clientRequestId),own=expense.participations.find(p=>p.participantId===self),share=expense.shares.find(s=>s.expenseParticipationId===own?.id)?.amountMinor??0
    const payers=expense.payerContributions.filter(p=>p.amountMinor>0).map(p=>expense.participations.find(person=>person.id===p.expenseParticipationId)).filter(p=>!!p)
    const dateLabel=expense.occurredOn===today?t('tl.today')+' · '+formatDate(today,lang):expense.occurredOn===shiftCalendarDay(today,-1)?t('tl.yesterday')+' · '+formatDate(expense.occurredOn,lang):formatDate(expense.occurredOn,lang)
    const content=<><span className="tl-expense-heading"><strong>{expense.description??t(categoryKey(expense.category))}</strong><b>{money(expense.totalMinor,expense.currency)}</b></span><span className="tl-expense-meta">{t('tl.paidBy',{names:payers.map(p=>p.participantId===self?t('common.you'):p.nameSnapshot||names.get(p.participantId)||t('common.member')).join(', ')})}</span><span className="tl-expense-meta">{t('space.yourShare',{amount:money(share,expense.currency)})}<span aria-hidden="true"> ›</span></span></>
    return <article key={expense.id} className="tl-expense" data-expense-id={expense.id}>{index===0||expenses[index-1].occurredOn!==expense.occurredOn?<h3 className="tl-date-heading">{dateLabel}</h3>:null}{pending?<div className="tl-record-content">{content}</div>:<ExpenseActionSheet trigger={content} triggerClassName="tl-record-trigger" readOnlyFallback expense={expense} currentParticipantId={self} spaceRole={role} onRefresh={refresh} onViewHistory={onViewHistory?()=>onViewHistory(expense.id):undefined}/>}{pending?<div className="tl-recovery"><span>{t(pending.status==='rejected'?'ledger.needsAttention':'ledger.pendingSync')}</span><PendingExpenseRecoveryActions item={pending} onUndoAdd={ledger.discardLocalCreate} onRetry={ledger.retryCommand} onDiscardFailed={ledger.discardFailedCreate}/></div>:null}<SharedRestartActions expense={expense} owner={self} onRefresh={refresh}/></article>
  })}</div>
}
