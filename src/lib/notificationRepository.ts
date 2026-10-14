import {supabase} from './supabase'
import {ledgerRepository} from './ledgerRepository'
import {expenseChangeRepository} from './expenseChangeRepository'
import {settlementRepository} from './settlementRepository'
import {loadPersonalAccountHome,readAllPages} from './personalAccountReadRepository'
import type {NoticeRow,NoticeSnapshot} from './homeNotifications'
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
  const [home,expenses,changes,payments,funding,recurring,rules,installments,plans,requests]=await Promise.all([
    loadPersonalAccountHome(),ledgerRepository.listExpenses(),expenseChangeRepository.listDirectChanges(),settlementRepository.listSettlements(),
    rows('personal_funding_intents','id,status,version,updated_at,expense_id,account_id,account_amount_minor,expense_amount_minor,expense_currency,account_currency'),
    rows('personal_recurring_occurrences','id,status,version,updated_at,rule_id,scheduled_for,expense_id,funding_intent_id,error_code,effective_amount_minor,effective_currency,effective_account_id'),
    rows('personal_recurring_rules','id,title,funding_account_id,amount_minor,currency'),
    rows('personal_installments','id,status,version,updated_at,plan_id,due_on,repayment_account_id,error_code,principal_minor,asset_payment_minor'),
    rows('personal_installment_plans','id,purchase_expense_id,funding_intent_id,currency'),
    rows('settlement_payment_requests','id,status,version,created_at,debtor_participant_id,creditor_participant_id,scope,space_id'),
  ])
  return {owner,accounts:home.accounts,expenses,changes,payments,funding,recurring,rules,installments,plans,requests}
}
export async function notificationRpc(name:string,args:Record<string,unknown>){
  if(!supabase)throw new Error('not_configured')
  const {data,error}=await supabase.rpc(name,args)
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
