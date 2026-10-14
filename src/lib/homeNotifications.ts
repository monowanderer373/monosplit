import {localCalendarDate} from './homeView'
import type { CanonicalExpense } from '../types'
import type { HomeAccount } from './homeView'
import type { PendingLedgerCommand } from '../store/useStore'
import type { DirectExpenseChangeRequest } from './expenseChangeRepository'
import type { SettlementPayment } from './settlementRepository'
import type { TranslationKey } from './i18n'

export type NoticeKind = 'funding' | 'account' | 'recurring' | 'installment' | 'expense' | 'change' | 'payment' | 'request' | 'outbox'
export type NoticeRef = Readonly<{kind: NoticeKind; id: string}>
export type NoticeRow = {id: string; status: string; version: number; updated_at: string; expense_id?: string | null; account_id?: string | null; account_amount_minor?: number | string | null; expense_amount_minor?: number | string; expense_currency?: string; account_currency?: string | null; rule_id?: string; scheduled_for?: string; title?: string; funding_account_id?: string; error_code?: string | null; plan_id?: string; due_on?: string; repayment_account_id?: string; purchase_expense_id?: string; funding_intent_id?: string; debtor_participant_id?: string; creditor_participant_id?: string; created_at?: string; scope?: 'direct'|'space'; space_id?:string|null; amount_minor?:number|string; currency?:string; effective_amount_minor?:number|string|null; effective_currency?:string|null; effective_account_id?:string|null; principal_minor?:number|string; asset_payment_minor?:number|string|null}
export type NoticeSnapshot = {owner: string; accounts: HomeAccount[]; expenses: CanonicalExpense[]; changes: DirectExpenseChangeRequest[]; payments: SettlementPayment[]; funding: NoticeRow[]; recurring: NoticeRow[]; rules: NoticeRow[]; installments: NoticeRow[]; plans: NoticeRow[]; requests: NoticeRow[]}
export type HomeNotification = {id: string; ref: NoticeRef; intent: 'complete-funding'|'view-account'|'review-recurring'|'review-installment'|'review-expense'|'review-change'|'review-payment'|'review-request'|'review-outbox'|'view-current'; source: 'owner-account' | 'shared-ledger' | 'local-outbox'; version: string; tab: 'tasks' | 'activity'; state: 'pending' | 'completed' | 'changed' | 'info'; title: TranslationKey; action: TranslationKey; description: string; date: string; scope: {kind: 'personal' | 'direct' | 'space'; spaceId: string | null}; relatedAccountId?: string | null;relatedAccountName?:string}
export const noticeKey = (ref: NoticeRef) => `${ref.kind}:${ref.id}`
const kinds: NoticeKind[] = ['funding','account','recurring','installment','expense','change','payment','request','outbox']
export function parseNotice(search: string): NoticeRef | null {
  const params = new URLSearchParams(search), kind = params.get('notice'), id = params.get('target')
  return kind && kinds.includes(kind as NoticeKind) && id && /^[a-zA-Z0-9-]{1,100}$/.test(id) ? {kind:kind as NoticeKind,id} : null
}
export function noticePath(ref: NoticeRef) { return `/?${new URLSearchParams({notice:ref.kind,target:ref.id})}` }
export function buildHomeNotifications(s: NoticeSnapshot, outbox: readonly PendingLedgerCommand[],activityLimit=50): HomeNotification[] {
  const entries: HomeNotification[] = [], expenses = new Map(s.expenses.map(e=>[e.id,e]))
  const add = (ref: NoticeRef, state: HomeNotification['state'], title: TranslationKey, action: TranslationKey, description: string, date: string, version: string, expense?: CanonicalExpense, relatedAccountId?: string | null) => entries.push({id:noticeKey(ref),ref,intent:state!=='pending'?'view-current':ref.kind==='funding'?'complete-funding':ref.kind==='account'?'view-account':`review-${ref.kind}` as HomeNotification['intent'],source:ref.kind==='outbox'?'local-outbox':['funding','account','recurring','installment'].includes(ref.kind)?'owner-account':'shared-ledger',version,tab:state==='pending'?'tasks':'activity',state,title,action,description,date,scope:{kind:expense?.scope??'personal',spaceId:expense?.spaceId??null},relatedAccountId,relatedAccountName:s.accounts.find(a=>a.id===relatedAccountId)?.name})
  for (const row of s.funding) {
    const expense = expenses.get(row.expense_id ?? ''), changed = row.status==='cancelled'||row.status==='reversed'||expense?.status==='voided'
    const state = changed?'changed':row.status==='pending'?'pending':'completed'
    add({kind:'funding',id:row.id},state,state==='pending'?'notice.funding':state==='changed'?'notice.fundingChanged':'notice.fundingDone',state==='pending'?(row.account_id?'notice.complete':'notice.choose'):'notice.view',expense?.description??expense?.category??'',state==='pending'?(expense?.occurredOn??row.updated_at):row.updated_at,String(row.version),expense,row.account_id)
  }
  for (const account of s.accounts) if (!account.archived && account.accountClass==='asset' && account.openingStatus==='posted' && account.entrySumMinor<0) add({kind:'account',id:account.id},'info','notice.negative','notice.account',account.name,'',`negative:${account.attentionRevision??'known'}`,undefined,account.id)
  for (const row of s.recurring) {
    const rule=s.rules.find(r=>r.id===row.rule_id), expense=expenses.get(row.expense_id??'')
    const pending=['pending_review','failed'].includes(row.status)
    add({kind:'recurring',id:row.id},pending?'pending':row.status==='reversed'?'changed':'completed',pending?'notice.recurring':'notice.recurringUpdate',pending?'notice.review':'notice.view',rule?.title??expense?.description??'',pending?(row.scheduled_for??''):row.updated_at,String(row.version),expense, row.effective_account_id??rule?.funding_account_id)
  }
  for (const row of s.installments) {
    if (row.status==='scheduled') continue
    const plan=s.plans.find(p=>p.id===row.plan_id), expense=expenses.get(plan?.purchase_expense_id??'')
    add({kind:'installment',id:row.id},row.status==='failed'?'pending':row.status==='reversed'?'changed':'completed',row.status==='failed'?'notice.installment':'notice.installmentUpdate',row.status==='failed'?'notice.review':'notice.view',expense?.description??expense?.category??'',row.status==='failed'?(row.due_on??''):row.updated_at,String(row.version),expense,row.repayment_account_id)
  }
  const candidates = new Set(s.changes.map(c=>c.replacementExpenseId))
  for (const expense of s.expenses) if (expense.scope==='direct' && expense.status==='active' && !candidates.has(expense.id) && expense.participations.some(p=>p.participantId===s.owner&&p.state==='pending')) add({kind:'expense',id:expense.id},'pending','notice.expense','notice.review',expense.description??expense.category,expense.occurredOn,String(expense.version),expense)
  for (const change of s.changes) if(change.state==='pending'&&change.approvals.some(a=>a.participantId===s.owner&&a.state==='pending')) add({kind:'change',id:change.id},'pending','notice.change','notice.review',expenses.get(change.targetExpenseId)?.description??'',change.createdAt,String(change.version),expenses.get(change.targetExpenseId))
  for (const payment of s.payments) {
    const own=payment.allocations.filter(a=>a.creditorParticipantId===s.owner)
    if(payment.debtorParticipantId!==s.owner&&!own.length)continue
    const pending=own.some(a=>a.state==='pending'),state=pending?'pending':payment.allocations.some(a=>a.state==='pending')?'info':['reversed','cancelled','declined'].includes(payment.status)?'changed':'completed'
    add({kind:'payment',id:payment.id},state,pending?'notice.payment':'notice.paymentUpdate',pending?'notice.review':'notice.view',payment.note??'',pending?payment.paymentDate:payment.updatedAt,String(payment.version))
    entries.at(-1)!.scope={kind:payment.scope,spaceId:payment.spaceId}
  }
  for (const row of s.requests) if(row.debtor_participant_id===s.owner||row.creditor_participant_id===s.owner) {
    const state=row.status==='open'?(row.debtor_participant_id===s.owner?'pending':'info'):row.status==='converted'?'completed':'changed'
    add({kind:'request',id:row.id},state,state==='pending'?'notice.request':'notice.requestUpdate',state==='pending'?'notice.review':'notice.view','',state==='pending'||state==='info'?(row.created_at??''):row.updated_at,String(row.version))
    entries.at(-1)!.scope={kind:row.scope??'direct',spaceId:row.space_id??null}
  }
  const submitted = new Set(s.expenses.map(e=>e.clientRequestId))
  for(const item of outbox) if(!submitted.has(item.command.requestId)) add({kind:'outbox',id:item.command.requestId},'pending','notice.outbox','notice.review',item.optimisticExpense.description??item.optimisticExpense.category,item.optimisticExpense.occurredOn,`${item.status}:${item.commitState}:${item.attempts}`,item.optimisticExpense)
  // Authority is fetched before building; never merge a late event into these rows.
  const unique=new Map<string,HomeNotification>()
  for(const n of entries){const prior=unique.get(n.id);if(!prior||!(Number(prior.version)>Number(n.version)))unique.set(n.id,n)}
  const sorted=[...unique.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
  return [...sorted.filter(n=>n.tab==='tasks'),...sorted.filter(n=>n.tab==='activity'&&n.state==='info'),...sorted.filter(n=>n.tab==='activity'&&n.state!=='info').slice(0,activityLimit)]
}
export type NoticeResolution = {state:'ready';notice:HomeNotification;snapshot:NoticeSnapshot} | {state:'completed'|'changed';snapshot:NoticeSnapshot} | {state:'unavailable'} | {state:'login'} | {state:'retry'}
export function resolveNotice(s: NoticeSnapshot | null, ref: NoticeRef, outbox: readonly PendingLedgerCommand[]): NoticeResolution {
  if(!s) return {state:'login'}
  const notice=buildHomeNotifications(s,outbox,Infinity).find(n=>n.id===noticeKey(ref))
  if(notice){if(ref.kind==='funding'&&!s.expenses.some(e=>e.id===s.funding.find(f=>f.id===ref.id)?.expense_id))return {state:'unavailable'};return {state:'ready',notice,snapshot:s}}
  if(ref.kind==='expense') {const e=s.expenses.find(e=>e.id===ref.id);if(e)return {state:e.status==='active'?'completed':'changed',snapshot:s}}
  if(ref.kind==='change') {const c=s.changes.find(c=>c.id===ref.id);if(c)return {state:c.state==='authoritative'?'completed':'changed',snapshot:s}}
  if(ref.kind==='payment'&&s.payments.some(p=>p.id===ref.id))return {state:'completed',snapshot:s}
  if(ref.kind==='request'&&s.requests.some(p=>p.id===ref.id))return {state:'changed',snapshot:s}
  if(ref.kind==='outbox'&&s.expenses.some(e=>e.clientRequestId===ref.id))return {state:'completed',snapshot:s}
  if(ref.kind==='account'){
    const a=s.accounts.find(a=>a.id===ref.id)
    if(a?.archived)return {state:'changed',snapshot:s}
    // A positive account is a valid details target, not a completed financial task or a new event.
    if(a)return {state:'ready',snapshot:s,notice:{id:noticeKey(ref),ref,intent:'view-account',source:'owner-account',version:`account:${a.attentionRevision??'known'}`,tab:'activity',state:'info',title:'notice.accountDetails',action:'notice.records',description:a.name,date:'',scope:{kind:'personal',spaceId:null},relatedAccountId:a.id,relatedAccountName:a.name}}
  }
  if(ref.kind==='installment'&&s.installments.some(i=>i.id===ref.id&&i.status==='scheduled'))return {state:'changed',snapshot:s}
  return {state:'unavailable'}
}

export function noticeCalendarDate(value:string,timezone:string){
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value
  const date=new Date(value)
  return Number.isNaN(date.getTime())?'':localCalendarDate(date,timezone)
}

/** A visible reference distinguishes even identically named records; actions still use full typed IDs. */
export function noticeReference(notice:HomeNotification,visible:readonly HomeNotification[]){
  for(let length=8;length<notice.ref.id.length;length+=4){const short=notice.ref.id.slice(0,length);if(!visible.some(n=>n.ref.kind===notice.ref.kind&&n.ref.id!==notice.ref.id&&n.ref.id.startsWith(short)))return short}
  return notice.ref.id
}
