import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import { useInsightsFx } from '../../hooks/useInsightsFx'
import { accountValuation, type CurrencyAccount } from '../../lib/multicurrency'
import { exactAmount } from '../../lib/fx'
import { localeForLang } from '../../lib/locale'
import { formatMinorAmount } from '../../lib/money'

export default function AccountBalance({accounts,identity,pending=0,native=true,includeArchived=false}:{accounts:readonly CurrencyAccount[];identity:string;pending?:number;native?:boolean;includeArchived?:boolean}){
 const t=useT(),hidden=useStore(s=>s.homeUi.balanceHidden),lang=useStore(s=>s.lang)
 const units=accounts.filter(a=>!a.archived||includeArchived),foreign=units.some(a=>a.currency!=='MYR'&&a.openingStatus==='posted')
 const {snapshot,updating,retry}=useInsightsFx(identity,foreign),valuation=accountValuation(units,snapshot,includeArchived)
 const [now,setNow]=useState(()=>Date.now())
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60_000);return()=>clearInterval(timer)},[])
 const currencies=[...new Set(units.map(a=>a.currency))]
 const available=units.filter(a=>a.currency!=='MYR'&&a.openingStatus==='posted').flatMap(a=>snapshot.rates[a.currency]?[snapshot.rates[a.currency]]:[])
 const dates=[...new Set(available.map(rate=>rate.rateDate))].sort()
 const day=(value:string)=>new Intl.DateTimeFormat(localeForLang(lang),{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'))
 const dateText=dates.length?day(dates[0])+(dates.length>1?' – '+day(dates.at(-1)!):''):''
 const cached=snapshot.status==='cached'||available.some(rate=>now-Date.parse(rate.fetchedAt)>86400_000)
 const older=available.some(rate=>now-Date.parse(rate.rateDate+'T00:00:00Z')>7*86400_000)
 return <div className="ttmc-module ttmc-balances">
   {currencies.length>1?<p>{t(valuation.partial?'mc.account.knownValue':'mc.account.recordedValue')}</p>:null}
   <strong className="ttmc-estimate">{hidden?'••••':currencies.length===1&&units.length===1
    ? units[0].openingStatus==='posted'?formatMinorAmount(units[0].entrySumMinor,units[0].currency):t('mc.account.balanceUnknown')
    :valuation.minor==null?t('mc.account.balanceUnknown'):`≈ RM ${exactAmount(valuation.minor,2,lang)}`}</strong>
   {native&&currencies.length>1?<NativeBalances accounts={units} includeArchived={includeArchived}/>:null}
   {includeArchived?<p>{t('space.status.archived')}</p>:null}
   {units.some(a=>a.accountClass==='liability')?<p>{t('home.liabilityNotCash')}</p>:null}
   {valuation.partial?<p>{t('mc.account.exclusions')}</p>:null}
   {foreign?<p className="ttmc-rate-source">{t('spending.fxRates')} <a href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">Frankfurter</a>{dateText?' · '+dateText:''}
    {updating||older||cached||valuation.missingRates>0?<> · <span role="status">{t(updating?'spending.fxUpdating':older?'spending.fxOlder':cached?'spending.fxCached':'spending.fxUnavailable')}</span></>:null}
    {!updating&&(cached||valuation.missingRates>0)?<> · <button type="button" onClick={()=>void retry()}>{t('common.retry')}</button></>:null}
    <span className="home-sr"> · {t('spending.fxBasis')}</span>
   </p>:null}
   {pending>0?<p className="ttmc-pending-band">{t('mc.verify.count',{count:pending})} · {t('mc.verify.notDeducted')}</p>:null}
 </div>
}
export function NativeBalances({accounts,includeArchived=false}:{accounts:readonly CurrencyAccount[];includeArchived?:boolean}){
 const t=useT(),hidden=useStore(s=>s.homeUi.balanceHidden),[expanded,setExpanded]=useState(false),units=accounts.filter(a=>!a.archived||includeArchived)
 return <div className="ttmc-module ttmc-native-balances"><ul>{units.slice(0,expanded?undefined:3).map(a=><li key={a.id}><span className="ttmc-currency-icon" aria-hidden="true">{a.currency[0]}</span><span>{a.currency}</span><strong>{hidden?'••••':a.openingStatus==='posted'?formatMinorAmount(a.entrySumMinor,a.currency):t('mc.account.balanceUnknown')}</strong></li>)}</ul>
  {units.length>3?<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{t(expanded?'mc.account.showLess':'mc.account.moreCurrencies',{count:units.length-3})}</button>:null}
 </div>
}
