import {supabase} from './supabase'
import type {MoneyLine} from './fxSettlement'
import type {RoutedDraft} from './routedSettlement'

export type ContraDisplay = {
  known: boolean; currency: string; estimated: boolean
  aOwesB: number | null; bOwesA: number | null; contraMinor: number | null; netMinor: number | null
  payer: string | null; recipient: string | null
}
export type ContraNative={from:string;to:string;currency:string;minor:number}
export type ContraAudit={currency:string;aBills:number;bBills:number;aApplied:number;bApplied:number}
export type ContraPair = {
  id: string; a: string; b: string; edgeBasis: 'net'; nativeBasis: 'same_currency_net'
  native: ContraNative[]; availableNative: ContraNative[]; audit:ContraAudit[]; display: ContraDisplay; grossDisplay: ContraDisplay|null
  netMinor: number | null; availableMinor: number; payer: string | null; recipient: string | null
  ledgerCurrency:'MYR'; ledger:ContraDisplay; pending:boolean; currentMembers: boolean; sourceVersions: {id:string;version:number}[]
}
export type ContraSnapshot = {
  tripId: string; viewer: string; revision: string; edgeBasis: 'net'; canRecord: boolean
  quote: {mode:'system'|'custom'; snapshotId:string|null; displayCurrency:string; numerator:string|null; denominator:string|null; rates:Record<string,{numerator:string;denominator:string;provider?:string;rateDate?:string}>}
  pairs: ContraPair[]
}
const safe = (n:unknown):n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0

/** A net DTO is validated, never contra'd a second time by the client. */
export function validateContraSnapshot(value:unknown, trip:string, viewer:string):ContraSnapshot {
  const s=value as ContraSnapshot
  if(!s || s.tripId!==trip || s.viewer!==viewer || s.edgeBasis!=='net' || !/^[a-f0-9]{64}$/.test(s.revision)
    || !Array.isArray(s.pairs) || typeof s.canRecord!=='boolean' || !s.quote || !['system','custom'].includes(s.quote.mode)
    || typeof s.quote.displayCurrency!=='string' || !s.quote.rates) throw new Error('invalid_contra_snapshot')
  const ids=new Set<string>()
  for(const p of s.pairs) {
    const d=p.display
    if(!p.a || !p.b || p.a>=p.b || p.id!==p.a+':'+p.b || ids.has(p.id) || p.edgeBasis!=='net'
      || p.nativeBasis!=='same_currency_net' || !Array.isArray(p.native) || !Array.isArray(p.availableNative)
      || !safe(p.availableMinor) || p.netMinor!==null&&!safe(p.netMinor) || !d || d.currency!==s.quote.displayCurrency
      || typeof d.known!=='boolean' || typeof d.estimated!=='boolean' || typeof p.currentMembers!=='boolean'
      || p.ledgerCurrency!=='MYR' || !p.ledger || p.ledger.currency!=='MYR' || typeof p.pending!=='boolean' || !Array.isArray(p.sourceVersions) || !Array.isArray(p.audit)) throw new Error('invalid_contra_snapshot')
    ids.add(p.id)
    const currencies=new Set<string>()
    for(const leg of p.native) {
      if(!safe(leg.minor) || leg.from===leg.to || ![p.a,p.b].includes(leg.from) || ![p.a,p.b].includes(leg.to)
        || !/^[A-Z]{3}$/.test(leg.currency) || currencies.has(leg.currency)) throw new Error('invalid_contra_snapshot')
      currencies.add(leg.currency)
    }
    if(p.grossDisplay && (p.grossDisplay.currency!==d.currency || !p.grossDisplay.known || !d.known || p.grossDisplay.netMinor!==d.netMinor || p.grossDisplay.payer!==d.payer || p.grossDisplay.recipient!==d.recipient))throw new Error('invalid_contra_snapshot')
    for(const d of [p.display,p.ledger,...(p.grossDisplay?[p.grossDisplay]:[])]) {
     if(!/^[A-Z]{3}$/.test(d.currency)||typeof d.known!=='boolean'||typeof d.estimated!=='boolean')throw new Error('invalid_contra_snapshot')
     if(!d.known){if([d.aOwesB,d.bOwesA,d.netMinor,d.contraMinor,d.payer,d.recipient].some(v=>v!==null))throw new Error('invalid_contra_snapshot');continue}
      if(!safe(d.aOwesB)||!safe(d.bOwesA)||!safe(d.netMinor)||!safe(d.contraMinor)
        || d.contraMinor!==Math.min(d.aOwesB,d.bOwesA) || d.netMinor!==Math.abs(d.aOwesB-d.bOwesA)
        || d.payer!==(d.netMinor?(d.aOwesB>d.bOwesA?p.a:p.b):null)
        || d.recipient!==(d.netMinor?(d.aOwesB>d.bOwesA?p.b:p.a):null)) throw new Error('invalid_contra_snapshot')
    }
    if(p.netMinor!==p.ledger.netMinor||p.payer!==p.ledger.payer||p.recipient!==p.ledger.recipient||p.pending&&p.availableMinor!==0||!p.currentMembers&&p.availableMinor!==0)throw new Error('invalid_contra_snapshot')
    const availableCodes=new Set<string>()
    for(const leg of p.availableNative){const original=p.native.find(n=>n.currency===leg.currency&&n.from===leg.from&&n.to===leg.to);if(!original||!safe(leg.minor)||leg.minor>original.minor||availableCodes.has(leg.currency))throw new Error('invalid_contra_snapshot');availableCodes.add(leg.currency)}
    if(availableCodes.size!==currencies.size)throw new Error('invalid_contra_snapshot')
    for(const row of p.audit)if(!/^[A-Z]{3}$/.test(row.currency)||![row.aBills,row.bBills,row.aApplied,row.bApplied].every(safe))throw new Error('invalid_contra_snapshot')
    if(p.sourceVersions.some(v=>!v.id||!Number.isSafeInteger(v.version)||v.version<1))throw new Error('invalid_contra_snapshot')
    if(p.netMinor===0&&(p.payer!==null||p.recipient!==null) || p.netMinor!==null&&p.netMinor>0
      &&(![p.a,p.b].includes(p.payer??'')||![p.a,p.b].includes(p.recipient??'')||p.payer===p.recipient)
      || p.netMinor!==null&&p.availableMinor>p.netMinor) throw new Error('invalid_contra_snapshot')
  }
  return s
}
export function contraLines(pair:ContraPair,self:string):{youOwe:MoneyLine[];theyOwe:MoneyLine[]} {
  return {youOwe:pair.native.filter(l=>l.from===self).map(l=>({currency:l.currency,amountMinor:l.minor})),
    theyOwe:pair.native.filter(l=>l.to===self).map(l=>({currency:l.currency,amountMinor:l.minor}))}
}
export function contraTotals(snapshot:ContraSnapshot,self:string) {
  let pay=0n,collect=0n,known=true
  for(const pair of snapshot.pairs.filter(p=>[p.a,p.b].includes(self))) {
    const d=pair.display
    if(!d.known){known=false;continue}
    if(d.payer===self)pay+=BigInt(d.netMinor!);if(d.recipient===self)collect+=BigInt(d.netMinor!)
  }
  return {pay,collect,known}
}
export function contraChoice(pair:ContraPair) {
  if(!pair.payer||!pair.recipient||!pair.netMinor)return null
  const native=pair.native.filter(l=>l.from===pair.payer&&l.minor>0)
  const currency=native.some(l=>l.currency==='VND')?'VND':'MYR'
  return {payer:pair.payer,recipient:pair.recipient,currency:currency as 'MYR'|'VND'}
}
export function contraDraft(snapshot:ContraSnapshot):Pick<RoutedDraft,'edgeBasis'|'contraSnapshot'> {
  return {edgeBasis:'net',contraSnapshot:{revision:snapshot.revision,displayCurrency:snapshot.quote.displayCurrency}}
}
export async function readTripContra(identity:string,actor:string,trip:string,mode:'system'|'custom',rate:string,displayCurrency:string) {
  if(!supabase)throw new Error('not_configured')
  const {data,error}=await supabase.auth.getSession()
  if(error||!data.session||data.session.user.id!==identity)throw new Error('creator_context_changed')
  const result=await supabase.rpc('read_trip_contra_snapshot',{target_space_id:trip,rate_mode:mode,vnd_per_myr:mode==='custom'?rate:null,display_currency:displayCurrency})
    .setHeader('Authorization','Bearer '+data.session.access_token)
  if(result.error)throw new Error(result.error.message)
  return validateContraSnapshot(result.data,trip,actor)
}
