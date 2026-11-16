import type {ContraSnapshot} from './tripContra'
import type {CreatorRow} from '../components/CreatorRepaymentForm'
import {parseMajorAmount} from './money'

export type OrderedLine={id:string;value:number;via:number;direct:number;cap:number;remaining:number;upstream:number;downstream:number;error:string}
const key=(a:string,b:string)=>a+':'+b
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
   if(row.currency==='VND')value=amount
   else{
    const n=snapshot.quote.numerator,d=snapshot.quote.denominator
    if(!n||!d||BigInt(n)<=0n||BigInt(d)<=0n)throw Error('Exchange rate unavailable.')
    const numerator=BigInt(amount)*BigInt(n),denominator=100n*BigInt(d)
    value=Number((2n*numerator+denominator)/(2n*denominator))
   }
   if(!Number.isSafeInteger(value)||value<=0||value>1_000_000_000_000)throw Error('Check the amount and exchange rate.')
   cap=row.via?Math.min(value,get(row.payer,row.via),get(row.via,row.recipient)):0
   via=row.via?(row.viaAmount===''?cap:/^0+$/.test(row.viaAmount)?0:parseMajorAmount(row.viaAmount,'VND')):0
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
