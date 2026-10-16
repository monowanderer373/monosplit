import AmountInput from '../AmountInput'
import { useT } from '../../lib/i18n'
import { generateId } from '../../lib/id'
import { latestAnchor, type BalanceAnchor, type CurrencyAccount, type SourceDraft } from '../../lib/multicurrency'

export default function FundingSources({accounts,anchors,sources,onChange,busy=false}:{accounts:readonly CurrencyAccount[];anchors:readonly BalanceAnchor[];sources:readonly SourceDraft[];onChange:(sources:SourceDraft[])=>void;busy?:boolean}){
  const t=useT()
  const change=(index:number,patch:Partial<SourceDraft>)=>onChange(sources.map((source,i)=>i===index?{...source,...patch}:source))
  return <div className="ttmc-module ttmc-sources">
    {sources.map((source,index)=>{
      const unit=accounts.find(a=>a.id===source.accountId),anchor=unit?latestAnchor(anchors,unit.id):null
      return <fieldset className="ttmc-paper" key={source.key} disabled={busy}>
        <label>{t('mc.funding.source')}<select value={source.accountId} onChange={e=>change(index,{accountId:e.target.value,amount:'',coverage:''})}>
          <option value="">{t('mc.funding.chooseBalance')}</option>
          {accounts.filter(a=>!a.archived).map(a=><option key={a.id} value={a.id} disabled={sources.some((s,i)=>i!==index&&s.accountId===a.id)}>{a.name} · {a.currency}</option>)}
        </select></label>
        {unit?<label>{t('mc.funding.actual',{currency:unit.currency})}<AmountInput value={source.amount} onValueChange={amount=>change(index,{amount})} inputMode="decimal" /></label>:null}
        {anchor?<fieldset className="ttmc-coverage"><legend>{t('mc.verify.coverage')}</legend><p>{t('mc.coverageHelp')}</p>
          <select aria-label={t('mc.verify.coverage')} value={source.coverage} onChange={e=>change(index,{coverage:e.target.value as SourceDraft['coverage']})}>
            <option value="">{t('notice.pick')}</option><option value="included">{t('mc.verify.included')}</option><option value="excluded">{t('mc.verify.notIncluded')}</option>
          </select>
        </fieldset>:null}
        {index>0?<button type="button" onClick={()=>onChange(sources.filter((_,i)=>i!==index))}>{t('mc.funding.removeSource')}</button>:null}
      </fieldset>
    })}
    <p>{t('mc.funding.actualHelp')}</p>
    {sources.length<20?<button type="button" disabled={busy} onClick={()=>onChange([...sources,{key:generateId(),accountId:'',amount:'',coverage:''}])}>+ {t('mc.funding.addSource')}</button>:null}
  </div>
}
