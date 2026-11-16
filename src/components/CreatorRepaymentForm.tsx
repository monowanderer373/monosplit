import {useState,type ReactNode} from 'react'
import {contraTotals}from'../lib/tripContra'
import {MemberBalanceBoard}from'./MemberBalanceBoard'
import {orderedRepayments,viaDisplay,nativeQuoteRate}from'../lib/orderedRepayments'
import {useStore} from '../store/useStore'
import {ct} from '../lib/creatorTexts'
import {rt, routedMoney} from '../lib/routedSettlement'
import type {CreatorPerson} from '../lib/creatorSettlement'
import type {ContraSnapshot,ContraPair}from'../lib/tripContra'
import {CreatorMemberPairPicker} from './CreatorMemberPairPicker'
import {CreatorMemberPicker} from './CreatorMemberPicker'
import {RoutedAvatar} from './RoutedSettlementMap'
import AmountInput from './AmountInput'

export type CreatorRow = {id:string; full?:boolean; viaCurrency?:'MYR'|'VND'; payer:string; recipient:string; amount:string; currency:'MYR'|'VND'; method:'cash'|'bank_transfer'; via:string; viaAmount:string}

export function CreatorRepaymentChooser({people,snapshot,onChoose,disabled}:{people:CreatorPerson[];snapshot:ContraSnapshot;onChoose:(pair:ContraPair,recipient?:string)=>void;disabled:boolean}) {
 const lang=useStore(s=>s.lang),f=(en:string,zh:string)=>lang==='zh'?zh:en
 const[board,setBoard]=useState(false),totals=contraTotals(snapshot,snapshot.viewer)
 const choices=snapshot.pairs.filter(p=>p.currentMembers&&[p.a,p.b].includes(snapshot.viewer)).map(pair=>({pair,direction:pair.display.known?pair.display:pair.ledger})).filter(({direction:d})=>d.netMinor!==null&&d.netMinor>0&&d.payer&&d.recipient&&people.some(v=>v.id===d.payer)&&people.some(v=>v.id===d.recipient))
 const recipients=[...new Set(choices.map(p=>p.direction.recipient!))]
 return <div className="tt-c-choices" data-contra-revision={snapshot.revision}>
  <div className="tt-final-totals"><div>{f('To pay','待付')}<strong>{totals.known?routedMoney(totals.pay,snapshot.quote.displayCurrency):'—'}</strong></div><div>{f('To collect','待收')}<strong>{totals.known?routedMoney(totals.collect,snapshot.quote.displayCurrency):'—'}</strong></div></div><button type="button" onClick={()=>setBoard(!board)}>{f('Member balances','成员往来')}</button>{board?<MemberBalanceBoard snapshot={snapshot} people={people} onChoose={onChoose} disabled={disabled}/>:null}
  {recipients.map(id=><section className="tt-c-debt-list" key={id}><h3>{ct(lang,'owedTo')} {people.find(p=>p.id===id)!.name}</h3>
   {choices.filter(p=>p.direction.recipient===id).map(({pair,direction})=>{const person=people.find(p=>p.id===direction.payer)!,d=pair.display;return <button type="button" disabled={disabled||pair.availableMinor<=0} key={pair.id} onClick={()=>onChoose(pair)}>
    <RoutedAvatar person={person}/><span>{person.name}</span><strong>{d.known?(d.estimated?'≈ ':'')+routedMoney(d.netMinor!,d.currency):'—'}</strong><span aria-hidden="true">›</span>
   </button>})}
  </section>)}
  {!choices.length?<p className="tt-r-muted">{ct(lang,'noChoices')}</p>:null}
  <p className="tt-r-muted">{ct(lang,'contraChoices')}</p>
 </div>
}

export function CreatorRepaymentForm({rows, people, disabled, actor, edit, remove, ownControl, rateControl, snapshot,activeId,onActive}: {
  rows: CreatorRow[]
  people: CreatorPerson[]
  disabled: boolean
  actor: string
  edit: (id: string, patch: Partial<CreatorRow>) => void
  remove: (id: string) => void
  ownControl: (id: string, currency: string) => ReactNode
  activeId?:string
  onActive?:(id:string)=>void
  snapshot?: ContraSnapshot
  rateControl: ReactNode
}) {
  const lang = useStore(s => s.lang),f=(en:string,zh:string)=>lang==='zh'?zh:en
  const plan=snapshot&&rows.some(row=>row.amount)?orderedRepayments(snapshot,rows):null
  const[fullError,setFullError]=useState('')
  const selected=rows.some(row=>row.id===activeId)?activeId:rows.at(-1)?.id
  const r = (key: Parameters<typeof rt>[1]) => rt(lang,key)
  return <>
    {fullError?<p role="alert">{fullError}</p>:null}
    {rows.length>1?<nav className="tt-final-row-tabs" aria-label="Repayments">{rows.map((row,index)=><button type="button" disabled={disabled} key={row.id} aria-pressed={row.id===selected} onClick={()=>onActive?.(row.id)}>{index+1} · {people.find(p=>p.id===row.payer)?.name??"—"}</button>)}</nav>:null}
    {rows.map((row,index) => <fieldset hidden={row.id!==selected} key={row.id} disabled={disabled} className="tt-c-repayment" data-row-id={row.id}>
      {rows.length > 1 ? <legend>{r('payment')} {index+1}</legend> : null}
      <CreatorMemberPairPicker payer={row.payer} recipient={row.recipient} people={people} index={index+1}
        onChange={(side,id) => edit(row.id,{[side]:id,via:row.via===id?'':row.via,viaAmount:row.via===id?'':row.viaAmount})}/>
      <div className="tt-final-mode"><button type="button" aria-pressed={!row.full} onClick={()=>{setFullError('');edit(row.id,{full:false})}}>{f('Partial','部分')}</button><button type="button" aria-pressed={!!row.full} disabled={!snapshot} onClick={()=>{setFullError('');if(!snapshot)return;const prior=orderedRepayments(snapshot,rows.slice(0,index));if(index&&!prior.valid)return;const left=prior.left,get=(a:string,b:string)=>left.get(a+':'+b)??0;const cap=get(row.payer,row.recipient)+(row.via?Math.min(get(row.payer,row.via),get(row.via,row.recipient)):0);if(row.currency==='VND')edit(row.id,{amount:String(cap),full:true});else if(snapshot.quote.numerator&&snapshot.quote.denominator){const rate=nativeQuoteRate(snapshot),n=rate.n,d=100n*rate.d,floor=BigInt(cap)*d/n,cents=[floor,floor+1n].find(c=>(2n*c*n+d)/(2n*d)===BigInt(cap));if(cents===undefined){setFullError(f('This full balance cannot be represented in MYR cents. Choose VND or enter a partial payment.','该余额无法用整数 MYR 分表示，请选择 VND 或输入部分还款。'));return}edit(row.id,{amount:(cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0'),full:true})}}}>{f('Full','全额')}</button></div>
      <div className="tt-c-amount-grid">
        <label>{r('amount')}<AmountInput aria-label={r('amount')+' '+(index+1)} value={row.amount}
          inputMode={row.currency==='VND'?'numeric':'decimal'} onValueChange={value => {setFullError('');edit(row.id,{amount:value})}}/></label>
        <label>{ct(lang,'currencyLabel')}<select aria-label={r('currency')+' '+(index+1)} value={row.currency}
          onChange={e => edit(row.id,{currency:e.target.value as CreatorRow['currency'],amount:'',viaAmount:''})}>
          <option>VND</option><option>MYR</option>
        </select></label>
      </div>
      <div className="tt-c-details">
        <div className="tt-r-grid">
          <CreatorMemberPicker label={r('via')+' '+(index+1)} value={row.via}
            people={people.filter(p => ![row.payer,row.recipient].includes(p.id))}
            emptyLabel={r('direct')} allowEmpty onChange={id => edit(row.id,{via:id,viaAmount:''})}/>
          <label>{r('method')}<select aria-label={r('method')+' '+(index+1)} value={row.method}
            onChange={e => edit(row.id,{method:e.target.value as CreatorRow['method']})}>
            <option value="cash">{r('cash')}</option><option value="bank_transfer">{r('bank')}</option>
          </select></label>
          {row.via?<label>{f('Via currency','抵扣参考币种')}<select aria-label={'Via currency '+(index+1)} value={row.viaCurrency??'VND'} onChange={e=>edit(row.id,{viaCurrency:e.target.value as 'MYR'|'VND',viaAmount:''})}><option>MYR</option><option>VND</option></select></label>:null}
          {row.via ? <label>{row.viaCurrency==='MYR'?f('Apply via · MYR','经中间人抵扣 · MYR'):r('viaAmount')}<AmountInput aria-label={(row.viaCurrency==='MYR'?f('Apply via · MYR','经中间人抵扣 · MYR'):r('viaAmount'))+' '+(index+1)}
            value={row.viaAmount===''&&plan&&!plan.results[index].error?viaDisplay(snapshot!,plan.results[index].cap,row.viaCurrency??'VND'):row.viaAmount} placeholder={r('auto')} onValueChange={value => edit(row.id,{viaAmount:value})}/></label> : null}
        </div>
        {[row.payer,row.recipient].includes(actor) ? ownControl(row.id,row.currency) : null}
      </div>
      {plan?<div className="tt-final-remaining" aria-live="polite">{plan.results[index].error?<p>{plan.results[index].error}</p>:<>{row.via?<><p>{f('Via','经中间人')} · {routedMoney(plan.results[index].via,'VND')}</p><p>{people.find(p=>p.id===row.payer)?.name} → {people.find(p=>p.id===row.via)?.name} · {routedMoney(plan.results[index].upstream,'VND')}</p><p>{people.find(p=>p.id===row.via)?.name} → {people.find(p=>p.id===row.recipient)?.name} · {routedMoney(plan.results[index].downstream,'VND')}</p><button type="button" onClick={()=>edit(row.id,{viaAmount:''})}>{f('Use max','恢复最大值')}</button></>:null}<p>{f('Direct balance remaining','直接欠款余额')} <strong>{routedMoney(plan.results[index].remaining,'VND')}</strong></p></>}</div>:null}
      {rows.length>1 ? <button type="button" className="tt-c-remove" onClick={() => remove(row.id)}>{r('remove')}</button> : null}
    </fieldset>)}
    {plan?.results.some(line=>line.error)?<div className="tt-final-errors" role="alert">{plan.results.map((line,index)=>line.error?<button key={line.id} type="button" onClick={()=>onActive?.(line.id)}>{f('Repayment','还款')} {index+1}: {line.error}</button>:null)}</div>:null}
    <div className="tt-c-details tt-c-date-rate">{rateControl}</div>
  </>
}
