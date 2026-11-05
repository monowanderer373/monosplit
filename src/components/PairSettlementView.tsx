import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AmountInput from './AmountInput'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { localeForLang, formatDate } from '../lib/locale'
import { currencyExponent, parseMajorAmount } from '../lib/money'
import { exactAmount, fraction } from '../lib/fx'
import { customForeignPerTarget, quotePair, settlementRequestId, systemForeignPerTarget, valueLines, type MoneyLine } from '../lib/fxSettlement'
import { pairExpenseSources, pairExpenseVersions, pairCoverageApplications, type FxBundle } from '../lib/pairSettlement'
import { useInsightsFx } from '../hooks/useInsightsFx'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { useAuth } from '../hooks/useAuth'
import { useT, friendlyErrorKey } from '../lib/i18n'
import { generateId } from '../lib/id'
import { loadQuickAccounts, type QuickAccount } from '../lib/quickAccounts'
import type { CanonicalExpense } from '../types'
import type { ConfirmedSettlement } from '../lib/relationalBalance'
import './pair-settlement.css'

type Props={self:string;other:string;otherName:string;youOwe:MoneyLine[];theyOwe:MoneyLine[];target:string;spaceId:string;tripName?:string;expenses:readonly CanonicalExpense[];settlements:readonly ConfirmedSettlement[];pageMode:'summary'|'pay'|'review';canPropose:boolean;review?:FxBundle|null;bundleStatus?:'loading'|'ready'|'error';onClose:()=>void;onDone:()=>Promise<unknown>;onRefresh?:()=>Promise<unknown>}
export function PairSettlementView({self,other,otherName,youOwe,theyOwe,target:homeCurrency,spaceId,tripName,expenses,settlements,pageMode,canPropose,review:providedReview,bundleStatus,onClose,onDone,onRefresh}:Props){
  const t=useT(),{authUser}=useAuth(),lang=useStore(s=>s.lang),isReview=pageMode==='review'
  const review=providedReview&&[providedReview.payer_participant_id,providedReview.counterparty_participant_id].includes(self)?providedReview:null
  const batchCash=useMemo(()=>isReview&&review?.quote.batchVersion===1?review.quote.cashLegs??[]:null,[isReview,review])
  const [batchAccounts,setBatchAccounts]=useState<Record<string,string>>({})
  const target=isReview&&review?review.target_currency:homeCurrency
  const fx=useInsightsFx(authUser?.id??self,!isReview)
  const [mode,setMode]=useState<'system'|'custom'>('system'),[intent,setIntent]=useState<'full'|'partial'>('full'),[partial,setPartial]=useState(''),[rates,setRates]=useState<Record<string,string>>({})
  const [accountId,setAccountId]=useState(''),[accountRetry,setAccountRetry]=useState(0)
  const [accountRead,setAccountRead]=useState<{key:string;rows:QuickAccount[];status:'ready'|'error'}|null>(null)
  const [open,setOpen]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const busyRef=useRef(false),request=useRef<{fingerprint:string;id:string}|null>(null)
  const close=()=>{if(!busyRef.current)onClose()}
  const dialog=useAccessibleDialog<HTMLElement>(close)
  const money=(n:bigint|number,currency=target)=>exactAmount(BigInt(n),currencyExponent(currency),localeForLang(lang))
  const rateDisplay=(n:string,d:string)=>{if(!n||!d)return '—';const value=Number(n)/Number(d);return Number.isFinite(value)?new Intl.NumberFormat(localeForLang(lang),{maximumFractionDigits:6}).format(value):n+'/'+d}
  const display=(n:bigint|number,currency=target)=>`${currency==='MYR'?'RM':currency} ${money(n,currency)}`
  const foreign=[...new Set([...youOwe,...theyOwe].map(l=>l.currency).filter(c=>c!==target))].sort()
  const rateFor=(code:string)=>code===target?fraction(1n):mode==='custom'?(rates[code]?customForeignPerTarget(rates[code]):null):systemForeignPerTarget(code,target,fx.snapshot)
  let full:ReturnType<typeof quotePair>|null=null,quoted:ReturnType<typeof quotePair>|null=null,quoteError=''
  try{if(!isReview){full=quotePair({youOwe,theyOwe,target,rateFor,intent:'full'});quoted=intent==='full'?full:partial?quotePair({youOwe,theyOwe,target,rateFor,intent,cashMinor:BigInt(parseMajorAmount(partial,target))}):null}}catch(cause){quoteError=cause instanceof Error?cause.message:'invalid_amount'}
  const summary=pageMode==='summary'||(!isReview&&full?.ok&&full.direction==='collect')
  const canReview=isReview&&review?.status==='pending'&&review.counterparty_participant_id===self
  const canPay=!isReview&&!summary&&canPropose&&full?.ok&&(full.direction==='pay'||full.direction==='offset')
  const needsAccount=!!(canReview&&review&&review.cash_minor>0||canPay&&full?.ok&&full.fullMinor>0n)
  const accountScope=self+':'+target
  const accounts=accountRead?.key===accountScope?accountRead.rows:[]
  const accountStatus=accountRead?.key===accountScope?accountRead.status:'loading'
  const accountValid=accountStatus==='ready'&&(batchCash?batchCash.every(c=>accounts.some(a=>a.id===batchAccounts[c.currency]&&a.currency===c.currency)):accounts.some(a=>a.id===accountId&&a.currency===target))
  const sources=pairExpenseSources(expenses,spaceId,self,other)
  const versions=pairExpenseVersions(expenses,spaceId,self,other)
  const sourceChanged=!!review?.quote.expenses?.some(v=>!expenses.some(e=>e.id===v.id&&e.version===v.version&&e.scope==='space'&&e.spaceId===spaceId&&e.status==='active'))
  const fingerprint=JSON.stringify({spaceId,other,target,mode,intent,partial,rates,accountId,versions,youOwe,theyOwe,snapshot:mode==='system'?fx.snapshot.id:null})
  request.current=settlementRequestId(request.current,fingerprint,generateId())
  const coverage=isReview?(review?.quote.coverages??[]).map(c=>({direction:c.direction==='payer_owes'?'they_owe':'you_owe',currency:c.currency,coveredMinor:BigInt(c.covered),remainingMinor:BigInt(c.remaining)})):quoted?.ok?quoted.coverages:[]
  const applications=sourceChanged?new Map<string,number>():pairCoverageApplications(expenses,settlements,spaceId,self,other,coverage)
  const net=isReview?review?.cash_minor:full?.ok?full.fullMinor:null
  const valued=(lines:MoneyLine[])=>{try{return valueLines(lines,target,rateFor).totalMinor}catch{return null}}
  const yours=valued(youOwe),theirs=valued(theyOwe)
  const original=(lines:MoneyLine[])=>lines.map(l=>display(l.amountMinor,l.currency)).join(' · ')||'—'
  useEffect(()=>{
    if(!needsAccount)return
    let active=true
    void loadQuickAccounts().then(rows=>{if(active)setAccountRead({key:accountScope,rows:rows.filter(a=>batchCash?batchCash.some(c=>c.currency===a.currency):a.currency===target),status:'ready'})},()=>{if(active)setAccountRead({key:accountScope,rows:[],status:'error'})})
    return()=>{active=false}
  },[needsAccount,target,self,accountRetry,accountScope,batchCash])
  useEffect(()=>{
    const viewport=window.visualViewport
    if(!viewport)return
    let frame=0
    const resize=()=>{dialog.current?.style.setProperty('--fx-height',viewport.height+'px');dialog.current?.style.setProperty('--fx-top',viewport.offsetTop+'px');const active=document.activeElement;if(active instanceof HTMLElement&&dialog.current?.contains(active)&&active.matches('input,select')){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>active.scrollIntoView({block:'nearest',behavior:'instant'}))}}
    resize();viewport.addEventListener('resize',resize);viewport.addEventListener('scroll',resize)
    return()=>{cancelAnimationFrame(frame);viewport.removeEventListener('resize',resize);viewport.removeEventListener('scroll',resize)}
  },[dialog])
  const refresh=async()=>{setError('');await Promise.all([fx.retry(true),onRefresh?.()])}
  const receipt=async()=>{
    if(!supabase||!request.current)return false
    const {data}=await supabase.from('settlement_fx_bundles').select('id').eq('client_request_id',request.current.id).eq('payer_participant_id',self).maybeSingle()
    return !!data
  }
  const submit=async()=>{
    if(!supabase||busyRef.current||!canPay||!quoted?.ok||!full?.ok)return
    busyRef.current=true;setBusy(true);setError('')
    try{
      if(await receipt()){await onDone();return}
      const {error:failure}=await supabase.rpc('propose_fx_settlement_bundle',{request_id:request.current!.id,target_space_id:spaceId,counterparty_id:other,target_currency:target,rate_mode:mode,custom_rates:mode==='custom'?rates:{},cash_minor:Number(quoted.cashMinor),payer_account_id:quoted.cashMinor>0n?accountId||null:null,expected_snapshot_id:mode==='system'?fx.snapshot.id:null,expected_expenses:versions,expected_full_minor:Number(full.fullMinor),payment_intent:intent})
      if(failure){if(await receipt()){await onDone();return}throw failure}
      await onDone()
    }catch(cause){setError(cause&&typeof cause==='object'&&'message'in cause?String(cause.message):'network_error')}finally{busyRef.current=false;setBusy(false)}
  }
  const respond=async(response:'accepted'|'declined')=>{
    if(!supabase||busyRef.current||!review||!canReview)return
    busyRef.current=true;setBusy(true);setError('')
    try{const {error:failure}=await (batchCash?supabase.rpc('respond_trip_batch_child',{target_bundle_id:review.id,response,expected_version:review.version,receiver_accounts:response==='accepted'?batchAccounts:{}}):supabase.rpc('respond_fx_settlement_bundle',{target_bundle_id:review.id,response,expected_version:review.version,receiver_account_id:response==='accepted'&&review.cash_minor>0?accountId||null:null}));if(failure)throw failure;await onDone()}
    catch(cause){setError(cause&&typeof cause==='object'&&'message'in cause?String(cause.message):'network_error')}finally{busyRef.current=false;setBusy(false)}
  }
  const errorText=(code:string)=>/balance_changed|version_conflict|quote_changed/.test(code)?t('fx.quoteChanged'):t(friendlyErrorKey(new Error(code)))
  const title=t(isReview?'fx.reviewTitle':summary?'fx.summaryTitle':'fx.payTitle',{name:otherName})
  const rateRows=isReview?Object.entries({...review?.quote.rates,...(review?.quote.cashRate?{VND:review.quote.cashRate}:{})}).filter(([c])=>c!==target):foreign.map(code=>{
    let value=null;try{value=rateFor(code)}catch{/* Invalid custom input stays visible. */}
    return [code,{numerator:value?.n.toString()??'',denominator:value?.d.toString()??'',provider:mode==='system'?(fx.snapshot.rates[code]??fx.snapshot.rates[target])?.provider:undefined,rateDate:mode==='system'?(fx.snapshot.rates[code]??fx.snapshot.rates[target])?.rateDate:undefined,source:mode}]as const
  })
  const accountField=batchCash&&canReview?<div className="fx-account">{batchCash.map(c=><label key={c.currency}>{t('fx.receivedInto')} · {c.currency}<select aria-label={'Receive '+c.currency+' into'} value={batchAccounts[c.currency]??''} disabled={busy||accountStatus!=='ready'} onChange={e=>setBatchAccounts(a=>({...a,[c.currency]:e.target.value}))}><option value="">{t('fx.chooseAccount')}</option>{accounts.filter(a=>a.currency===c.currency).map(a=><option value={a.id} key={a.id}>{a.name} · {a.currency}</option>)}</select></label>)}{accountStatus==='error'?<p role="alert">{t('fx.accountError')} <button type="button" onClick={()=>setAccountRetry(n=>n+1)}>{t('common.retry')}</button></p>:null}</div>:needsAccount?<div className="fx-account"><label htmlFor="fx-account">{t(isReview?'fx.receivedInto':'fx.paidFrom')}</label>{accountStatus==='error'?<p role="alert">{t('fx.accountError')} <button type="button" onClick={()=>setAccountRetry(n=>n+1)}>{t('common.retry')}</button></p>:<select id="fx-account" value={accountId} disabled={busy||accountStatus!=='ready'} onChange={e=>setAccountId(e.target.value)}><option value="">{t(accountStatus==='loading'?'common.loading':'fx.chooseAccount')}</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select>}{accountStatus==='ready'&&!accounts.length?<p className="fx-muted">{t('fx.noAccount')}</p>:null}</div>:null
  return createPortal(<section ref={dialog} className="fx-settle-overlay" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} data-testid="pair-settlement" data-mode={isReview?'review':summary?'summary':'pay'}><div className="fx-frame">
    <header className="fx-header"><button type="button" className="fx-back" aria-label={t('tl.balances')} disabled={busy} onClick={close}>‹</button><div><h2>{title}</h2><p>{tripName??t('members.back')}</p></div></header>
    <div className="fx-settle-body" onFocusCapture={e=>{if(e.target instanceof HTMLElement&&e.target.matches('input,select')){const node=e.target;requestAnimationFrame(()=>node.scrollIntoView({block:'nearest'}))}}}>
      {isReview&&!review?<p role={bundleStatus==='loading'?'status':'alert'}>{t(bundleStatus==='loading'?'common.loading':'fx.bundleUnavailable')}</p>:<>
      <section className="fx-headline"><p>{t(isReview?'fx.reported':full?.ok&&full.direction==='collect'?'fx.netCollect':'fx.netPay')}</p><strong className="fx-net">{batchCash?batchCash.map(c=>display(c.amountMinor,c.currency)).join(' + '):net==null?t('tw.estimateUnavailable'):display(net)}</strong>{batchCash&&review?<p className="fx-muted">≈ {display(review.cash_minor)} · {t('tw.referenceEstimate')}</p>:null}</section>
      {!isReview?<section className="fx-contra"><div><span><strong>{t('fx.youOwe',{name:otherName})}</strong><small>{original(youOwe)}</small></span><b>{yours==null?'—':display(yours)}</b></div><div><span><strong>{t('fx.theyOwe',{name:otherName})}</strong><small>{original(theyOwe)}</small></span><b>{theirs==null?'—':display(theirs)}</b></div></section>:<p className="fx-muted">{t('fx.snapshotHelp')}</p>}
      <button type="button" className="fx-details-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{t('fx.included')} <span aria-hidden="true">{open?'⌃':'⌄'}</span></button>
      {open?<section className="fx-included">{sourceChanged?<p role="alert">{t('fx.sourceChanged')}</p>:<ul>{sources.map(row=><li key={row.expenseId}><strong>{row.expense.description??row.expense.currency}</strong><small>{formatDate(row.expense.occurredOn,lang)}</small><p>{t('fx.pairOriginal')} · {display(row.amountMinor,row.currency)}</p>{applications.has(row.expenseId)?<p>{t('fx.applied')} · {display(applications.get(row.expenseId)!,row.currency)}</p>:null}</li>)}</ul>}<p className="fx-muted">{t('fx.previewHelp')}</p></section>:null}
      {open&&coverage.length?<section className="fx-coverage"><h3>{t('fx.sources')}</h3>{coverage.map(c=><div key={c.direction+c.currency}><span>{t(c.direction==='you_owe'?'fx.pay':'fx.collect')} · {c.currency}</span><span>{display(c.coveredMinor,c.currency)}<small>{t('fx.remaining')} {display(c.remainingMinor,c.currency)}</small></span></div>)}</section>:null}
      <section className="fx-rates"><h3>{t('fx.exchangeRate')}</h3>{!isReview&&pageMode==='pay'?<div className="fx-segment" role="group" aria-label={t('fx.exchangeRate')}>{(['system','custom']as const).map(v=><button key={v} type="button" aria-pressed={mode===v} disabled={busy} onClick={()=>{setMode(v);setError('')}}>{t(v==='system'?'fx.system':'fx.custom')}</button>)}</div>:null}
      {!isReview&&pageMode==='pay'&&mode==='custom'?foreign.map(code=><label className="fx-rate-input" key={code}><span>1 {target} =</span><AmountInput aria-label={code} value={rates[code]??''} onValueChange={value=>setRates(r=>({...r,[code]:value}))} disabled={busy}/><span>{code}</span></label>):rateRows.map(([code,r])=><p className="fx-rate-value" key={code}>1 {target} = {rateDisplay(r.numerator,r.denominator)} {code}{r.provider||r.rateDate?<small>{[r.provider,r.rateDate].filter(Boolean).join(' · ')}</small>:null}</p>)}
      {!isReview?<><div className="fx-rate-meta"><p className="fx-muted">{t('tw.referenceEstimate')} · {fx.snapshot.status}{fx.snapshot.fetchedAt?' · '+fx.snapshot.fetchedAt.slice(0,10):''}</p><button type="button" className="fx-text" disabled={busy||fx.updating} onClick={()=>void refresh()}>{t('fx.refreshQuote')}</button></div>{!full?.ok?<p className="fx-muted" role="status">{t(fx.updating?'common.loading':'fx.rateUnavailable')}</p>:null}</>:null}</section>
      {canPay?<section className="fx-payment"><h3>{t('fx.payment')}</h3><div className="fx-segment" role="group" aria-label={t('fx.payment')}>{(['full','partial']as const).map(v=><button key={v} type="button" aria-pressed={intent===v} disabled={busy||full?.ok&&full.direction==='offset'} onClick={()=>{setIntent(v);setError('')}}>{t(v==='full'?'fx.full':'fx.partial')}</button>)}</div>{intent==='partial'?<label className="fx-partial"><span>{target==='MYR'?'RM':target}</span><AmountInput aria-label={t('fx.partial')} value={partial} onValueChange={setPartial} disabled={busy}/></label>:null}{intent==='partial'&&quoted?.ok?<p className="fx-muted">{t('fx.remaining')} ≈ {display(quoted.fullMinor-quoted.cashMinor)}</p>:null}{accountField}<p className="fx-muted">{t(full?.ok&&full.direction==='offset'?'fx.offsetHelp':'fx.confirmHelp',{name:otherName})}</p></section>:summary?<p className="fx-awaiting">{t('fx.awaitingReporter',{name:otherName})}</p>:null}
      {canReview?accountField:null}{sourceChanged&&isReview?<p role="alert" className="fx-error">{t('fx.sourceChanged')}</p>:null}
      {quoteError||error?<div role="alert" className="fx-error"><p>{errorText(quoteError||error)}</p>{/balance_changed|version_conflict|quote_changed/.test(error)?<button type="button" disabled={busy} onClick={()=>void refresh()}>{t('fx.refreshQuote')}</button>:null}</div>:null}
      </>}
    </div>
    {canReview?<footer className="fx-footer"><div className="fx-review-actions"><button type="button" className="fx-secondary" disabled={busy} onClick={()=>void respond('declined')}>{t('common.decline')}</button><button type="button" className="fx-primary" disabled={busy||sourceChanged||review!.cash_minor>0&&!accountValid} onClick={()=>void respond('accepted')}>{t('settlement.confirmReceived')}</button></div></footer>:!isReview&&pageMode==='pay'&&!summary?<footer className="fx-footer"><button type="button" className="fx-primary" disabled={busy||!canPay||!quoted?.ok||quoted.cashMinor>0n&&!accountValid} onClick={()=>void submit()}>{t(full?.ok&&full.direction==='offset'?'fx.offset':'fx.record')}</button><small>{t('fx.recordHelp')}</small></footer>:null}
  </div></section>,document.getElementById('root')??document.body)
}
