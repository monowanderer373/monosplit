import {supabase} from './supabase'
import {ledgerRepository} from './ledgerRepository'
import {expenseChangeRepository} from './expenseChangeRepository'
import {settlementRepository} from './settlementRepository'
import {readAllPages} from './personalAccountReadRepository'
import type {NoticeRow,NoticeSnapshot} from './homeNotifications'
import { loadCurrencyAccounts, loadFundingMetadata } from './multicurrencyRepository'
async function rows(table:string,columns:string):Promise<NoticeRow[]> {
  if(!supabase)throw new Error('not_configured')
  const client=supabase
  return readAllPages(async(from,to)=>{
    const r=await client.from(table).select(columns).order('id').range(from,to)
    if(r.error)throw r.error
    return (r.data??[]) as unknown as NoticeRow[]
  })
}
async function readSnapshot(owner:string):Promise<NoticeSnapshot> {
  const [accounts,expenses,changes,payments,funding,recurring,rules,installments,plans,requests,money]=await Promise.all([
    loadCurrencyAccounts(),ledgerRepository.listExpenses(),expenseChangeRepository.listDirectChanges(),settlementRepository.listSettlements(),
    rows('personal_funding_intents','id,status,version,updated_at,expense_id,account_id,account_amount_minor,expense_amount_minor,expense_currency,account_currency'),
    rows('personal_recurring_occurrences','id,status,version,updated_at,rule_id,scheduled_for,expense_id,funding_intent_id,error_code,effective_amount_minor,effective_currency,effective_account_id,effective_occurred_on'),
    rows('personal_recurring_rules','id,title,funding_account_id,amount_minor,currency,cadence'),
    rows('personal_installments','id,status,version,updated_at,plan_id,sequence,due_on,repayment_account_id,error_code,principal_minor,asset_payment_minor'),
    rows('personal_installment_plans','id,purchase_expense_id,funding_intent_id,currency,installment_count'),
    rows('settlement_payment_requests','id,status,version,created_at,updated_at,note,debtor_participant_id,creditor_participant_id,scope,space_id'),
    loadFundingMetadata(),
  ])
  return {owner,accounts,expenses,changes,payments,funding,recurring,rules,installments,plans,requests,money}
}
export async function notificationRpc(name:string,args:Record<string,unknown>,identity:string,guard:()=>void){
  if(!supabase)throw new Error('not_configured')
  const {data:auth,error:authError}=await supabase.auth.getSession()
  guard()
  if(authError||!auth.session||auth.session.user.id!==identity)throw new Error('notification_context_changed')
  // Freeze the normal authenticated actor for this one dispatch, even if the shared client later switches identity.
  const {data,error}=await supabase.rpc(name,args).setHeader('Authorization',`Bearer ${auth.session.access_token}`)
  if(error)throw error
  return data
}

export function noticeQueryFailure(cause:unknown):{state:'login'|'retry'}{
  const e=cause as {status?:number;code?:string}|null
  return {state:e?.status===401||['PGRST301','PGRST303'].includes(e?.code??'')?'login':'retry'}
}
export async function loadNotificationSnapshot(owner:string):Promise<NoticeSnapshot>{
  let timer:ReturnType<typeof setTimeout>|undefined
  try{return await Promise.race([readSnapshot(owner),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('notification_timeout')),20_000)})])}
  finally{if(timer)clearTimeout(timer)}
}

export type NotificationAccountEntry={id:string;transactionId?:string;expenseId?:string|null;reversesTransactionId?:string|null;movementId?:string;amountMinor:number;currency:string;date:string;description:string|null;kind:string}
export async function loadNotificationAccountEntries(accountId:string):Promise<NotificationAccountEntry[]>{
 if(!supabase)throw new Error('not_configured')
 const client=supabase
 const entries=await readAllPages(async(from,to)=>{
  const {data,error}=await client.from('personal_account_entries').select('id,amount_minor,currency,transaction:personal_account_transactions!transaction_id(id,expense_id,reverses_transaction_id,kind,occurred_on,memo)').eq('account_id',accountId).order('id').range(from,to)
  if(error)throw error
  return data??[]
 })
 return entries.map(row=>{
  const transaction=Array.isArray(row.transaction)?row.transaction[0]:row.transaction,amount=Number(row.amount_minor)
  if(!Number.isSafeInteger(amount)||!transaction)throw new Error('amount_unavailable')
  return {id:row.id,transactionId:transaction.id,expenseId:transaction.expense_id,reversesTransactionId:transaction.reverses_transaction_id,amountMinor:amount,currency:row.currency,date:transaction.occurred_on,description:transaction.memo,kind:transaction.kind}
 }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
}
