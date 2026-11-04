import type { CanonicalExpense } from '../types'
import { deriveExpenseObligations, deriveSettlementAttributions, type ConfirmedSettlement } from './relationalBalance'
import type { MoneyLine } from './fxSettlement'

export type StoredFxRate = {numerator:string;denominator:string;source?:string;provider?:string;rateDate?:string;submittedAt?:string;targetRateDate?:string;targetProvider?:string}
export type StoredFxCoverage = {direction:'payer_owes'|'counterparty_owes';currency:string;covered:number;remaining:number}
export type FxBundle = {id:string;version:number;status:string;payer_participant_id:string;counterparty_participant_id:string;cash_minor:number;full_net_minor:number;target_currency:string;rate_mode:string;created_at:string;quote:{rates?:Record<string,StoredFxRate>;coverages?:StoredFxCoverage[];expenses?:{id:string;version:number}[];legs?:{direction:string;currency:string;remaining:number}[];submittedAt?:string;sourceVersion?:number}}
export type PairPage = {other:string;mode:'summary'|'pay'|'review';bundleId?:string}

/** Reuse the canonical Participant pairing, including Shared Restart, instead of selecting by currency. */
export function pairExpenseSources(expenses:readonly CanonicalExpense[],trip:string,self:string,other:string){
  const byId=new Map(expenses.map(e=>[e.id,e]))
  return deriveExpenseObligations(expenses,{scope:'space',spaceId:trip})
    .filter(row=>row.amountMinor>0&&((row.debtorParticipantId===self&&row.creditorParticipantId===other)||(row.debtorParticipantId===other&&row.creditorParticipantId===self)))
    .map(row=>({...row,expense:byId.get(row.expenseId)!}))
}
export function pairExpenseVersions(expenses:readonly CanonicalExpense[],trip:string,self:string,other:string){
  return [...new Map(pairExpenseSources(expenses,trip,self,other).map(row=>[row.expenseId,{id:row.expenseId,version:row.expense.version}])).values()].sort((a,b)=>a.id.localeCompare(b.id))
}

/** Preview attribution uses the same reader as accepted history. These are not new persisted allocations. */
export function pairCoverageApplications(expenses:readonly CanonicalExpense[],settlements:readonly ConfirmedSettlement[],trip:string,self:string,other:string,coverages:readonly {direction:string;currency:string;coveredMinor:bigint}[]){
  const preview=coverages.filter(c=>c.coveredMinor>0n).map((c,index):ConfirmedSettlement=>({id:'quote:'+index,scope:'space',spaceId:trip,debtorParticipantId:c.direction==='you_owe'?self:other,currency:c.currency,status:'confirmed',paymentDate:'9999-12-31',createdAt:'9999-12-31T00:00:00Z',allocations:[{id:'quote:'+index,creditorParticipantId:c.direction==='you_owe'?other:self,amountMinor:Number(c.coveredMinor),state:'accepted',reversalMinor:0}]}))
  const entries=deriveSettlementAttributions(expenses,[...settlements,...preview],{scope:'space',spaceId:trip}).filter(a=>a.settlementId.startsWith('quote:'))
  return new Map(entries.flatMap(a=>a.applications.map(p=>[p.expenseId,p.amountMinor]as const)))
}
export function pairLines(rows:readonly {debtorParticipantId:string;creditorParticipantId:string;currency:string;remainingMinor:number}[],self:string,other:string){
  const matches=rows.filter(r=>(r.debtorParticipantId===self&&r.creditorParticipantId===other)||(r.debtorParticipantId===other&&r.creditorParticipantId===self))
  const line=(r:typeof matches[number]):MoneyLine=>({currency:r.currency,amountMinor:r.remainingMinor})
  return {youOwe:matches.filter(r=>r.debtorParticipantId===self).map(line),theyOwe:matches.filter(r=>r.creditorParticipantId===self).map(line)}
}
