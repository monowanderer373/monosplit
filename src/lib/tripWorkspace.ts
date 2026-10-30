import type {SpaceWithRole} from './spaceRepository'
import {validTripPeriod,tripPeriodStatus} from './tripPeriod'
import {addMinor} from './homeView'
import {derivePersonalLedgerRows} from './ledgerSummary'
import {deriveSettlementHistoryEntries} from './financialHistory'
import {tripAuthoritativeExpenses,tripCurrentPayments,tripVisibleExpenses} from './tripLedger'
import {buildTripRecap} from './insights'
import type {CanonicalExpense} from '../types'
import type {SettlementPayment} from './settlementRepository'

export function accessibleWorkspaceTrips(entries:readonly SpaceWithRole[]) {
  return [...new Map(entries.filter(e=>e.space.type==='trip'&&e.space.status!=='voided'&&['owner','full_access','view'].includes(e.role)).map(e=>[e.space.id,e])).values()]
}
export function runningWorkspaceTrips(entries:readonly SpaceWithRole[],today:string) {
  return accessibleWorkspaceTrips(entries).filter(({space:s})=>s.status==='active'&&!!s.startDate&&!!s.endDate&&validTripPeriod({startDate:s.startDate,endDate:s.endDate,datesLater:false})&&s.startDate<=today&&today<=s.endDate)
}
export function selectWorkspaceTrip(entries:readonly SpaceWithRole[],today:string,preferred?:string|null) {
  const trips=accessibleWorkspaceTrips(entries),selected=trips.find(e=>e.space.id===preferred)
  if(selected)return selected
  const running=runningWorkspaceTrips(trips,today);if(running.length)return running[0]
  return trips.slice().sort((a,b)=>{
    const rank=(e:SpaceWithRole)=>tripPeriodStatus(e.space,today)==='upcoming'?0:tripPeriodStatus(e.space,today)==='ended'?1:2
    const r=rank(a)-rank(b);if(r)return r
    if(rank(a)===0)return (a.space.startDate??'').localeCompare(b.space.startDate??'')||a.space.id.localeCompare(b.space.id)
    return (b.space.endDate??b.space.updatedAt).localeCompare(a.space.endDate??a.space.updatedAt)||a.space.id.localeCompare(b.space.id)
  })[0]??null
}
/** Display projection of the existing personal shares and recap, never a new ledger. */
export function tripWorkspaceSpending(expenses:readonly CanonicalExpense[],trip:string,self:string) {
  const visible=tripAuthoritativeExpenses(tripVisibleExpenses(expenses,trip)),totals=new Map<string,number>()
  for(const row of derivePersonalLedgerRows(visible,self))totals.set(row.expense.currency,addMinor(totals.get(row.expense.currency)??0,row.personalSpendingMinor))
  return {count:visible.length,spending:[...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,amountMinor])=>({currency,amountMinor})),total:buildTripRecap(visible).currencies}
}
/** Only accepted, still-effective self transfers; zero debt is not repayment proof. */
export function tripConfirmedTransfers(payments:readonly SettlementPayment[],trip:string,self:string) {
  return deriveSettlementHistoryEntries(tripCurrentPayments(payments,trip),[]).flatMap(({settlement:p,allocation:a})=>{
    if(a.state!=='accepted'||a.sharedRestartCleared||p.debtorParticipantId!==self&&a.creditorParticipantId!==self)return []
    const effective=addMinor(a.amountMinor,-a.reversalMinor)
    return effective>0?[{id:a.id,currency:p.currency,amountMinor:effective,kind:p.debtorParticipantId===self?'repaid' as const:'received' as const,partialReversal:a.reversalMinor>0,date:p.paymentDate}]:[]
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
}
