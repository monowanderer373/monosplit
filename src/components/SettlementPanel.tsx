import AmountInput from './AmountInput'
import { useMemo } from 'react'
import { useSettlementDraft } from '../hooks/useSettlementDraft'
import { useStore } from '../store/useStore'
import { localeForLang } from '../lib/locale'
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

type Props = {
  context: BalanceContext
  currentParticipantId: string
  participantNames: ReadonlyMap<string, string>
  expenses: readonly CanonicalExpense[]
  canPropose: boolean
  state?: ReturnType<typeof useSettlements>
  view?: 'trip-current' | 'trip-history'
  draftKey?: string
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

export default function SettlementPanel({
  context,
  currentParticipantId,
  participantNames,
  expenses,
  canPropose, state: sharedState, view, draftKey, onChanged,
}: Props) {
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
    return trip?rows.sort((a,b)=>Number(b.debtorParticipantId===currentParticipantId||b.creditorParticipantId===currentParticipantId)-Number(a.debtorParticipantId===currentParticipantId||a.creditorParticipantId===currentParticipantId)):rows
  }, [debtLines,trip,currentParticipantId])

  const incoming = contextSettlements.flatMap((settlement) => settlement.allocations
    .filter((allocation) => allocation.creditorParticipantId === currentParticipantId)
    .map((allocation) => ({ settlement, allocation })))
  const outgoingPending = contextSettlements.flatMap((settlement) => (
    settlement.debtorParticipantId === currentParticipantId
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

      {view==='trip-current'&&debts.length?<h3 className="tl-outstanding-title">{t('tl.outstanding')}</h3>:null}
      {view!=='trip-history'?<div className="ms-list tt-paper-list">
        {debts.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--ms-text-muted)]">{t('settlement.empty')}</p>
        ) : debts.map((debt, index) => {
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
                  <p className="mt-1 text-lg font-extrabold text-[var(--ms-accent)]">
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
      </div>:null}

      {!trip&&incoming.some(({ allocation }) => (
        allocation.state === 'accepted' && allocation.reversalMinor === 0
      )) ? (
        <div className="mt-4">
          <p className="text-xs font-extrabold text-[var(--ms-text-secondary)]">{t('settlement.receipts')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {incoming.filter(({ allocation }) => (
              allocation.state === 'accepted' && allocation.reversalMinor === 0
            )).map(({ settlement, allocation }) => (
              <button key={allocation.id} className="ms-btn-ghost py-2 text-xs" disabled={!!action||trip&&hidden} onClick={() => void reverse(allocation.id)}>
                {t('settlement.reverse', { amount: amount(allocation.amountMinor, settlement.currency) })}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view!=='trip-current'&&(!trip||!hidden)?<SettlementHistoryList
        context={context}
        currentParticipantId={currentParticipantId}
        participantNames={participantNames}
        expenses={expenses}
        settlements={trip?settlementState.settlements.filter(p=>settlementMatchesContext(p,context)):contextSettlements}
        renderAction={view==='trip-history'?(payment,allocation)=>allocation.creditorParticipantId===currentParticipantId&&allocation.state==='accepted'&&allocation.reversalMinor===0&&!allocation.sharedRestartCleared?<button type="button" className="ms-btn-ghost" disabled={!!action||hidden} onClick={()=>void reverse(allocation.id)}>{t('settlement.reverse',{amount:amount(allocation.amountMinor,payment.currency)})}</button>:null:undefined}
      />:null}

    </section>
  )
}
