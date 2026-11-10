import {useState} from 'react'
import {useStore} from '../store/useStore'
import {routedMoney as money,rt,type RoutedPerson,type RoutedPlan} from '../lib/routedSettlement'
export function RoutedAvatar({person}:{person:RoutedPerson}){const[failed,setFailed]=useState('');return <span className="tt-r-avatar" aria-hidden="true">{person.avatarUrl&&failed!==person.avatarUrl?<img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(person.avatarUrl!)}/>:Array.from(person.name.trim())[0]?.toUpperCase()??'?'}</span>}
export function RoutedSettlementMap({plan,people,confirmed=false,reversed=false}:{plan:RoutedPlan;people:RoutedPerson[];confirmed?:boolean;reversed?:boolean}){
 const lang=useStore(s=>s.lang),t=(k:Parameters<typeof rt>[1])=>rt(lang,k),person=(id:string)=>people.find(p=>p.id===id)??{id,name:'—'}
 const groups=[...new Set(plan.lines.map(l=>l.payment.recipient))],[picked,setPicked]=useState(''),selected=groups.includes(picked)?picked:groups[0],rows=plan.lines.filter(l=>l.payment.recipient===selected)
 const node=(id:string)=><span className="tt-r-node"><RoutedAvatar person={person(id)}/><span>{person(id).name}</span></span>
 return <section className="tt-r-map" aria-label={t('graph')}>
  {groups.length>1?<div className="tt-r-people" role="group" aria-label={t('switch')}>{groups.map(id=><button type="button" key={id} aria-pressed={selected===id} onClick={()=>setPicked(id)}><RoutedAvatar person={person(id)}/><span>{person(id).name}<small>{(['VND','MYR']as const).flatMap(c=>{const n=plan.lines.filter(l=>l.payment.recipient===id&&l.payment.tenderCurrency===c).reduce((s,l)=>s+BigInt(l.payment.tenderMinor),0n);return n?[money(n,c)]:[]}).join(' · ')}</small></span></button>)}</div>:null}
  <div className="tt-r-paper" aria-live="polite"><h3>{t('flow')}</h3><p className="tt-r-muted">{t(reversed?'reversed':confirmed?'posted':'previewOnly')}</p>
   {rows.map(({payment:p})=><div className="tt-r-route" key={p.id}>{node(p.payer)}<div className="tt-r-arrow"><strong>{money(p.tenderMinor,p.tenderCurrency)}</strong><span aria-hidden="true"/><small>{t(p.method==='bank_transfer'?'bank':'cash')}</small></div>{node(p.recipient)}</div>)}
   {!plan.issues.length?<><details className="tt-r-details" key={selected}><summary>{t('coverage')}</summary>
    {rows.map(l=><div key={l.payment.id} className="tt-r-allocation">{l.payment.via&&l.viaMinor>0?<div className="tt-r-chain">{node(l.payment.payer)}<span className="tt-r-via-edge" aria-hidden="true"/>{node(l.payment.via.person)}<span className="tt-r-via-edge" aria-hidden="true"/>{node(l.payment.recipient)}<strong>{money(l.viaMinor,'VND')} · {t('vndReference')}</strong></div>:null}{l.directMinor>0?<p>{person(l.payment.payer).name} → {person(l.payment.recipient).name} · {money(l.directMinor,'VND')} · {t('vndReference')}</p>:null}</div>)}
    <h4>{t('native')}</h4>{plan.coverage?.map((c,i)=><p key={i}>{person(c.from).name} → {person(c.to).name} · {money(c.minor,c.currency)}</p>)}
    </details><div className="tt-r-balances"><strong>{t(confirmed||reversed?'asRecorded':'estimated')} · {t('remaining')} {person(selected).name}</strong>{plan.remaining.filter(e=>e.to===selected&&e.minor>0).length?plan.remaining.filter(e=>e.to===selected&&e.minor>0).map((e,i)=><span key={i}>{person(e.from).name}<strong>{money(e.minor,e.currency)}</strong></span>):<span>{t('none')}</span>}</div></>:null}
  </div>
 </section>
}
