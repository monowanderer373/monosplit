import AmountInput from './AmountInput'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInRouterContext } from 'react-router-dom'
import { useSettlementDraft } from '../hooks/useSettlementDraft'
import { useStore } from '../store/useStore'
import { localeForLang, formatDate } from '../lib/locale'
import type { CanonicalExpense } from '../types'
import { useSettlements } from '../hooks/useSettlements'
import { generateId } from '../lib/id'
import { formatMinorAmount } from '../lib/money'
import {
  deriveRelationalDebtLines,
  type BalanceContext,
  type ConfirmedSettlement,
} from '../lib/relationalBalance'
import {
  resolveSettlementAmount,
} from '../lib/settlementIntent'
import { friendlyErrorKey, useT, type TranslationKey } from '../lib/i18n'
import SettlementHistoryList from './SettlementHistoryList'
import TripBatchSettlement from './TripBatchSettlement'
import {readBatchRecovery,type BatchCandidate} from '../lib/tripBatchSettlement'
import TripRoutedSettlement from './TripRoutedSettlement'
import {RoutedSettlementList} from './RoutedSettlementList'
import { PairSettlementView } from './PairSettlementView'
import { supabase } from '../lib/supabase'
import { useRouteBackedOverlay } from '../hooks/useMoneyActionHistory'
import { useInsightsFx } from '../hooks/useInsightsFx'
import { useFxSettlementBundles } from '../hooks/useFxSettlementBundles'
import { pairLines, type PairPage } from '../lib/pairSettlement'
import { quotePair, systemForeignPerTarget } from '../lib/fxSettlement'
import { exactAmount } from '../lib/fx'
import { currencyExponent } from '../lib/money'

type Props = {
  context: BalanceContext
  currentParticipantId: string
  participantNames: ReadonlyMap<string, string>
  expenses: readonly CanonicalExpense[]
  canPropose: boolean
  state?: ReturnType<typeof useSettlements>
  view?: 'trip-current' | 'trip-history'
  historyCompletedOnly?: boolean
  draftKey?: string
  quoteCurrency?: string
  tripName?: string
  currentMemberIds?: ReadonlySet<string>
  onChanged?: () => Promise<unknown>
}

type DebtSummary = {
  debtorParticipantId: string
  creditorParticipantId: string
  currency: string
  remainingMinor: number
}

function settlementMatchesContext(
  settlement: ConfirmedSettlement,
  context: BalanceContext,
): boolean {
  if (context.scope === 'space') {
    return settlement.scope === 'space' && settlement.spaceId === context.spaceId
  }
  return settlement.scope === 'direct'
    && context.participantIds.includes(settlement.debtorParticipantId)
    && settlement.allocations.some((allocation) => context.participantIds.includes(allocation.creditorParticipantId))
}

type PairNavigation={value:PairPage|null;open:(value:PairPage)=>void;close:()=>void}
export default function SettlementPanel(props:Props){
  const routed=useInRouterContext()
  return routed&&props.view==='trip-current'?<RoutedTripSettlement {...props}/>:<SettlementPanelBody {...props}/>
}
function RoutedTripSettlement(props:Props){
  const pair=useRouteBackedOverlay<PairPage>('fx-pair:'+(props.context.scope==='space'?props.context.spaceId:'direct')+':'+props.view)
  return <SettlementPanelBody {...props} pairNavigation={pair}/>
}
function SettlementPanelBody({
  context,
  currentParticipantId,
  participantNames,
  expenses,
  canPropose, state: sharedState, view, draftKey, onChanged, historyCompletedOnly=false, quoteCurrency='MYR', tripName, currentMemberIds, pairNavigation,
}: Props & {pairNavigation?:PairNavigation}) {
  const t = useT()
  const ownState = useSettlements(!sharedState)
  const settlementState=sharedState??ownState
  const draft=useSettlementDraft(draftKey), {amounts,intents,action,error,expanded}=draft.value
  const setAmounts=(update:(value:typeof amounts)=>typeof amounts)=>draft.set({amounts:update(draft.get().amounts)})
  const setIntents=(update:(value:typeof intents)=>typeof intents)=>draft.set({intents:update(draft.get().intents)})
  const setAction=(action:string)=>draft.set({action}),setError=(error:TranslationKey|'')=>draft.set({error})
  const hidden=useStore(s=>s.homeUi.balanceHidden),lang=useStore(s=>s.lang), trip=!!view
  const amount=(minor:number,currency:string)=>trip&&hidden?'••••':formatMinorAmount(minor,currency,trip?localeForLang(lang):undefined)
  const requestId=(signature:string)=>{if(!trip)return generateId();let id=draft.attempts.get(signature);if(!id){id=generateId();draft.attempts.set(signature,id)}return id}

  const contextSettlements = useMemo(
    () => settlementState.settlements.map(p=>({...p,allocations:p.allocations.filter(a=>!a.sharedRestartCleared)})).filter(p=>p.allocations.length>0).filter((settlement) => (
      settlementMatchesContext(settlement, context)
    )),
    [context, settlementState.settlements],
  )
  const debtLines = useMemo(
    () => deriveRelationalDebtLines(
      expenses,
      contextSettlements as ConfirmedSettlement[],
      context,
    ),
    [context, contextSettlements, expenses],
  )
  const debts = useMemo(() => {
    const totals = new Map<string, DebtSummary>()
    for (const line of debtLines) {
      if (line.remainingMinor <= 0) continue
      const key = `${line.debtorParticipantId}:${line.creditorParticipantId}:${line.currency}`
      const current = totals.get(key) ?? {
        debtorParticipantId: line.debtorParticipantId,
        creditorParticipantId: line.creditorParticipantId,
        currency: line.currency,
        remainingMinor: 0,
      }
      current.remainingMinor += line.remainingMinor
      totals.set(key, current)
    }
    const rows=[...totals.entries()].map(([key, value]) => ({ key, ...value }))
    return trip?rows.filter(r=>r.debtorParticipantId===currentParticipantId||r.creditorParticipantId===currentParticipantId):rows
  }, [debtLines,trip,currentParticipantId])
  const fxRead=useFxSettlementBundles(currentParticipantId,context.scope==='space'?context.spaceId:undefined,trip&&!hidden,settlementState.settlements)
  const fxBundles=fxRead.rows
  const [legacyVisible,setLegacyVisible]=useState(false)
  const [localPair,setLocalPair]=useState<PairPage|null>(null)
  const pair=pairNavigation??{value:localPair,open:setLocalPair,close:()=>setLocalPair(null)}
  const [heldBatch,setHeldBatch]=useState<PairPage|null>(null)
  const batchSource=useRef<{actor:string;path:string;scroll:number;trigger:HTMLElement|null}|null>(null)
  const restoreBatchSource=useCallback(()=>{
    const source=batchSource.current;if(!source||source.actor!==currentParticipantId)return
    batchSource.current=null
    // Run after the dialog restores focus and the route restores its own entry.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(window.location.pathname+window.location.search+window.location.hash!==source.path)return
      const trigger=source.trigger?.isConnected?source.trigger:document.querySelector<HTMLElement>('[data-testid="trip-ledger"] [role="tab"][aria-selected="true"]')
      trigger?.focus({preventScroll:true});window.scrollTo({top:source.scroll,behavior:'instant'})
    }))
  },[currentParticipantId])
  const closeHeldBatch=useCallback(()=>{setHeldBatch(null);restoreBatchSource()},[restoreBatchSource])
  useEffect(()=>{if(pair.value?.mode==='batch')setHeldBatch(pair.value)},[pair.value])
  const openPair=(value:PairPage)=>{
    if(value.mode==='batch')batchSource.current={actor:currentParticipantId,path:window.location.pathname+window.location.search+window.location.hash,scroll:window.scrollY,trigger:document.activeElement instanceof HTMLElement?document.activeElement:null}
    else{setHeldBatch(null);batchSource.current=null}
    pair.open(value)
  }
  const fx=useInsightsFx(currentParticipantId,view==='trip-current'&&!hidden&&debts.some(d=>d.currency!==quoteCurrency||d.currency!=='MYR'))
  const otherIds=[...new Set([...debts.map(d=>d.debtorParticipantId===currentParticipantId?d.creditorParticipantId:d.debtorParticipantId),...fxBundles.filter(b=>b.status==='pending').map(b=>b.payer_participant_id===currentParticipantId?b.counterparty_participant_id:b.payer_participant_id)])]
  const pairs=otherIds.map(other=>{
    const lines=pairLines(debts,currentParticipantId,other)
    let quote:ReturnType<typeof quotePair>|null=null
    try{quote=quotePair({...lines,target:quoteCurrency,rateFor:c=>systemForeignPerTarget(c,quoteCurrency,fx.snapshot),intent:'full'})}catch{/* Error is shown as unavailable, never a zero estimate. */}
    return {other,...lines,quote,pending:fxBundles.find(b=>b.status==='pending'&&[b.payer_participant_id,b.counterparty_participant_id].includes(other)),currencies:[...new Set([...lines.youOwe,...lines.theyOwe].map(l=>l.currency))]}
  })
  const totalsKnown=pairs.every(p=>p.quote?.ok)
  const estimated=(n:bigint)=>hidden?'••••':`${quoteCurrency==='MYR'?'RM':quoteCurrency} ${exactAmount(n,currencyExponent(quoteCurrency),localeForLang(lang))}`
  const totalPay=pairs.reduce((n,p)=>n+(p.quote?.ok&&p.quote.direction==='pay'?p.quote.fullMinor:0n),0n)
  const totalCollect=pairs.reduce((n,p)=>n+(p.quote?.ok&&p.quote.direction==='collect'?p.quote.fullMinor:0n),0n)
  const batchCandidates:BatchCandidate[]=pairs.map(p=>({id:p.other,name:participantNames.get(p.other)??t('common.member'),youOwe:p.youOwe,theyOwe:p.theyOwe,
    blocked:!canPropose?'You cannot record payments in this trip':currentMemberIds&&!currentMemberIds.has(p.other)?'Not a current trip member':fxRead.status!=='ready'?'Payment status unavailable':p.pending||contextSettlements.some(s=>s.allocations.some(a=>a.state==='pending'&&((s.debtorParticipantId===currentParticipantId&&a.creditorParticipantId===p.other)||(s.debtorParticipantId===p.other&&a.creditorParticipantId===currentParticipantId))))?'Pending payment — review or cancel first':!fx.updating&&p.currencies.some(code=>code!=='MYR'&&code!=='VND'&&!systemForeignPerTarget(code,'MYR',fx.snapshot))?'System rate unavailable. Use single-currency settlement':undefined}))
  const batchQuotes=new Map(batchCandidates.map(c=>{let q:ReturnType<typeof quotePair>|null=null;try{q=quotePair({...c,target:'MYR',rateFor:code=>systemForeignPerTarget(code,'MYR',fx.snapshot),intent:'full'})}catch{/* Unpriced stays unavailable. */}return[c.id,q]as const}))
  const batchEligible=batchCandidates.filter(c=>{const q=batchQuotes.get(c.id);return !c.blocked&&q?.ok&&q.direction==='pay'})
  const batchUnpriced=batchCandidates.some(c=>!c.blocked&&c.youOwe.length>0&&!batchQuotes.get(c.id)?.ok&&[...c.youOwe,...c.theyOwe].every(l=>l.currency==='VND'||!!systemForeignPerTarget(l.currency,'MYR',fx.snapshot)))
  const batchNoPayments=pairs.every(p=>{const q=batchQuotes.get(p.other);return !p.youOwe.length||q?.ok&&q.direction!=='pay'})
  const batchPayTotal=batchEligible.reduce((sum,c)=>{const q=batchQuotes.get(c.id)!;return sum+(q.ok?q.fullMinor:0n)},0n)
  const recovery=context.scope==='space'?readBatchRecovery(currentParticipantId,context.spaceId):null
  const activePair=pair.value
  const batchPage=activePair?.mode==='batch'?activePair:heldBatch
  const activeBundle=activePair?.bundleId?fxBundles.find(b=>b.id===activePair.bundleId):null

  const incoming = contextSettlements.flatMap((settlement) => settlement.allocations
    .filter((allocation) => allocation.creditorParticipantId === currentParticipantId && !fxSettlementPayment(settlement))
    .map((allocation) => ({ settlement, allocation })))
  const outgoingPending = contextSettlements.flatMap((settlement) => (
    settlement.debtorParticipantId === currentParticipantId && !fxSettlementPayment(settlement)
      ? settlement.allocations
        .filter((allocation) => allocation.state === 'pending')
        .map((allocation) => ({ settlement, allocation }))
      : []
  ))

  const propose = async (debt: DebtSummary & { key: string }) => {
    if (draft.get().action || trip&&hidden) return
    setAction(debt.key)
    setError('')
    try {
      const amountMinor = resolveSettlementAmount({
        intent: intents[debt.key] ?? null,
        partialAmount: amounts[debt.key] ?? '',
        outstandingMinor: debt.remainingMinor,
        currency: debt.currency,
      })
      const signature='propose:'+JSON.stringify([context,debt.key,amountMinor])
      let paymentDate=new Date().toISOString().slice(0,10)
      if(trip){const saved=draft.attempts.get('day:'+signature);if(saved)paymentDate=saved;else draft.attempts.set('day:'+signature,paymentDate)}
      await settlementState.propose({
        requestId: requestId(signature),
        scope: context.scope,
        spaceId: context.scope === 'space' ? context.spaceId : null,
        currency: debt.currency,
        amountMinor,
        paymentDate,
        allocations: [{
          creditorParticipantId: debt.creditorParticipantId,
          amountMinor,
        }],
        note: null,
      })
      await onChanged?.()
      setAmounts((current) => ({ ...current, [debt.key]: '' }))
      setIntents((current) => ({ ...current, [debt.key]: undefined }))
    } catch (cause) {
      setError(friendlyErrorKey(trip&&typeof (cause as {message?:unknown})?.message==='string'?new Error((cause as {message:string}).message):cause))
    } finally {
      setAction('')
    }
  }

  const respond = async (allocationId: string, response: 'accepted' | 'declined') => {
    if (draft.get().action || trip&&hidden) return
    setAction(allocationId)
    setError('')
    try {
      await settlementState.respond(allocationId, response)
      await onChanged?.()
    } catch (cause) {
      setError(friendlyErrorKey(trip&&typeof (cause as {message?:unknown})?.message==='string'?new Error((cause as {message:string}).message):cause))
    } finally {
      setAction('')
    }
  }

  const reverse = async (allocationId: string) => {
    if (draft.get().action || trip&&hidden) return
    setAction(allocationId)
    setError('')
    try {
      await settlementState.reverse(allocationId, requestId('reverse:'+allocationId+':'+contextSettlements.find(p=>p.allocations.some(a=>a.id===allocationId))?.version))
      await onChanged?.()
    } catch (cause) {
      setError(friendlyErrorKey(trip&&typeof (cause as {message?:unknown})?.message==='string'?new Error((cause as {message:string}).message):cause))
    } finally {
      setAction('')
    }
  }

  const cancelPending = async (allocationId: string) => {
    if (draft.get().action || trip&&hidden) return
    setAction(allocationId)
    setError('')
    try {
      await settlementState.cancelPending(allocationId)
      await onChanged?.()
    } catch (cause) {
      setError(friendlyErrorKey(trip&&typeof (cause as {message?:unknown})?.message==='string'?new Error((cause as {message:string}).message):cause))
    } finally {
      setAction('')
    }
  }

  const cancelBundle = async (bundleId: string, version: number) => {
    if (!supabase || draft.get().action || hidden) return
    setAction(bundleId)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('cancel_fx_settlement_bundle', { target_bundle_id: bundleId, expected_version: version })
      if (rpcError) throw rpcError
      await onChanged?.()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const reverseBundle = async (bundleId: string, version: number) => {
    if (!supabase || draft.get().action || hidden) return
    setAction(bundleId)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('reverse_fx_settlement_bundle', { reversal_request_id: requestId('fx-reverse:'+bundleId), target_bundle_id: bundleId, expected_version: version })
      if (rpcError) throw rpcError
      await onChanged?.()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  return (
    <section className={trip?'tl-settlements':''} aria-busy={!!action}>
      {trip&&hidden?<button type="button" className="ms-btn-ghost" onClick={()=>useStore.getState().setHomeUi({balanceHidden:false})}>{t('notice.show')}</button>:null}
      {!trip?<div className="mb-3">
        <p className="ms-label">{t('settlement.confirmed')}</p>
        <h2 className="mt-1 text-xl font-extrabold">{t('settlement.title')}</h2>
        <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">
          {t('settlement.help')}
        </p>
      </div>:null}

      {(error || settlementState.error) ? (
        <p className="mb-3 rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2 text-sm text-[var(--ms-danger)]">
          {t(error || friendlyErrorKey(settlementState.error))}
        </p>
      ) : null}

      {view!=='trip-history'&&incoming.some(({ allocation }) => allocation.state === 'pending') ? (
        <div className="mb-4 grid gap-3" data-trip-pending="incoming" tabIndex={-1}>
          {incoming.filter(({ allocation }) => allocation.state === 'pending').map(({ settlement, allocation }) => (
            <article key={allocation.id} className="ms-card-hero">
              <p className="ms-label">{t('settlement.confirmation')}</p>
              <p className="mt-2 font-extrabold">
                {t('settlement.saysPaid', {
                  name: participantNames.get(settlement.debtorParticipantId) ?? t('common.member'),
                  amount: amount(allocation.amountMinor, settlement.currency),
                })}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button className="ms-btn-ghost" disabled={!!action||trip&&hidden} onClick={() => void respond(allocation.id, 'declined')}>{t('common.decline')}</button>
                <button className="ms-btn-primary" disabled={!!action||trip&&hidden} onClick={() => void respond(allocation.id, 'accepted')}>{t('settlement.confirmReceived')}</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {view!=='trip-history'&&outgoingPending.length > 0 ? (
        <div className="mb-4 grid gap-3">
          {outgoingPending.map(({ settlement, allocation }) => (
            <article key={allocation.id} className="ms-card">
              <p className="ms-label">{t('settlement.awaitingConfirmation')}</p>
              <p className="mt-2 text-sm font-bold">
                {t('settlement.youProposed', {
                  amount: amount(allocation.amountMinor, settlement.currency),
                  name: participantNames.get(allocation.creditorParticipantId) ?? t('common.member'),
                })}
              </p>
              <p className="mt-2 text-xs text-[var(--ms-text-muted)]">
                {t('settlement.cancelCreatesNewHelp')}
              </p>
              <button
                className="ms-btn-ghost mt-3 py-2 text-xs text-[var(--ms-danger)]"
                disabled={!!action||trip&&hidden}
                onClick={() => void cancelPending(allocation.id)}
              >
                {t('settlement.cancelProposal')}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {view==='trip-current'?<>
        {!hidden&&context.scope==='space'?<RoutedSettlementList actor={currentParticipantId} trip={context.spaceId} names={participantNames} canPropose={canPropose} onOpen={id=>openPair({other:'routed',mode:'routed',bundleId:id})}/>:null}
        <p className="fx-muted">{t('fx.estimatedIn',{currency:quoteCurrency})}</p>
        <div className="tw-balance-grid fx-estimated-summary" data-testid="pair-totals"><div><span>{t('fx.pay')}</span><strong>{totalsKnown?estimated(totalPay):t('tw.estimateUnavailable')}</strong></div><div><span>{t('fx.collect')}</span><strong>{totalsKnown?estimated(totalCollect):t('tw.estimateUnavailable')}</strong></div></div>
        {fxRead.status==='error'?<p role="alert">{t('tl.unavailable')} <button type="button" className="ms-btn-ghost" onClick={fxRead.retry}>{t('common.retry')}</button></p>:null}
        {!hidden&&(batchEligible.length>0||batchUnpriced||recovery)?<button type="button" className="batch-launch" disabled={!!action||fxRead.status!=='ready'} onClick={()=>openPair({other:'all',mode:'batch'})}>{recovery?'Check payment result':batchEligible.length?'Settle all · RM '+exactAmount(batchPayTotal,2,localeForLang(lang)):'Settle all'}</button>:!hidden&&batchNoPayments?<p className="batch-empty-pay">No payments due.</p>:null}
        <div className="fx-pair-list">{pairs.map(p=>{
          const name=participantNames.get(p.other)??t('common.member')
          const excluded=batchCandidates.find(c=>c.id===p.other)?.blocked
          const outgoing=p.quote?.ok?p.quote.direction!=='collect':p.youOwe.length>0
          return <article className="fx-pair-row" key={p.other}><div><h3>{name}</h3><small>{t(p.quote?.ok&&p.quote.direction==='collect'?'fx.owesYou':p.quote?.ok&&p.quote.direction==='offset'?'fx.offset':'fx.youOweShort')} · {p.currencies.join(' · ')}</small><p className="fx-pair-value">{p.pending?p.pending.quote.cashLegs?.map(l=>amount(l.amountMinor,l.currency)).join(' + ')??amount(p.pending.cash_minor,p.pending.target_currency):p.quote?.ok?'≈ '+estimated(p.quote.fullMinor):t('tw.estimateUnavailable')}</p></div>
          {p.pending?(p.pending.counterparty_participant_id===currentParticipantId?<button type="button" className="fx-pair-primary" disabled={hidden||fxRead.status!=='ready'} onClick={()=>openPair({other:p.other,mode:'review',bundleId:p.pending!.id})}>{t('fx.review')}</button>:<button type="button" disabled={!!action||hidden||fxRead.status!=='ready'} onClick={()=>void cancelBundle(p.pending!.id,p.pending!.version)}>{t('settlement.cancelProposal')}</button>):<button type="button" className={outgoing?'fx-pair-primary':''} disabled={hidden||fxRead.status!=='ready'||outgoing&&(!canPropose||!!excluded)} onClick={()=>openPair({other:p.other,mode:outgoing&&batchCandidates.find(c=>c.id===p.other)&&!batchCandidates.find(c=>c.id===p.other)?.blocked&&!(p.quote?.ok&&p.quote.direction==='offset')?'batch':outgoing?'pay':'summary'})}>{t(!p.quote?.ok&&outgoing?'fx.checkRates':outgoing?p.quote?.ok&&p.quote.direction==='offset'?'fx.offset':'fx.pay':'fx.summary')}</button>}
          {excluded&&!p.pending?<p className="fx-pair-status batch-excluded">{excluded}</p>:null}{!p.pending&&outgoing&&(p.currencies.length>1||!p.quote?.ok||!!excluded)?<button type="button" className="fx-legacy-link" disabled={hidden||!canPropose||fxRead.status!=='ready'} onClick={()=>openPair({other:p.other,mode:'pay'})}>Single-currency settlement</button>:null}{p.pending?<p className="fx-pair-status">{t('settlement.awaitingConfirmation')}</p>:p.quote?.ok&&p.quote.direction==='collect'?<p className="fx-pair-status">{t('tl.awaiting')}</p>:null}</article>
        })}</div>
      </>:null}
      {batchPage&&!hidden&&context.scope==='space'?<TripBatchSettlement key={currentParticipantId+':'+context.spaceId+':'+batchPage.other} nativeExit={!!heldBatch&&!!pairNavigation&&activePair?.mode!=='batch'} onNativeExit={closeHeldBatch} actor={currentParticipantId} trip={context.spaceId} tripName={tripName} candidates={batchCandidates} only={batchPage.other==='all'?undefined:batchPage.other} onClose={()=>{setHeldBatch(null);pair.close();restoreBatchSource()}} onChanged={async()=>{await onChanged?.();fxRead.retry()}}/>:null}
      {activePair?.mode==='routed'&&!hidden&&context.scope==='space'?<TripRoutedSettlement key={currentParticipantId+':'+context.spaceId+':'+(activePair.bundleId??'new')} actor={currentParticipantId} trip={context.spaceId} tripName={tripName} proposalId={activePair.bundleId} onClose={pair.close} onChanged={async()=>{await onChanged?.();fxRead.retry()}}/>:null}
      {activePair&&activePair.mode!=='batch'&&activePair.mode!=='routed'&&!hidden&&context.scope==='space'?<PairSettlementView key={activePair.other+activePair.mode+activePair.bundleId} self={currentParticipantId} other={activePair.other} otherName={participantNames.get(activePair.other)??t('common.member')} {...pairLines(debts,currentParticipantId,activePair.other)} target={quoteCurrency} spaceId={context.spaceId} tripName={tripName} expenses={expenses} settlements={contextSettlements} pageMode={activePair.mode} canPropose={canPropose} review={activeBundle} bundleStatus={fxRead.status} onClose={pair.close} onRefresh={onChanged} onDone={async()=>{pair.close();await onChanged?.();fxRead.retry()}}/>:null}
      {view!=='trip-history'?<div>{view==='trip-current'?<button type="button" className="ms-btn-ghost fx-legacy-options" aria-expanded={legacyVisible||!!expanded} onClick={()=>setLegacyVisible(v=>!v)}>Single-currency options</button>:null}<div className="ms-list tt-paper-list fx-legacy-native" hidden={view==='trip-current'&&!legacyVisible&&!expanded}>
        {debts.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--ms-text-muted)]">{t('settlement.empty')}</p>
        ) : debts.map((debt, index) => {
          const otherPerson=debt.debtorParticipantId===currentParticipantId?debt.creditorParticipantId:debt.debtorParticipantId
          if(view==='trip-current'&&(pairs.some(p=>p.other===otherPerson&&p.pending)||debts.some(row=>(row.debtorParticipantId===otherPerson||row.creditorParticipantId===otherPerson)&&row.currency!==debt.currency)))return null

          const mine = debt.debtorParticipantId === currentParticipantId
          const intent = intents[debt.key]
          let explicitAmount = ''
          if (intent) {
            try {
              explicitAmount = amount(resolveSettlementAmount({
                intent,
                partialAmount: amounts[debt.key] ?? '',
                outstandingMinor: debt.remainingMinor,
                currency: debt.currency,
              }), debt.currency)
            } catch {
              explicitAmount = ''
            }
          }
          return (
            <div key={debt.key}>
              {index > 0 ? <hr className="ms-divider" /> : null}
              <article className="ms-row tt-record-card items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">
                    {mine
                      ? t('settlement.youOwe', {
                        name: debt.creditorParticipantId === currentParticipantId
                          ? t('common.you')
                          : participantNames.get(debt.creditorParticipantId) ?? t('common.member'),
                      })
                      : t('settlement.personOwes', {
                        debtor: participantNames.get(debt.debtorParticipantId) ?? t('common.member'),
                        creditor: debt.creditorParticipantId === currentParticipantId
                          ? t('common.you')
                          : participantNames.get(debt.creditorParticipantId) ?? t('common.member'),
                      })}
                  </p>
                  <p data-money-tone={trip?'outstanding':undefined} className="mt-1 text-lg font-extrabold text-[var(--ms-accent)]">
                    {amount(debt.remainingMinor, debt.currency)}
                  </p>
                  {trip?<p className="tl-debt-help">{t(mine?'tl.fullPartial':'tl.awaiting')}</p>:null}
                </div>
                {mine && canPropose ? (
                  <div className={trip?'tl-pay-controls':'w-44'}>
                    {trip&&expanded!==debt.key?<button type="button" className="ms-btn-ghost" disabled={!!action||hidden} onClick={()=>draft.set({expanded:debt.key})}>{t('tl.repay')}</button>:null}
                    {(!trip||expanded===debt.key&&!hidden)?<>
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('settlement.chooseAmount')}>
                      {(['full', 'partial'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={intent === option ? 'ms-btn-primary py-2 text-xs' : 'ms-btn-ghost py-2 text-xs'}
                          aria-pressed={intent === option}
                          disabled={!!action}
                          onClick={() => {
                            setIntents((current) => ({ ...current, [debt.key]: option }))
                            setError('')
                          }}
                        >
                          {t(option === 'full' ? 'settlement.full' : 'settlement.partial')}
                        </button>
                      ))}
                    </div>
                    {intent === 'full' ? (
                      <p className="mt-2 rounded-xl bg-[var(--ms-bg-warm)] px-3 py-2 text-right text-sm font-extrabold">
                        {amount(debt.remainingMinor, debt.currency)}
                      </p>
                    ) : null}
                    {intent === 'partial' ? (
                      <AmountInput
                        className="ms-input mt-2 h-10 w-full text-right"
                        inputMode="decimal"
                        aria-label={t('settlement.amountFor', {
                          name: participantNames.get(debt.creditorParticipantId) ?? t('common.member'),
                        })}
                        placeholder={t('settlement.enterPartialAmount')}
                        value={amounts[debt.key] ?? ''}
                        onValueChange={raw => setAmounts((current) => ({
                          ...current,
                          [debt.key]: raw,
                        }))}
                      />
                    ) : null}
                    <button
                      className="ms-btn-primary mt-2 w-full py-2 text-xs"
                      disabled={action === debt.key || !intent}
                      onClick={() => void propose(debt)}
                    >
                      {explicitAmount
                        ? t('settlement.proposeExplicitAmount', { amount: explicitAmount })
                        : t('settlement.proposePaid')}
                    </button>
                    </>:null}
                  </div>
                ) : null}
              </article>
            </div>
          )
        })}
      </div></div>:null}

      {!trip&&incoming.some(({ allocation }) => (
        allocation.state === 'accepted' && allocation.reversalMinor === 0
      )) ? (
        <div className="mt-4">
          <p className="text-xs font-extrabold text-[var(--ms-text-secondary)]">{t('settlement.receipts')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incoming.filter(({ settlement, allocation }) => (
              !fxSettlementPayment(settlement) && allocation.state === 'accepted' && allocation.reversalMinor === 0
            )).map(({ settlement, allocation }) => (
              <button key={allocation.id} className="ms-btn-ghost py-2 text-xs" disabled={!!action||trip&&hidden} onClick={() => void reverse(allocation.id)}>
                {t('settlement.reverse', { amount: amount(allocation.amountMinor, settlement.currency) })}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view==='trip-history'&&!hidden&&context.scope==='space'?<RoutedSettlementList actor={currentParticipantId} trip={context.spaceId} names={participantNames} history onOpen={id=>openPair({other:'routed',mode:'routed',bundleId:id})}/>:null}
      {view==='trip-history'?<section className="fx-bundle-history" data-testid="fx-bundle-history">
        {fxRead.status==='loading'?<p role="status">{t('common.loading')}</p>:fxRead.status==='error'?<p role="alert">{t('tl.unavailable')} <button type="button" onClick={fxRead.retry}>{t('common.retry')}</button></p>:null}
        {fxBundles.filter(b=>b.status!=='pending').map(b=><article className="fx-bundle-fact" key={b.id}><strong>{participantNames.get(b.payer_participant_id===currentParticipantId?b.counterparty_participant_id:b.payer_participant_id)??t('common.member')} · {(b.quote.cashLegs?.map(l=>amount(l.amountMinor,l.currency)).join(' + ')??amount(b.cash_minor,b.target_currency))}</strong><p>{t(b.status==='accepted'?'history.settlementAccepted':b.status==='reversed'?'history.settlementReversed':b.status==='declined'?'history.settlementDeclined':'history.settlementProposalCancelled')}</p><small>{formatDate(b.created_at.slice(0,10),lang)}</small><details><summary>{t('tw.rates')}</summary>{Object.entries({...b.quote.rates,...(b.quote.cashRate?{VND:b.quote.cashRate}:{})}).filter(([code])=>code!==b.target_currency).map(([code,r])=><p key={code}>1 {b.target_currency} = {r.numerator}/{r.denominator} {code} · {[r.provider,r.rateDate,r.submittedAt?.slice(0,10)].filter(Boolean).join(' · ')}</p>)}{(b.quote.coverages??[]).map(c=><p key={c.direction+c.currency}>{c.currency} · {amount(c.covered,c.currency)} · {t('fx.remaining')} {amount(c.remaining,c.currency)}</p>)}</details>{b.status==='accepted'?<button type="button" className="ms-btn-ghost" disabled={!!action||hidden} onClick={()=>void reverseBundle(b.id,b.version)}>{t('settlement.reverse',{amount:(b.quote.cashLegs?.map(l=>amount(l.amountMinor,l.currency)).join(' + ')??amount(b.cash_minor,b.target_currency))})}</button>:null}</article>)}
        {fxRead.status==='ready'&&!fxBundles.some(b=>b.status!=='pending')&&!contextSettlements.some(p=>!fxSettlementPayment(p)&&p.allocations.some(a=>a.state!=='pending'))?<p className="tw-history-empty">{t('tl.noPayments')}</p>:null}
      </section>:null}
      {view!=='trip-current'&&(!trip||!hidden)?<SettlementHistoryList
        excludePending={historyCompletedOnly} compact={historyCompletedOnly} excludeBundleFacts={view==='trip-history'}
        context={context}
        currentParticipantId={currentParticipantId}
        participantNames={participantNames}
        expenses={expenses}
        settlements={trip?settlementState.settlements.filter(p=>settlementMatchesContext(p,context)):contextSettlements}
        renderAction={view==='trip-history'?(payment,allocation)=>!fxSettlementPayment(payment)&&allocation.creditorParticipantId===currentParticipantId&&allocation.state==='accepted'&&allocation.reversalMinor===0&&!allocation.sharedRestartCleared?<button type="button" className="ms-btn-ghost" disabled={!!action||hidden} onClick={()=>void reverse(allocation.id)}>{t('settlement.reverse',{amount:amount(allocation.amountMinor,payment.currency)})}</button>:null:undefined}
      />:null}

    </section>
  )
}

function fxSettlementPayment(payment: { fxCashOnly?: boolean; note?: string | null }) {
  return payment.fxCashOnly === true || payment.note === 'fx-cash' || payment.note === 'fx-coverage'
}
