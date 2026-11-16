import type {ContraSnapshot} from './tripContra'
import type {CreatorRow} from '../components/CreatorRepaymentForm'
import {parseMajorAmount} from './money'

export type OrderedLine={id:string;value:number;via:number;direct:number;cap:number;remaining:number;upstream:number;downstream:number;error:string}
const key=(a:string,b:string)=>a+':'+b
/** SQL numeric quote parts can contain decimals; never convert them through Number. */
export function nativeQuoteRate(snapshot:ContraSnapshot) {
 const part=(text:string|null)=>{
  if(!text||!/^\d{1,30}(?:\.\d{1,12})?$/.test(text))throw Error('Exchange rate unavailable.')
  const [whole,fraction='']=text.split('.'),n=BigInt(whole+fraction),d=10n**BigInt(fraction.length)
  if(n<=0n)throw Error('Exchange rate unavailable.')
  return{n,d}
 }
 const a=part(snapshot.quote.numerator),b=part(snapshot.quote.denominator)
 return{n:a.n*b.d,d:a.d*b.n}
}
export function nativeQuoteValue(snapshot:ContraSnapshot,amount:number,currency:'MYR'|'VND') {
 if(currency==='VND')return amount
 const rate=nativeQuoteRate(snapshot),numerator=BigInt(amount)*rate.n,denominator=100n*rate.d
 return Number((2n*numerator+denominator)/(2n*denominator))
}
export function viaDisplay(snapshot:ContraSnapshot,amount:number,currency:'MYR'|'VND') {
 if(currency==='VND')return String(amount)
 try{
  const {n,d}=nativeQuoteRate(snapshot),cents=BigInt(amount)*100n*d/n
  return (cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0')
 }catch{return ''}
}
export function orderedRepayments(snapshot:ContraSnapshot,rows:CreatorRow[]) {
 const left=new Map(snapshot.pairs.filter(p=>p.currentMembers&&p.payer&&p.recipient).map(p=>[key(p.payer!,p.recipient!),p.availableMinor]))
 const original=new Map(left),results:OrderedLine[]=[]
 let valid=true
 for(const row of rows){
  const get=(a:string,b:string)=>left.get(key(a,b))??0
  let value=0,via=0,cap=0,direct=0,error=''
  try{
   if(!row.amount.trim())throw Error('Enter the amount actually paid.')
   const amount=parseMajorAmount(row.amount,row.currency)
   if(amount<=0)throw Error('Enter the amount actually paid.')
   if(row.payer===row.recipient||!row.payer||!row.recipient)throw Error('Choose different members.')
   value=nativeQuoteValue(snapshot,amount,row.currency)
   if(!Number.isSafeInteger(value)||value<=0||value>1_000_000_000_000)throw Error('Check the amount and exchange rate.')
   const relevant=snapshot.pairs.filter(p=>p.currentMembers&&[[row.payer,row.recipient],...(row.via?[[row.payer,row.via],[row.via,row.recipient]]:[])].some(([a,b])=>[p.a,p.b].includes(a)&&[p.a,p.b].includes(b)))
   if(relevant.some(p=>p.netMinor===null))throw Error('Exchange rate unavailable.')
   cap=row.via?Math.min(value,get(row.payer,row.via),get(row.via,row.recipient)):0
   via=row.via?(row.viaAmount===''?cap:(row.viaCurrency==='MYR'?/^0+(?:\.0{1,2})?$/:/^0+$/).test(row.viaAmount)?0:nativeQuoteValue(snapshot,parseMajorAmount(row.viaAmount,row.viaCurrency??'VND'),row.viaCurrency??'VND')):0
   if(via>cap||via<0)throw Error('Via amount exceeds this row’s available balance.')
   direct=value-via
   if(direct>get(row.payer,row.recipient))throw Error('Actual payment exceeds the remaining balance.')
   if(!valid)throw Error('Resolve the earlier repayment first.')
   if(via){left.set(key(row.payer,row.via),get(row.payer,row.via)-via);left.set(key(row.via,row.recipient),get(row.via,row.recipient)-via)}
   left.set(key(row.payer,row.recipient),get(row.payer,row.recipient)-direct)
  }catch(cause){error=cause instanceof Error&&cause.message!=='invalid_amount'?cause.message:'Enter a valid actual amount.';valid=false}
  results.push({id:row.id,value,via,direct,cap,remaining:get(row.payer,row.recipient),upstream:get(row.payer,row.via),downstream:get(row.via,row.recipient),error})
 }
 return{results,valid:valid&&rows.length>0,left:valid?left:original}
}
