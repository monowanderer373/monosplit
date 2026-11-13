import type {ReactNode} from 'react'
import {useStore} from '../store/useStore'
import {ct} from '../lib/creatorTexts'
import {rt, routedMoney} from '../lib/routedSettlement'
import type {CreatorPerson} from '../lib/creatorSettlement'
import type {ContraSnapshot,ContraPair}from'../lib/tripContra'
import {CreatorMemberPairPicker} from './CreatorMemberPairPicker'
import {CreatorMemberPicker} from './CreatorMemberPicker'
import {RoutedAvatar} from './RoutedSettlementMap'
import AmountInput from './AmountInput'

export type CreatorRow = {id:string; payer:string; recipient:string; amount:string; currency:'MYR'|'VND'; method:'cash'|'bank_transfer'; via:string; viaAmount:string}

export function CreatorRepaymentChooser({people,snapshot,onChoose,disabled}:{people:CreatorPerson[];snapshot:ContraSnapshot;onChoose:(pair:ContraPair)=>void;disabled:boolean}) {
 const lang=useStore(s=>s.lang)
 const choices=snapshot.pairs.map(pair=>({pair,direction:pair.display.known?pair.display:pair.ledger})).filter(({direction:d})=>d.netMinor!==null&&d.netMinor>0&&d.payer&&d.recipient&&people.some(v=>v.id===d.payer)&&people.some(v=>v.id===d.recipient))
 const recipients=[...new Set(choices.map(p=>p.direction.recipient!))]
 return <div className="tt-c-choices" data-contra-revision={snapshot.revision}>
  <p>{ct(lang,'chooseHelp')}</p>
  {recipients.map(id=><section className="tt-c-debt-list" key={id}><h3>{ct(lang,'owedTo')} {people.find(p=>p.id===id)!.name}</h3>
   {choices.filter(p=>p.direction.recipient===id).map(({pair,direction})=>{const person=people.find(p=>p.id===direction.payer)!,d=pair.display;return <button type="button" disabled={disabled} key={pair.id} onClick={()=>onChoose(pair)}>
    <RoutedAvatar person={person}/><span>{person.name}</span><strong>{d.known?(d.estimated?'≈ ':'')+routedMoney(d.netMinor!,d.currency):'—'}</strong><span aria-hidden="true">›</span>
   </button>})}
  </section>)}
  {!choices.length?<p className="tt-r-muted">{ct(lang,'noChoices')}</p>:null}
  <p className="tt-r-muted">{ct(lang,'contraChoices')}</p>
 </div>
}

export function CreatorRepaymentForm({rows, people, disabled, actor, edit, remove, ownControl, rateControl}: {
  rows: CreatorRow[]
  people: CreatorPerson[]
  disabled: boolean
  actor: string
  edit: (id: string, patch: Partial<CreatorRow>) => void
  remove: (id: string) => void
  ownControl: (id: string, currency: string) => ReactNode
  rateControl: ReactNode
}) {
  const lang = useStore(s => s.lang)
  const r = (key: Parameters<typeof rt>[1]) => rt(lang,key)
  return <>
    {rows.map((row,index) => <fieldset key={row.id} disabled={disabled} className="tt-c-repayment" data-row-id={row.id}>
      {rows.length > 1 ? <legend>{r('payment')} {index+1}</legend> : null}
      <CreatorMemberPairPicker payer={row.payer} recipient={row.recipient} people={people} index={index+1}
        onChange={(side,id) => edit(row.id,{[side]:id,via:row.via===id?'':row.via,viaAmount:row.via===id?'':row.viaAmount})}/>
      <div className="tt-c-amount-grid">
        <label>{r('amount')}<AmountInput aria-label={r('amount')+' '+(index+1)} value={row.amount}
          inputMode={row.currency==='VND'?'numeric':'decimal'} onValueChange={value => edit(row.id,{amount:value})}/></label>
        <label>{ct(lang,'currencyLabel')}<select aria-label={r('currency')+' '+(index+1)} value={row.currency}
          onChange={e => edit(row.id,{currency:e.target.value as CreatorRow['currency'],amount:'',viaAmount:''})}>
          <option>VND</option><option>MYR</option>
        </select></label>
      </div>
      <details className="tt-c-details"><summary>{ct(lang,'paymentDetails')}</summary>
        <div className="tt-r-grid">
          <CreatorMemberPicker label={r('via')+' '+(index+1)} value={row.via}
            people={people.filter(p => ![row.payer,row.recipient].includes(p.id))}
            emptyLabel={r('direct')} allowEmpty onChange={id => edit(row.id,{via:id,viaAmount:''})}/>
          <label>{r('method')}<select aria-label={r('method')+' '+(index+1)} value={row.method}
            onChange={e => edit(row.id,{method:e.target.value as CreatorRow['method']})}>
            <option value="cash">{r('cash')}</option><option value="bank_transfer">{r('bank')}</option>
          </select></label>
          {row.via ? <label>{r('viaAmount')}<AmountInput aria-label={r('viaAmount')+' '+(index+1)}
            value={row.viaAmount} placeholder={r('auto')} onValueChange={value => edit(row.id,{viaAmount:value})}/></label> : null}
        </div>
        {[row.payer,row.recipient].includes(actor) ? ownControl(row.id,row.currency) : null}
      </details>
      {rows.length>1 ? <button type="button" className="tt-c-remove" onClick={() => remove(row.id)}>{r('remove')}</button> : null}
    </fieldset>)}
    <details className="tt-c-details tt-c-date-rate"><summary>{ct(lang,'dateRateDetails')}</summary>{rateControl}</details>
  </>
}
