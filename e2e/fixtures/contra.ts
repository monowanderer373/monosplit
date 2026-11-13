/** Synthetic HTTP fixture only. Real native math is exercised by PostgreSQL tests. */
import {createHash} from 'node:crypto'
import {deriveRelationalDebtLines,type ConfirmedSettlement} from '../../src/lib/relationalBalance'
import {quotePair,systemForeignPerTarget} from '../../src/lib/fxSettlement'
import {autoFxSnapshot} from './autoFx'
import type {CanonicalExpense} from '../../src/types'
import type {ContraSnapshot,ContraPair,ContraDisplay} from '../../src/lib/tripContra'
export function contraFixture(trip:string,expenses:CanonicalExpense[],payments:ConfirmedSettlement[],body:Record<string,unknown>,canRecord=false,missing=false):ContraSnapshot {
 const rawRate=body.rate_mode==='custom'?String(body.vnd_per_myr):'6320',currency=String(body.display_currency??'MYR')
 const fx={...autoFxSnapshot,rates:missing?{}:{...autoFxSnapshot.rates,VND:{...autoFxSnapshot.rates.VND,numerator:'1',denominator:rawRate}}}
 const lines=deriveRelationalDebtLines(expenses,payments,{scope:'space',spaceId:trip})
 const ids=[...new Set(lines.map(l=>[l.debtorParticipantId,l.creditorParticipantId].sort().join(':')))]
 const pairs:ContraPair[]=ids.map(id=>{
  const [a,b]=id.split(':'),own=lines.filter(l=>[a,b].includes(l.debtorParticipantId)&&[a,b].includes(l.creditorParticipantId))
  const native=own.filter(l=>l.remainingMinor>0).map(l=>({from:l.debtorParticipantId,to:l.creditorParticipantId,currency:l.currency,minor:l.remainingMinor}))
  const display=(target:string):ContraDisplay=>{
   const q=quotePair({youOwe:native.filter(l=>l.from===a).map(l=>({currency:l.currency,amountMinor:l.minor})),theyOwe:native.filter(l=>l.to===a).map(l=>({currency:l.currency,amountMinor:l.minor})),target,rateFor:c=>systemForeignPerTarget(c,target,fx),intent:'full'})
   if(!q.ok)return{known:false,currency:target,estimated:true,aOwesB:null,bOwesA:null,contraMinor:null,netMinor:null,payer:null,recipient:null}
   // Original directions remain available in the fixture's native audit.
   const val=(from:string)=>native.filter(l=>l.from===from).reduce((s,l)=>{const p=quotePair({youOwe:[{currency:l.currency,amountMinor:l.minor}],theyOwe:[],target,rateFor:c=>systemForeignPerTarget(c,target,fx),intent:'full'});return s+(p.ok?Number(p.fullMinor):0)},0)
   const forward=val(a),reverse=val(b)
   return{known:true,currency:target,estimated:native.some(l=>l.currency!==target),aOwesB:forward,bOwesA:reverse,contraMinor:Math.min(forward,reverse),netMinor:Number(q.fullMinor),payer:q.direction==='pay'?a:q.direction==='collect'?b:null,recipient:q.direction==='pay'?b:q.direction==='collect'?a:null}
  }
  const ledger=display('MYR'),d=display(currency),pending=payments.some(p=>p.allocations.some(x=>x.state==='pending'&&[a,b].includes(p.debtorParticipantId)&&[a,b].includes(x.creditorParticipantId)))
  return{id,a,b,edgeBasis:'net',nativeBasis:'same_currency_net',native,availableNative:native,audit:native.map(l=>({currency:l.currency,aBills:l.from===a?l.minor:0,bBills:l.from===b?l.minor:0,aApplied:0,bApplied:0})),display:d,grossDisplay:d.known?d:null,ledgerCurrency:'MYR',ledger,netMinor:ledger.netMinor,availableMinor:pending?0:ledger.netMinor??0,payer:ledger.payer,recipient:ledger.recipient,pending,currentMembers:true,sourceVersions:expenses.map(e=>({id:e.id,version:e.version}))}
 })
 return{tripId:trip,viewer:'owner',revision:createHash('sha256').update(JSON.stringify([expenses,payments,body.rate_mode,rawRate,currency])).digest('hex'),edgeBasis:'net',canRecord,quote:{mode:body.rate_mode==='custom'?'custom':'system',snapshotId:fx.id,displayCurrency:currency,numerator:rawRate,denominator:'1',rates:fx.rates},pairs}
}
