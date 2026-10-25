import {supabase} from './supabase'
import type {CanonicalExpense} from '../types'
import type {HomeJournalEntry} from './homeView'
export type PersonalPeriod={id:string;started_at:string;ended_at:string|null;status:'active'|'archived'}
export type PeriodState={available:boolean;ownerId:string|null;periods:PersonalPeriod[];archivedExpenseIds:string[];archivedTransactionIds:string[];laterFunding:HomeJournalEntry[]}
export const NO_PERIOD_CAPABILITY:PeriodState={available:false,ownerId:null,periods:[],archivedExpenseIds:[],archivedTransactionIds:[],laterFunding:[]}
export type FreshAccount={account_id:string;parent_id:string;name:string;currency:string;known:boolean;balance_minor:string;version:number;parent_version:number}
export type FreshPreview={schema_version:1;id:string;owner_id:string;expires_at:string;fingerprint:string;accounts:FreshAccount[];currencies:{currency:string;amount_minor:string}[];personal_count:number;protected_shared_count:number;protected_settlement_count:number;pending_funding_count:number;ongoing_installment_count:number;recurring_rule_count:number;policy:'carry_all';conflicts:string[]}
export type FreshCommand={requestId:string;previewId:string;openings:{account_id:string;amount_minor:string}[]}
export type FreshReceipt={schema_version:1;owner_id:string;request_id:string;period_id:string;archived_period_id:string;completed_at:string;policy:'carry_all'}
export type ArchiveExpense={id:string;description:string|null;category:string;occurred_on:string;currency:string;total_minor:string;status:string;corrects_expense_id:string|null}
export type PersonalArchive={schema_version:1;period:PersonalPeriod;expenses:ArchiveExpense[];transactions:{id:string;account_id:string;account_name:string;kind:string;occurred_on:string;memo:string|null;currency:string;amount_minor:string}[];openings:{account_id:string;currency:string;amount_minor:string}[]}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_period_response');return value as Record<string,unknown>}
function strings(value:unknown):string[]{if(!Array.isArray(value)||value.some(v=>typeof v!=='string'))throw new Error('invalid_period_response');return value}
function integer(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error('invalid_period_response');return value}
function minor(value:unknown):number{if(typeof value!=='string'||! /^-?\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('invalid_period_response');return Number(value)}
function text(value:unknown):string{if(typeof value!=='string'||!value)throw new Error('invalid_period_response');return value}
async function rpc(name:string,args?:Record<string,unknown>):Promise<unknown>{if(!supabase)throw new Error('not_configured');const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
export function parsePeriodState(raw:unknown,ownerId:string):PeriodState{
 const r=object(raw);if(r.schema_version!==1||r.owner_id!==ownerId||!Array.isArray(r.periods)||!Array.isArray(r.later_funding))throw new Error('invalid_period_response')
 const periods=r.periods.map(value=>{const p=object(value);if(!['active','archived'].includes(String(p.status))||!Number.isFinite(Date.parse(text(p.started_at)))||p.ended_at!==null&&!Number.isFinite(Date.parse(text(p.ended_at))))throw new Error('invalid_period_response');return{id:text(p.id),started_at:text(p.started_at),ended_at:p.ended_at as string|null,status:p.status as PersonalPeriod['status']}})
 if(periods.filter(p=>p.status==='active').length>1)throw new Error('invalid_period_response')
 const laterFunding=r.later_funding.map(value=>{const j=object(value);return{id:text(j.id),kind:'expense_funding' as const,accountId:text(j.account_id),accountName:text(j.account_name),expenseId:text(j.expense_id),occurredOn:text(j.occurred_on),createdAt:text(j.created_at),currency:text(j.currency),amountMinor:minor(j.amount_minor),memo:typeof j.memo==='string'?j.memo:null}})
 return{available:true,ownerId,periods,archivedExpenseIds:strings(r.archived_expense_ids),archivedTransactionIds:strings(r.archived_transaction_ids),laterFunding}
}
export async function loadPersonalPeriods(ownerId:string):Promise<PeriodState>{
 try{return parsePeriodState(await rpc('get_personal_ledger_period_state'),ownerId)}catch(error){
  // Explicit server capability absence keeps the pre-period client behavior;
  // every reset/Archive action remains unavailable. Other errors fail closed.
  if((error as {code?:string})?.code==='PGRST202')return NO_PERIOD_CAPABILITY
  throw error
 }
}
export function activePersonalExpenses(expenses:readonly CanonicalExpense[],state:PeriodState|null|undefined):CanonicalExpense[]{
 if(!state?.available)return [...expenses]
 const archived=new Set(state.archivedExpenseIds)
 return expenses.filter(e=>e.scope!=='personal'||!archived.has(e.id))
}
export function activePeriodJournals(journals:readonly HomeJournalEntry[],state:PeriodState|null|undefined):HomeJournalEntry[]{
 if(!state?.available)return [...journals]
 const old=new Set(state.archivedTransactionIds),seen=new Set<string>()
 return [...journals.filter(j=>!old.has(j.id)),...state.laterFunding].filter(j=>{const key=j.id+':'+j.accountId;if(seen.has(key))return false;seen.add(key);return true})
}
export function parseFreshPreview(raw:unknown,ownerId:string):FreshPreview{
 const p=object(raw);if(p.schema_version!==1||p.owner_id!==ownerId||p.policy!=='carry_all'||!Array.isArray(p.accounts)||!Array.isArray(p.currencies))throw new Error('invalid_period_response')
 text(p.id);text(p.fingerprint);if(!Number.isFinite(Date.parse(text(p.expires_at))))throw new Error('invalid_period_response');strings(p.conflicts)
 for(const k of ['personal_count','protected_shared_count','protected_settlement_count','pending_funding_count','ongoing_installment_count','recurring_rule_count'])integer(p[k])
 for(const a of p.accounts){const r=object(a);text(r.account_id);text(r.parent_id);text(r.name);text(r.currency);minor(r.balance_minor);if(typeof r.known!=='boolean'||integer(r.version)<1||integer(r.parent_version)<1)throw new Error('invalid_period_response')}
 if(new Set(p.accounts.map(v=>object(v).account_id)).size!==p.accounts.length)throw new Error('invalid_period_response')
 for(const v of p.currencies){const r=object(v);text(r.currency);minor(r.amount_minor)}
 return p as unknown as FreshPreview
}
export async function previewPersonalFreshStart(ownerId:string):Promise<FreshPreview>{return parseFreshPreview(await rpc('preview_personal_fresh_start'),ownerId)}
export async function getFreshPreview(id:string,ownerId:string):Promise<FreshPreview>{return parseFreshPreview(await rpc('get_personal_fresh_start_preview',{p_preview_id:id}),ownerId)}
export function parseFreshReceipt(raw:unknown,ownerId:string,requestId:string):FreshReceipt{const r=object(raw);if(r.schema_version!==1||r.owner_id!==ownerId||r.request_id!==requestId||r.policy!=='carry_all')throw new Error('invalid_period_response');text(r.period_id);text(r.archived_period_id);text(r.completed_at);return r as unknown as FreshReceipt}
export async function applyPersonalFreshStart(command:FreshCommand,ownerId:string):Promise<FreshReceipt>{return parseFreshReceipt(await rpc('apply_personal_fresh_start',{p_request_id:command.requestId,p_preview_id:command.previewId,p_openings:command.openings}),ownerId,command.requestId)}
export async function reconcileFreshStart(requestId:string,ownerId:string):Promise<FreshReceipt|null>{const r=object(await rpc('reconcile_personal_fresh_start',{p_request_id:requestId}));if(r.state==='committed')return parseFreshReceipt(r.result,ownerId,requestId);if(r.state==='fenced')return null;throw new Error('invalid_period_response')}
export async function loadPersonalArchive(periodId:string):Promise<PersonalArchive>{const r=object(await rpc('get_personal_ledger_archive',{p_period_id:periodId}));if(r.schema_version!==1||object(r.period).id!==periodId||!Array.isArray(r.expenses)||!Array.isArray(r.transactions)||!Array.isArray(r.openings))throw new Error('invalid_period_response');for(const raw of [...r.expenses,...r.transactions,...r.openings]){const v=object(raw);minor(v.total_minor??v.amount_minor);text(v.currency)}return r as unknown as PersonalArchive}
