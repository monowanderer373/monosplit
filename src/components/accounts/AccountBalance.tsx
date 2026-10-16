import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import { useInsightsFx } from '../../hooks/useInsightsFx'
import { accountValuation, type CurrencyAccount } from '../../lib/multicurrency'
import { exactAmount } from '../../lib/fx'
import { formatMinorAmount } from '../../lib/money'

export default function AccountBalance({accounts,identity,pending=0,native=true,includeArchived=false}:{accounts:readonly CurrencyAccount[];identity:string;pending?:number;native?:boolean;includeArchived?:boolean}){
 const t=useT(),hidden=useStore(s=>s.homeUi.balanceHidden),lang=useStore(s=>s.lang)
 const units=accounts.filter(a=>!a.archived||includeArchived),foreign=units.some(a=>a.currency!=='MYR'&&a.openingStatus==='posted')
 const {snapshot}=useInsightsFx(identity,foreign),valuation=accountValuation(units,snapshot,includeArchived)
 const currencies=[...new Set(units.map(a=>a.currency))]
 return <div className="ttmc-module ttmc-balances">
   {currencies.length>1?<p>{t(valuation.partial?'mc.account.knownValue':'mc.account.recordedValue')}</p>:null}
   <strong className="ttmc-estimate">{hidden?'••••':currencies.length===1&&units.length===1
    ? units[0].openingStatus==='posted'?formatMinorAmount(units[0].entrySumMinor,units[0].currency):t('mc.account.balanceUnknown')
    :valuation.minor==null?t('mc.account.balanceUnknown'):`≈ RM ${exactAmount(valuation.minor,2,lang)}`}</strong>
   {native&&currencies.length>1?<NativeBalances accounts={units} includeArchived={includeArchived}/>:null}
   {includeArchived?<p>{t('space.status.archived')}</p>:null}
   {units.some(a=>a.accountClass==='liability')?<p>{t('home.liabilityNotCash')}</p>:null}
   {valuation.partial?<p>{t('mc.account.exclusions')}</p>:null}
   {pending>0?<p className="ttmc-pending-band">{t('mc.verify.count',{count:pending})} · {t('mc.verify.notDeducted')}</p>:null}
 </div>
}
export function NativeBalances({accounts,includeArchived=false}:{accounts:readonly CurrencyAccount[];includeArchived?:boolean}){
 const t=useT(),hidden=useStore(s=>s.homeUi.balanceHidden),[expanded,setExpanded]=useState(false),units=accounts.filter(a=>!a.archived||includeArchived)
 return <div className="ttmc-module ttmc-native-balances"><ul>{units.slice(0,expanded?undefined:3).map(a=><li key={a.id}><span className="ttmc-currency-icon" aria-hidden="true">{a.currency[0]}</span><span>{a.currency}</span><strong>{hidden?'••••':a.openingStatus==='posted'?formatMinorAmount(a.entrySumMinor,a.currency):t('mc.account.balanceUnknown')}</strong></li>)}</ul>
  {units.length>3?<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{t(expanded?'mc.account.showLess':'mc.account.moreCurrencies',{count:units.length-3})}</button>:null}
 </div>
}
