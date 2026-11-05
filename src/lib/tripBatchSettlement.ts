import { convertMinor, customForeignPerTarget, quotePair, systemForeignPerTarget, type MoneyLine } from './fxSettlement'
import type { FxSnapshot, Fraction } from './fx'
import { parseMajorAmount } from './money'
import type { StoredFxCoverage, StoredFxRate } from './pairSettlement'

export type BatchCandidate={id:string;name:string;youOwe:MoneyLine[];theyOwe:MoneyLine[];blocked?:string}
export type BatchCash={currency:'MYR'|'VND';amountMinor:number}
export type BatchChild={participantId:string;cashLegs:BatchCash[];cash_minor:number;full_net_minor:number;intent:'full'|'partial';coverages:StoredFxCoverage[];rates:Record<string,StoredFxRate>;cashRate?:StoredFxRate|null;expenses:{id:string;version:number}[];rounding?:{numerator:string;denominator:string;unit:string}|null}
export type BatchReview={quoteId:string;expiresAt:string;snapshotId:string|null;rateMode:'system'|'custom';children:BatchChild[]}
export type BatchReceipt={batchId:string;status:string;children:{bundleId:string;participantId:string;status:string;cashLegs:BatchCash[]}[]}
export type BatchDraft={selected:boolean;myr:string;vnd:string}

export function batchRate(code:string,mode:'system'|'custom',custom:string,snapshot:FxSnapshot):Fraction|null{
 if(code==='VND'&&mode==='custom'){if(!/^[0-9]{1,12}(?:\.[0-9]{1,12})?$/.test(custom))throw new Error('invalid_rate');return customForeignPerTarget(custom)}
 return systemForeignPerTarget(code,'MYR',snapshot)
}
export function batchCash(raw:string,currency:'MYR'|'VND'){
 if(raw.trim()==='')return 0
 if(!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(raw)||currency==='VND'&&!/^[0-9]+$/.test(raw))throw new Error('invalid_amount')
 if(/^0+(?:\.0{1,2})?$/.test(raw))return 0
 const minor=parseMajorAmount(raw,currency)
 if(!Number.isSafeInteger(minor)||minor<0)throw new Error('invalid_amount')
 return minor
}
/** Reference value only. Actual MYR and VND amounts remain separate in cash legs. */
export function batchPairPreview(candidate:BatchCandidate,draft:BatchDraft,mixed:boolean,rateFor:(code:string)=>Fraction|null){
 const myr=batchCash(draft.myr,'MYR'),vnd=mixed?batchCash(draft.vnd,'VND'):0
 const cash=BigInt(myr)+(vnd?convertMinor(BigInt(vnd),'VND','MYR',rateFor('VND')??(()=>{throw new Error('fx_rate_unavailable')})()):0n)
 const full=quotePair({...candidate,target:'MYR',rateFor,intent:'full'})
 if(!full.ok||full.direction!=='pay')throw new Error(full.ok?'not_net_payer':'fx_rate_unavailable')
 if(cash<=0n||cash>full.fullMinor)throw new Error('invalid_amount')
 const quote=cash===full.fullMinor?full:quotePair({...candidate,target:'MYR',rateFor,intent:'partial',cashMinor:cash})
 if(!quote.ok)throw new Error('invalid_amount')
 return {cash,full:full.fullMinor,remaining:full.fullMinor-cash,quote,cashLegs:[...(myr?[{currency:'MYR' as const,amountMinor:myr}]:[]),...(vnd?[{currency:'VND' as const,amountMinor:vnd}]:[])]}
}
const recoveryKey=(actor:string,trip:string)=>`tabby:trip-batch:pending:${actor}:${trip}`
export type BatchRecovery={requestId:string;quoteId:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function readBatchRecovery(actor:string,trip:string):BatchRecovery|null{
 try{const raw=localStorage.getItem(recoveryKey(actor,trip));if(!raw)return null;const r=JSON.parse(raw);return uuid.test(r.requestId)&&uuid.test(r.quoteId)?{requestId:r.requestId,quoteId:r.quoteId}:null}catch{return null}
}
export function saveBatchRecovery(actor:string,trip:string,recovery:BatchRecovery){
 localStorage.setItem(recoveryKey(actor,trip),JSON.stringify(recovery))
 const stored=readBatchRecovery(actor,trip)
 if(stored?.requestId!==recovery.requestId||stored.quoteId!==recovery.quoteId)throw new Error('recovery_unavailable')
}
export function clearBatchRecovery(actor:string,trip:string){localStorage.removeItem(recoveryKey(actor,trip))}
export function nativeBatchTotals(children:readonly {cashLegs:readonly BatchCash[]}[]){
 const result={MYR:0n,VND:0n}
 for(const child of children)for(const leg of child.cashLegs)result[leg.currency]+=BigInt(leg.amountMinor)
 return result
}
