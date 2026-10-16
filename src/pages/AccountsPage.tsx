import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { useMoneyAction } from '../hooks/useMoneyAction'
import { useStore } from '../store/useStore'
import { useT } from '../lib/i18n'
import { loadNotificationSnapshot, loadNotificationAccountEntries, type NotificationAccountEntry } from '../lib/notificationRepository'
import { pendingFundingGroups, type NoticeSnapshot } from '../lib/homeNotifications'
import { currencyGroups, latestAnchor, parseObservedBalance, validateMovementAmounts, type CurrencyAccount, type BalanceAnchor } from '../lib/multicurrency'
import { formatMinorAmount, parseMajorAmount } from '../lib/money'
import { CURRENCIES } from '../lib/currency'
import { localCalendarDate } from '../lib/homeView'
import { HomeSheet } from '../components/home/HomeScreen'
import AccountBalance, { NativeBalances } from '../components/accounts/AccountBalance'
import AmountInput from '../components/AmountInput'
import FundingBundleForm from '../components/accounts/FundingBundleForm'
import { supabase } from '../lib/supabase'

export default function AccountsPage({verify=false,manage=false}:{verify?:boolean;manage?:boolean}){
 const auth=useAuth(),ledger=usePersonalLedger(),t=useT(),location=useLocation()
 if(auth.loading)return <main className="ttmc-module ttmc-page"><p role="status">{t('mc.state.loading')}</p></main>
 if(!auth.authUser||auth.authUser.isAnonymous)return <main className="ttmc-module ttmc-page"><h1>{t('mc.state.login')}</h1><Link to={`/login?redirect=${encodeURIComponent(location.pathname+location.search)}`}>{t('common.signIn')}</Link></main>
 if(!ledger.participantId)return <main className="ttmc-module ttmc-page"><p>{t('mc.state.loading')}</p></main>
 return <AccountWorkspace key={auth.authUser.id+':'+verify+':'+manage} identity={auth.authUser.id} owner={ledger.participantId} verify={verify} manage={manage}/>
}
function AccountWorkspace({identity,owner,verify,manage}:{identity:string;owner:string;verify:boolean;manage:boolean}){
 const t=useT(),navigate=useNavigate(),params=useParams(),[query]=useSearchParams()
 const [snapshot,setSnapshot]=useState<NoticeSnapshot|null>(null),[failed,setFailed]=useState(false),[reload,setReload]=useState(0)
 const [dialog,setDialog]=useState<'currency'|string|null>(null)
 const hidden=useStore(s=>s.homeUi.balanceHidden),setHomeUi=useStore(s=>s.setHomeUi)
 useEffect(()=>{let active=true;void loadNotificationSnapshot(owner).then(data=>{if(active){setSnapshot(data);setFailed(false)}}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[owner,reload])
 const refresh=async(guard:()=>void)=>{const data=await loadNotificationSnapshot(owner);guard();setSnapshot(data);window.dispatchEvent(new Event('tt:accounts-changed'));return data}
 const accounts=(snapshot?.accounts??[]) as CurrencyAccount[],groups=currencyGroups(accounts)
 const group=groups.find(g=>g.parent.id===params.accountId),anchors=snapshot?.money?.anchors??[]
 const current=dialog&&dialog!=='currency'?accounts.find(a=>a.id===dialog):undefined
 return <main className="ttmc-module ttmc-page">
  <header className="ttmc-page-toolbar"><button type="button" onClick={()=>navigate(-1)}>‹ {t('common.back')}</button><div>
   {snapshot?<button type="button" aria-label={t('mc.state.latest')} onClick={()=>setReload(n=>n+1)}>↻</button>:null}
   <button type="button" aria-label={t(hidden?'home.showBalance':'home.hideBalance')} aria-pressed={hidden} onClick={()=>setHomeUi({balanceHidden:!hidden})}>◉</button>
  </div></header>
  <h1>{group&&!manage?group.parent.name:t(manage?'mc.account.manage':verify?'mc.verify.title':params.movementId?'mc.move.review':params.moveKind==='exchange'?'mc.move.exchange':params.moveKind?'mc.move.withdrawal':'mc.accounts')}</h1>
  {failed?<section role="alert"><p>{t('mc.state.failed')}</p><p>{t('mc.capability')}</p><button onClick={()=>setReload(n=>n+1)}>{t('common.retry')}</button></section>:null}
  {!snapshot&&!failed?<p role="status">{t('mc.state.loading')}</p>:null}
  {snapshot&&!snapshot.money?<p role="alert">{t('mc.capability')}</p>:null}
  {snapshot?.money&&params.moveKind?<MovementForm hidden={hidden} onReveal={()=>setHomeUi({balanceHidden:false})} key={params.moveKind} accounts={accounts} anchors={anchors} identity={identity} kind={params.moveKind==='exchange'?'exchange':'transfer'} initialParent={query.get('from')??''} onSaved={refresh}/>:null}
  {snapshot?.money&&verify?<VerificationList key={query.get('account')??'all'} snapshot={snapshot} identity={identity} parent={query.get('account')??'all'} hidden={hidden} onReveal={()=>setHomeUi({balanceHidden:false})} onRefresh={refresh}/>:null}
  {snapshot?.money&&params.movementId?<MovementDetails key={params.movementId} id={params.movementId} identity={identity} hidden={hidden} onReveal={()=>setHomeUi({balanceHidden:false})}/>:null}
  {snapshot?.money&&!verify&&!params.moveKind&&!params.movementId&&!params.accountId?groups.filter(g=>!g.parent.archived).map(g=><section className="ttmc-paper" key={g.parent.id}>
    <h2><Link to={`/accounts/${g.parent.id}`}>{g.parent.name}</Link></h2><AccountBalance accounts={g.units} identity={identity}/>
  </section>):null}
  {snapshot?.money&&params.accountId&&!group?<p>{t('mc.state.unavailable')}</p>:null}
  {snapshot?.money&&group?<>
   {!manage?<>
    <AccountBalance native={false} accounts={group.units} identity={identity} pending={pendingFundingGroups(snapshot).find(g=>g.parentId===group.parent.id)?.intentIds.length??0}/>
    {group.parent.accountClass==='liability'?<p>{t('home.liabilityNotCash')}</p>:<div className="ttmc-actions ttmc-movement-actions"><Link className="ttmc-link" to={`/accounts/move/transfer?from=${group.parent.id}`}>{t('mc.move.transfer')}</Link><Link className="ttmc-link" to={`/accounts/move/exchange?from=${group.parent.id}`}>{t('mc.move.exchange')}</Link></div>}
    <div className="ttmc-section-heading"><h2>{t('mc.currencyBalances')}</h2><Link className="ttmc-link" to={`/accounts/${group.parent.id}/currencies`}>{t('mc.account.manage')}</Link></div>
    <NativeBalances accounts={group.units}/>
    <Link className="ttmc-link" to={`/accounts/verify?account=${group.parent.id}`}>{t('mc.verify.title')}</Link>
    <AccountEntries units={group.units} hidden={hidden}/>
   </>:<section className="ttmc-currency-list">
    {!group.parent.archived?<button className="ttmc-add-currency" onClick={()=>setDialog('currency')}>+ {t('mc.account.addCurrency')}</button>:null}
    {group.units.map(unit=><button type="button" className="ttmc-currency-row" disabled={unit.archived} key={unit.id} onClick={()=>setDialog(unit.id)}><span className="ttmc-currency-icon" aria-hidden="true">{unit.currency[0]}</span><span><strong>{unit.currency}</strong>{unit.openingStatus==='unknown'?<small>{t('mc.account.balanceUnknown')}</small>:null}</span><strong>{hidden?'••••':unit.openingStatus==='posted'?formatMinorAmount(unit.entrySumMinor,unit.currency):t('mc.account.setBalance')}</strong><span aria-hidden="true">›</span></button>)}
   </section>}
   {dialog?<HomeSheet title={t(dialog==='currency'?'mc.account.addCurrency':'mc.account.setBalance')} onClose={()=>setDialog(null)} testId="account-currency-dialog" presentation="dialog" className="ttmc-dialog">
    {dialog==='currency'?<AddCurrency hidden={hidden} onReveal={()=>setHomeUi({balanceHidden:false})} parent={group.parent} units={group.units} identity={identity} onSaved={async guard=>{await refresh(guard);guard();setDialog(null)}}/>:current?<SetBalance hidden={hidden} onReveal={()=>setHomeUi({balanceHidden:false})} key={current.id} unit={current} identity={identity} onSaved={async guard=>{await refresh(guard);guard();setDialog(null)}}/>:null}
   </HomeSheet>:null}
  </>:null}
 </main>
}
function Reveal({onReveal}:{onReveal:()=>void}){const t=useT();return <section className="ttmc-module"><p>{t('notice.hiddenReview')}</p><button onClick={onReveal}>{t('mc.common.reveal')}</button></section>}
function Failure({failed}:{failed:boolean}){const t=useT();return failed?<p role="alert">{t('mc.saveFailed')}</p>:null}
function AddCurrency({parent,units,identity,onSaved,hidden,onReveal}:{hidden:boolean;onReveal:()=>void;parent:CurrencyAccount;units:CurrencyAccount[];identity:string;onSaved:(guard:()=>void)=>Promise<void>}){
 const t=useT(),[currency,setCurrency]=useState(''),[amount,setAmount]=useState(''),[asOf,setAsOf]=useState(localCalendarDate(new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone))
 const action=useMoneyAction(identity,`add-currency:${parent.id}`),available=CURRENCIES.filter(c=>!units.some(a=>a.currency===c.code))
 let valid=!!currency
 try{if(amount)parseObservedBalance(amount,currency)}catch{valid=false}
 if(hidden)return <Reveal onReveal={onReveal}/>
 return <form className="ttmc-module" onSubmit={e=>{e.preventDefault();if(!valid)return;void action.run('add_personal_account_currency',{parent_account_id:parent.id,currency_code:currency,expected_version:parent.version,opening_balance_minor:amount?parseObservedBalance(amount,currency):null,balance_as_of:amount?asOf:null},async(_,guard)=>{await onSaved(guard)})}}>
  <label>{t('mc.currency')}<select value={currency} disabled={action.busy} onChange={e=>{setCurrency(e.target.value);setAmount('')}}><option value="">{t('notice.pick')}</option>{available.map(c=><option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}</select></label>
  <label>{t('mc.optionalBalance')}<AmountInput value={amount} onValueChange={setAmount} disabled={action.busy}/></label>
  <label>{t('mc.account.asOf')}<input type="date" value={asOf} disabled={action.busy} onChange={e=>setAsOf(e.target.value)}/></label>
  <p>{t('mc.account.unknownHelp')}</p><Failure failed={action.error}/><button className="ttmc-primary" disabled={action.busy||!valid}>{t(action.busy?'mc.common.saving':'mc.account.addCurrency')}</button>
 </form>
}
function SetBalance({unit,identity,onSaved,hidden,onReveal}:{hidden:boolean;onReveal:()=>void;unit:CurrencyAccount;identity:string;onSaved:(guard:()=>void)=>Promise<void>}){
 const t=useT(),[amount,setAmount]=useState(''),[asOf,setAsOf]=useState(()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}),[entries,setEntries]=useState<NotificationAccountEntry[]|null>(null),[selected,setSelected]=useState<string[]>([]),[readFailed,setReadFailed]=useState(false)
 const action=useMoneyAction(identity,`set-balance:${unit.id}`)
 useEffect(()=>{let active=true;void loadNotificationAccountEntries(unit.id).then(rows=>{if(active)setEntries(rows)}).catch(()=>{if(active)setReadFailed(true)});return()=>{active=false}},[unit.id])
 let valid=!!entries&&!!asOf
 try{parseObservedBalance(amount,unit.currency)}catch{valid=false}
 if(hidden)return <Reveal onReveal={onReveal}/>
 return <form className="ttmc-module" onSubmit={e=>{e.preventDefault();if(!valid)return;void action.run('set_personal_currency_balance',{target_account_id:unit.id,observed_balance_minor:parseObservedBalance(amount,unit.currency),observed_at:new Date(asOf).toISOString(),expected_version:unit.version,expected_parent_version:unit.parentVersion,included_entry_ids:selected},async(_,guard)=>{await onSaved(guard)})}}>
  <label>{t('mc.account.observedBalance')} · {unit.currency}<AmountInput value={amount} onValueChange={setAmount} disabled={action.busy}/></label>
  <label>{t('mc.account.asOf')}<input type="datetime-local" value={asOf} onChange={e=>setAsOf(e.target.value)} disabled={action.busy}/></label>
  <p>{t('mc.includedEntries')}</p>
  {!entries?<p role={readFailed?'alert':'status'}>{t(readFailed?'mc.state.failed':'mc.state.loading')}</p>:entries.filter(e=>!['opening','reconciliation'].includes(e.kind)).map(entry=><label className="ttmc-check" key={entry.id}><input type="checkbox" disabled={action.busy} checked={selected.includes(entry.id)} onChange={e=>setSelected(e.target.checked?[...selected,entry.id]:selected.filter(id=>id!==entry.id))}/><span>{entry.date} · {entry.description||entry.kind} · {formatMinorAmount(entry.amountMinor,entry.currency)}</span></label>)}
  <p>{t('mc.noAutoCoverage')}</p><Failure failed={action.error}/><button className="ttmc-primary" disabled={action.busy||!valid}>{t(action.busy?'mc.common.saving':'mc.account.setBalance')}</button>
 </form>
}
function AccountEntries({units,hidden}:{units:CurrencyAccount[];hidden:boolean}){
 const [rows,setRows]=useState<NotificationAccountEntry[]|null>(null),[failed,setFailed]=useState(false),t=useT(),key=units.map(u=>u.id+':'+u.version).join('|')
 useEffect(()=>{let active=true;void Promise.all(units.map(u=>loadNotificationAccountEntries(u.id))).then(all=>{if(active)setRows(all.flat().sort((a,b)=>b.date.localeCompare(a.date)))}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[key,units])
 return <section className="ttmc-history"><h2>{t('mc.entries')}</h2>{failed?<p role="alert">{t('mc.state.failed')}</p>:!rows?<p>{t('mc.state.loading')}</p>:rows.map(row=><div key={row.id}><p>{row.date} · {hidden?'••••':row.description||row.kind}</p><strong>{hidden?'••••':formatMinorAmount(row.amountMinor,row.currency)}</strong></div>)}</section>
}
function Coverage({unit,anchors,value,onChange,disabled}:{unit:CurrencyAccount|undefined;anchors:BalanceAnchor[];value:string;onChange:(v:string)=>void;disabled:boolean}){
 const t=useT();if(!unit||!latestAnchor(anchors,unit.id))return null
 return <label>{unit.name} · {unit.currency} · {t('mc.verify.coverage')}<select disabled={disabled} value={value} onChange={e=>onChange(e.target.value)}><option value="">{t('notice.pick')}</option><option value="included">{t('mc.verify.included')}</option><option value="excluded">{t('mc.verify.notIncluded')}</option></select></label>
}
function MovementForm({accounts,anchors,identity,kind,initialParent,onSaved,hidden,onReveal}:{hidden:boolean;onReveal:()=>void;accounts:CurrencyAccount[];anchors:BalanceAnchor[];identity:string;kind:'transfer'|'exchange';initialParent:string;onSaved:(guard:()=>void)=>Promise<NoticeSnapshot>}){
 const t=useT(),navigate=useNavigate(),eligible=accounts.filter(a=>!a.archived&&a.accountClass==='asset')
 const [sourceId,setSourceId]=useState(()=>eligible.find(a=>a.parentAccountId===initialParent)?.id??''),[destinationId,setDestinationId]=useState(''),[out,setOut]=useState(''),[received,setReceived]=useState(''),[sourceCoverage,setSourceCoverage]=useState(''),[destinationCoverage,setDestinationCoverage]=useState('')
 const [date,setDate]=useState(localCalendarDate(new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone)),[note,setNote]=useState(''),[feeOpen,setFeeOpen]=useState(false),[feeMode,setFeeMode]=useState('included_source'),[feeId,setFeeId]=useState(''),[feeAmount,setFeeAmount]=useState(''),[feeCoverage,setFeeCoverage]=useState('')
 const source=eligible.find(a=>a.id===sourceId),destination=eligible.find(a=>a.id===destinationId),fee=feeMode==='included_source'?source:feeMode==='included_destination'?destination:accounts.find(a=>a.id===feeId&&!a.archived)
 const action=useMoneyAction(identity,`move:${kind}`)
 const coverage=(unit:CurrencyAccount,value:string)=>{const anchor=latestAnchor(anchors,unit.id);if(anchor&&!value)throw new Error('funding_coverage_required');return {anchor_id:anchor?.id??null,included_in_anchor:anchor?value==='included':null}}
 const payload=()=>{
  if(!source||!destination||source.id===destination.id||kind==='exchange'&&(source.parentAccountId!==destination.parentAccountId||source.currency===destination.currency)||kind==='transfer'&&source.parentAccountId===destination.parentAccountId)throw new Error('invalid_movement')
  const result={kind:kind==='exchange'?'exchange':destination.accountType==='cash'?'withdrawal':'transfer',source_account_id:source.id,source_version:source.version,source_parent_version:source.parentVersion,source_total_minor:parseMajorAmount(out,source.currency),source_coverage:coverage(source,sourceCoverage),destination_account_id:destination.id,destination_version:destination.version,destination_parent_version:destination.parentVersion,destination_net_minor:parseMajorAmount(received,destination.currency),destination_coverage:coverage(destination,destinationCoverage),occurred_on:date,memo:note.trim()||null,fee:feeOpen?(()=>{if(!fee)throw new Error('invalid_fee');return {mode:feeMode,account_id:fee.id,version:fee.version,parent_version:fee.parentVersion,currency:fee.currency,amount_minor:parseMajorAmount(feeAmount,fee.currency),coverage:coverage(fee,fee.id===source.id?sourceCoverage:fee.id===destination.id?destinationCoverage:feeCoverage)}})():null}
  validateMovementAmounts(result.source_total_minor,result.destination_net_minor,source.currency,destination.currency,result.fee)
  return result
 }
 let valid=false;try{payload();valid=true}catch{/* Incomplete draft stays editable. */}
 if(hidden)return <Reveal onReveal={onReveal}/>
 return <form onSubmit={e=>{e.preventDefault();if(!valid)return;void action.run('record_personal_money_movement',{movement_payload:payload()},async(result,guard)=>{await onSaved(guard);guard();const r=result as {movement_id?:string};navigate(r.movement_id?`/accounts/movements/${r.movement_id}`:'/accounts',{replace:true})})}}>
  <label>{t('mc.move.from')}<select value={sourceId} disabled={action.busy} onChange={e=>{setSourceId(e.target.value);setDestinationId('');setOut('');setReceived('');setSourceCoverage('');setDestinationCoverage('')}}><option value="">{t('notice.pick')}</option>{eligible.map(a=><option value={a.id} key={a.id}>{a.name} · {a.currency}</option>)}</select></label>
  <label>{t('mc.move.totalOut')} {source?.currency}<AmountInput value={out} onValueChange={setOut} disabled={action.busy}/></label>
  <label>{t('mc.move.to')}<select value={destinationId} disabled={action.busy} onChange={e=>{setDestinationId(e.target.value);setReceived('');setDestinationCoverage('')}}><option value="">{t('notice.pick')}</option>{eligible.filter(a=>source&&a.id!==source.id&&(kind==='exchange'?a.parentAccountId===source.parentAccountId&&a.currency!==source.currency:a.parentAccountId!==source.parentAccountId)).map(a=><option value={a.id} key={a.id}>{a.name} · {a.currency}</option>)}</select></label>
  <label>{t(destination?.accountType==='cash'?'mc.move.cashReceived':'mc.move.received')} {destination?.currency}<AmountInput value={received} onValueChange={setReceived} disabled={action.busy}/></label>
  <p>{t('mc.move.actualHelp')} {t('mc.move.principalHelp')}</p>
  <Coverage unit={source} anchors={anchors} value={sourceCoverage} onChange={setSourceCoverage} disabled={action.busy}/><Coverage unit={destination} anchors={anchors} value={destinationCoverage} onChange={setDestinationCoverage} disabled={action.busy}/>
  <button type="button" disabled={action.busy} aria-expanded={feeOpen} onClick={()=>setFeeOpen(!feeOpen)}>{t('mc.move.feeDetails')}</button>
  {feeOpen?<fieldset className="ttmc-paper" disabled={action.busy}><label>{t('mc.move.feeDetails')}<select value={feeMode} onChange={e=>{setFeeMode(e.target.value);setFeeAmount('');setFeeCoverage('')}}><option value="included_source">{t('mc.move.feeIncluded')}</option><option value="included_destination">{t('mc.feeDestination')}</option><option value="separate">{t('mc.move.feeSeparate')}</option></select></label>
   {feeMode==='separate'?<label>{t('mc.funding.source')}<select value={feeId} onChange={e=>{setFeeId(e.target.value);setFeeAmount('');setFeeCoverage('')}}><option value="">{t('notice.pick')}</option>{accounts.filter(a=>!a.archived).map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>:null}
   <label>{t('mc.move.feeAmount')} {fee?.currency}<AmountInput value={feeAmount} onValueChange={setFeeAmount}/></label>
   {feeMode==='separate'&&fee?.id!==sourceId&&fee?.id!==destinationId?<Coverage unit={fee} anchors={anchors} value={feeCoverage} onChange={setFeeCoverage} disabled={action.busy}/>:null}
   {feeMode!=='separate'?<p>{t('mc.move.noDoubleFee')}</p>:null}
  </fieldset>:<p>{t('mc.move.feeUnknown')}</p>}
  <label>{t('mc.date')}<input type="date" value={date} disabled={action.busy} onChange={e=>setDate(e.target.value)}/></label><label>{t('mc.note')}<textarea value={note} maxLength={1000} disabled={action.busy} onChange={e=>setNote(e.target.value)}/></label>
  <Failure failed={action.error}/><button className="ttmc-primary" disabled={!valid||action.busy}>{t(action.busy?'mc.common.saving':kind==='exchange'?'mc.move.recordExchange':destination?.accountType==='cash'?'mc.move.recordWithdrawal':'mc.move.recordTransfer')}</button>
 </form>
}
function VerificationList({snapshot,identity,parent,hidden,onReveal,onRefresh}:{snapshot:NoticeSnapshot;identity:string;parent:string;hidden:boolean;onReveal:()=>void;onRefresh:(guard:()=>void)=>Promise<NoticeSnapshot>}){
 const t=useT(),[selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[saved,setSaved]=useState(false)
 const groups=pendingFundingGroups(snapshot),ids=groups.filter(g=>parent==='all'||(g.parentId??'unassigned')===parent).flatMap(g=>g.intentIds)
 const activeId=selected===null&&ids.length===1?ids[0]:selected??'',row=snapshot.funding.find(r=>r.id===activeId),expense=snapshot.expenses.find(e=>e.id===row?.expense_id)
 const epoch=useRef(0),lock=useRef(false)
 const select=(id:string)=>{epoch.current++;lock.current=false;setBusy(false);setFailed(false);setSelected(id)}
 useEffect(()=>()=>{epoch.current++},[identity,activeId])
 const perform=async(work:(guard:()=>void)=>Promise<unknown>)=>{
  if(lock.current)return
  lock.current=true;setBusy(true);setFailed(false);const token=epoch.current
  const guard=()=>{if(token!==epoch.current)throw new Error('notification_context_changed')}
  try{
   await work(guard);guard()
   const fresh=await onRefresh(guard);guard()
   // Advance only after this explicit command and an authoritative read agree it committed.
   if(fresh.funding.find(f=>f.id===activeId)?.status!=='posted')throw new Error('funding_not_confirmed')
   const next=pendingFundingGroups(fresh).filter(g=>parent==='all'||(g.parentId??'unassigned')===parent).flatMap(g=>g.intentIds).find(id=>id!==activeId)
   setSelected(next??'');setSaved(true)
  }catch{if(token===epoch.current)setFailed(true)}
  finally{if(token===epoch.current){lock.current=false;setBusy(false)}}
 }
 return <>
  <p>{t('mc.verify.notDeducted')}</p>
  {!ids.length?<p role="status">{t(saved?'mc.verify.done':'mc.state.empty')}</p>:<section className="ttmc-paper"><h2>{t('mc.verify.choose')}</h2>{ids.map(id=>{const funding=snapshot.funding.find(f=>f.id===id),e=snapshot.expenses.find(e=>e.id===funding?.expense_id);return <button type="button" key={id} onClick={()=>select(id)}>{hidden?'••••':e?.description||e?.category||t('mc.verify.single')} · {e?.occurredOn}</button>})}</section>}
  {activeId&&row&&expense&&ids.includes(activeId)?<HomeSheet key={activeId} title={t('mc.verify.single')} onClose={()=>select('')} testId="verify-deduction" presentation="dialog" className="ttmc-dialog">
   <p>{hidden?'••••':expense.description||expense.category} · {expense.occurredOn}</p><FundingBundleForm hidden={hidden} onReveal={onReveal} key={`${row.id}:${row.version}`} row={row} snapshot={snapshot} identity={identity} busy={busy} onSubmit={perform} next={ids.length>1}/><Failure failed={failed}/>
  </HomeSheet>:null}
 </>
}
type RecordedMovement={id:string;version:number;kind:string;source_account_id:string;destination_account_id:string;source_total_minor:number|string;destination_net_minor:number|string;source_currency:string;destination_currency:string;occurred_on:string;memo:string|null;reversed_operation_id:string|null}
function MovementDetails({id,identity,hidden,onReveal}:{id:string;identity:string;hidden:boolean;onReveal:()=>void}){
 const t=useT(),[row,setRow]=useState<RecordedMovement|null>(null),[failed,setFailed]=useState(false),[hasFee,setHasFee]=useState(false),[feeAmount,setFeeAmount]=useState(''),[feeMode,setFeeMode]=useState('included_source'),[reload,setReload]=useState(0)
 const action=useMoneyAction(identity,`itemise-fee:${id}`)
 useEffect(()=>{let active=true;void (async()=>{
  if(!supabase)throw new Error('not_configured')
  const [movement,fee]=await Promise.all([supabase.from('personal_money_movements').select('id,version,kind,source_account_id,destination_account_id,source_total_minor,destination_net_minor,source_currency,destination_currency,occurred_on,memo,reversed_operation_id').eq('id',id).maybeSingle(),supabase.from('personal_money_movement_fees').select('id').eq('movement_id',id)])
  if(movement.error||fee.error)throw movement.error||fee.error
  if(active){setRow(movement.data);setHasFee(!!fee.data?.length)}
 })().catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[id,reload])
 const feeCurrency=feeMode==='included_source'?row?.source_currency:row?.destination_currency
 let valid=false;try{if(feeCurrency)valid=parseMajorAmount(feeAmount,feeCurrency)>0}catch{/* Retain invalid draft. */}
 return failed?<p role="alert">{t('mc.state.failed')}</p>:!row?<p role="status">{t('mc.state.unavailable')}</p>:<>
  <section className="ttmc-paper"><dl><div><dt>{t('mc.date')}</dt><dd>{row.occurred_on}</dd></div><div><dt>{t('mc.move.totalOut')}</dt><dd>{hidden?'••••':formatMinorAmount(Number(row.source_total_minor),row.source_currency)}</dd></div><div><dt>{t('mc.move.received')}</dt><dd>{hidden?'••••':formatMinorAmount(Number(row.destination_net_minor),row.destination_currency)}</dd></div></dl>{row.memo&&!hidden?<p>{row.memo}</p>:null}<p>{t('mc.move.principalHelp')}</p></section>
  {!hasFee&&!row.reversed_operation_id&&row.source_currency!==row.destination_currency?<section className="ttmc-paper"><h2>{t('mc.move.feeDetails')}</h2>{hidden?<Reveal onReveal={onReveal}/>:<form onSubmit={e=>{e.preventDefault();if(!valid)return;void action.run('itemise_personal_movement_fee',{target_movement_id:id,expected_version:row.version,fee_mode:feeMode,fee_amount_minor:parseMajorAmount(feeAmount,feeCurrency!)},()=>{setReload(n=>n+1);window.dispatchEvent(new Event('tt:accounts-changed'))})}}><label>{t('mc.move.feeDetails')}<select value={feeMode} onChange={e=>{setFeeMode(e.target.value);setFeeAmount('')}} disabled={action.busy}><option value="included_source">{t('mc.move.feeIncluded')}</option><option value="included_destination">{t('mc.feeDestination')}</option></select></label><label>{t('mc.move.feeAmount')} · {feeCurrency}<AmountInput value={feeAmount} onValueChange={setFeeAmount} disabled={action.busy}/></label><p>{t('mc.move.noDoubleFee')}</p><Failure failed={action.error}/><button className="ttmc-primary" disabled={!valid||action.busy}>{t(action.busy?'mc.common.saving':'mc.common.save')}</button></form>}</section>:null}
 </>
}
