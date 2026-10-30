import {useState} from 'react'
import type {CanonicalExpense,GroupRole} from '../../types'
import type {usePersonalLedger} from '../../hooks/usePersonalLedger'
import {useT} from '../../lib/i18n'
import TripExpenseList from './TripExpenseList'

const expandedLimits=new Map<string,number>()

export default function TripOverviewRecords({expenses,status,self,role,names,ledger,today,refresh,canWrite,viewKey}:{
  viewKey:string;expenses:readonly CanonicalExpense[];status:'ready'|'error'|'loading';self:string;role:GroupRole;names:ReadonlyMap<string,string>;
  ledger:ReturnType<typeof usePersonalLedger>;today:string;refresh:()=>Promise<unknown>;canWrite:boolean
}) {
  const t=useT(),[limit,setLimit]=useState(()=>expandedLimits.get(viewKey)??20)
  return <div className="tl-overview-records" data-testid="trip-overview-records">
    <div className="tl-list-toolbar"><span>{status==='ready'?t('tl.count',{count:expenses.length}):t(status==='loading'?'common.loading':'home.amountUnavailable')}</span><button className="tt-icon-button" type="button" aria-label={t('common.refresh')} onClick={()=>void refresh()}>↻</button></div>
    {status==='error'?<div className="tl-notice" role="alert"><p>{t('tl.unavailable')}</p><button className="tt-link" type="button" onClick={()=>void refresh()}>{t('common.retry')}</button></div>:status==='loading'?<p role="status">{t('common.loading')}</p>:expenses.length?<TripExpenseList expenses={expenses.slice(0,limit)} self={self} role={role} names={names} ledger={ledger} today={today} refresh={refresh}/>:<div className="tl-paper-list tl-empty" data-testid="travel-empty-records"><h2>{t('travel.noExpenses')}</h2>{canWrite?<p>{t('tl.addHint')}</p>:null}</div>}
    {status==='ready'&&expenses.length>limit?<button className="tt-link tl-more" type="button" onClick={()=>{const next=limit+20;expandedLimits.set(viewKey,next);if(expandedLimits.size>80)expandedLimits.delete(expandedLimits.keys().next().value!);setLimit(next)}}>{t('tl.more')}</button>:null}
  </div>
}
