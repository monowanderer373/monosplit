import type { CanonicalExpense, PersonRelationship } from '../types'
import { addMinor, deriveSharedPreviewContexts, type HomeAccount } from './homeView'
import { personPrincipalIds } from './personMoney'
import { deriveSignedRelationalPositions, type BalanceContext } from './relationalBalance'
import type { SettlementPayment } from './settlementRepository'
import type { SpaceWithRole } from './spaceRepository'
import { resolveSettlementProposal, type OverpayDisposition, type SettlementIntent } from './settlementIntent'

export type CollectPayDirection = 'collect' | 'pay'
export type PaymentRequest = {
  id: string; clientRequestId: string; scope: 'direct' | 'space'; spaceId: string | null
  debtorParticipantId: string; creditorParticipantId: string; currency: string; amountMinor: number
  status: 'open' | 'converted' | 'cancelled' | 'expired'; note: string | null; version: number; createdAt: string
}
export type CashLeg = {
  id: string; allocationId: string; accountId: string; currency: string; amountMinor: number
  status: 'pending' | 'posted' | 'reversed' | 'cancelled'; role: 'payer' | 'receiver'
}
export type CollectPaySnapshot = {
  owner: string; expenses: CanonicalExpense[]; payments: SettlementPayment[]; people: PersonRelationship[]
  spaces: SpaceWithRole[]; accounts: HomeAccount[]; requests: PaymentRequest[]; cashLegs: CashLeg[]
  cashTrackedPaymentIds: string[]; accountParticipantIds?: string[]
  paymentIntents?: Record<string, { overpay: OverpayDisposition | null; sourceRequestId: string | null; expectedOutstandingMinor?: number | null }>
}
export type CollectPayItem = {
  key: string; context: BalanceContext; source: 'friend' | 'group' | 'trip'; label: string
  otherId: string; otherName: string; personId: string | null; currency: string
  direction: CollectPayDirection; remainingMinor: number; originalNetMinor: number; confirmedNetMinor: number
  expenses: CanonicalExpense[]; payments: SettlementPayment[]; balancePayments: SettlementPayment[]; requests: PaymentRequest[]; canPay: boolean
}

export function scopeKey(context: BalanceContext): string {
  return context.scope === 'space' ? `space:${context.spaceId}` : 'direct'
}
export function itemKey(context: BalanceContext, otherId: string, currency: string, direction: CollectPayDirection): string {
  return JSON.stringify([scopeKey(context), otherId, currency.toUpperCase(), direction])
}
export function matchesPair(payment: Pick<SettlementPayment, 'scope' | 'spaceId' | 'debtorParticipantId'>,
  creditor: string, context: BalanceContext, owner: string, other: string): boolean {
  return payment.scope === context.scope
    && (context.scope === 'direct' ? payment.spaceId == null : payment.spaceId === context.spaceId)
    && ((payment.debtorParticipantId === owner && creditor === other)
      || (payment.debtorParticipantId === other && creditor === owner))
}

/** One row per real settlement scope/pair/currency; expenses only explain its sources. */
export function buildCollectPayItems(snapshot: CollectPaySnapshot): CollectPayItem[] {
  const { owner, expenses, payments, people, spaces, requests } = snapshot
  const names = new Map<string, string>()
  const personByParticipant = new Map<string, PersonRelationship>()
  for (const expense of expenses) for (const p of expense.participations) names.set(p.participantId, p.nameSnapshot)
  for (const person of people) for (const id of personPrincipalIds(person)) {
    names.set(id, person.displayName); personByParticipant.set(id, person)
  }
  const contexts: BalanceContext[] = []
  const directIds = new Set(expenses.filter(e => e.scope === 'direct').flatMap(e => e.participations.map(p => p.participantId)))
  for (const payment of payments.filter(p => p.scope === 'direct')) {
    directIds.add(payment.debtorParticipantId); payment.allocations.forEach(a => directIds.add(a.creditorParticipantId))
  }
  for (const r of requests.filter(r => r.scope === 'direct')) { directIds.add(r.debtorParticipantId); directIds.add(r.creditorParticipantId) }
  for (const id of directIds) if (id !== owner) contexts.push({ scope: 'direct', participantIds: [owner, id] })
  const spaceIds = new Set([...spaces.map(s => s.space.id), ...expenses.flatMap(e => e.spaceId ? [e.spaceId] : []),
    ...payments.flatMap(p => p.spaceId ? [p.spaceId] : [])])
  for (const spaceId of spaceIds) contexts.push({ scope: 'space', spaceId })
  const result: CollectPayItem[] = []
  for (const context of contexts) {
    const positions = deriveSignedRelationalPositions(expenses, payments, context)
    const candidates = new Map<string, { other: string; currency: string }>()
    for (const position of positions) {
      if (![position.lowerParticipantId, position.higherParticipantId].includes(owner)) continue
      const other = position.lowerParticipantId === owner ? position.higherParticipantId : position.lowerParticipantId
      candidates.set(`${other}:${position.currency}`, { other, currency: position.currency })
    }
    for (const r of requests) if (matchesPair(r, r.creditorParticipantId, context, owner,
      r.debtorParticipantId === owner ? r.creditorParticipantId : r.debtorParticipantId)) {
      const other = r.debtorParticipantId === owner ? r.creditorParticipantId : r.debtorParticipantId
      candidates.set(`${other}:${r.currency}`, { other, currency: r.currency })
    }
    for (const payment of payments) for (const a of payment.allocations) {
      const other = payment.debtorParticipantId === owner ? a.creditorParticipantId : payment.debtorParticipantId
      if (matchesPair(payment, a.creditorParticipantId, context, owner, other)) candidates.set(`${other}:${payment.currency}`, { other, currency: payment.currency })
    }
    for (const { other, currency } of candidates.values()) {
      const position = positions.find(p => p.currency === currency && [p.lowerParticipantId, p.higherParticipantId].includes(other)
        && [p.lowerParticipantId, p.higherParticipantId].includes(owner))
      // Positive signedOwner means the current user owes the counterparty.
      const sign = position?.lowerParticipantId === owner ? 1 : -1
      const signedOwner = (position?.finalSignedMinor ?? 0) * sign
      for (const direction of ['collect', 'pay'] as const) {
        const factor = direction === 'pay' ? 1 : -1
        const pairPayments = payments.filter(p => p.currency === currency && p.allocations.some(a =>
          matchesPair(p, a.creditorParticipantId, context, owner, other)))
        const directionPayments = pairPayments.filter(p => direction === 'pay' ? p.debtorParticipantId === owner : p.debtorParticipantId === other)
        const pairRequests = requests.filter(r => r.currency === currency && matchesPair(r, r.creditorParticipantId, context, owner, other)
          && (direction === 'pay' ? r.debtorParticipantId === owner : r.creditorParticipantId === owner))
        const remainingMinor = signedOwner * factor > 0 ? signedOwner * factor : 0
        if (remainingMinor === 0 && directionPayments.length === 0 && pairRequests.length === 0) continue
        const person = personByParticipant.get(other)
        const space = context.scope === 'space' ? spaces.find(s => s.space.id === context.spaceId) : null
        const relatedExpenses = expenses.filter(e => e.currency.toUpperCase() === currency
          && e.scope === context.scope && (context.scope === 'direct' ? e.spaceId == null : e.spaceId === context.spaceId)
          && (context.scope === 'space' || [owner, other].every(id => e.participations.some(p => p.participantId === id))))
        const originalNetMinor = (position?.expenseSignedMinor ?? 0) * sign * factor
        result.push({ key: itemKey(context, other, currency, direction), context, otherId: other,
          source: space?.space.type ?? 'friend', label: space?.space.name ?? '',
          otherName: names.get(other) ?? '', personId: person?.id ?? null, currency, direction, remainingMinor,
          originalNetMinor, confirmedNetMinor: addMinor(originalNetMinor, -signedOwner * factor),
          expenses: relatedExpenses, payments: directionPayments, balancePayments: pairPayments, requests: pairRequests,
          canPay: context.scope === 'direct' ? Boolean(person?.linkedParticipantId === other) : Boolean(space && space.space.status !== 'voided' && snapshot.accountParticipantIds?.includes(other)),
        })
      }
    }
  }
  return result.sort((a, b) => a.otherName.localeCompare(b.otherName) || a.key.localeCompare(b.key))
}

export function collectPayTotals(items: readonly CollectPayItem[]) {
  const totals = new Map<string, number>()
  for (const item of items) totals.set(item.currency, addMinor(totals.get(item.currency) ?? 0, item.remainingMinor))
  return [...totals].map(([currency, amountMinor]) => ({ currency, amountMinor }))
}
export function collectPayPreviews(snapshot: CollectPaySnapshot) {
  const previews = deriveSharedPreviewContexts({ ownerParticipantId: snapshot.owner, expenses: snapshot.expenses,
    people: snapshot.people.map(p => ({ id: p.id, displayName: p.displayName, participantIds: personPrincipalIds(p) })) })
  // The home helper covers expenses created by the current user. Incoming pending
  // participation also needs a visible confirmation entry, without calling it confirmed debt.
  for (const expense of snapshot.expenses) {
    if (expense.scope !== 'direct' || expense.status !== 'active'
      || !expense.participations.some(p => p.participantId === snapshot.owner && p.state === 'pending')) continue
    for (const other of expense.participations.filter(p => p.participantId !== snapshot.owner)) {
      const person = snapshot.people.find(p => personPrincipalIds(p).includes(other.participantId))
      previews.push({ id: `incoming:${expense.id}:${other.participantId}`, source: 'friend', label: person?.displayName ?? other.nameSnapshot,
        personId: person?.id ?? null, spaceId: null, lines: [], status: 'pending', description: expense.description ?? '' })
    }
  }
  return previews
}
export function financialFingerprint(snapshot: CollectPaySnapshot, item: CollectPayItem): string {
  return JSON.stringify({ owner: snapshot.owner, key: item.key,
    expenses: item.expenses.map(e => [e.id, e.version, e.status, e.updatedAt]).sort(),
    payments: snapshot.payments.filter(p => p.currency === item.currency && p.allocations.some(a =>
      matchesPair(p, a.creditorParticipantId, item.context, snapshot.owner, item.otherId)))
      .map(p => [p.id, p.version, p.updatedAt]).sort(), remaining: item.remainingMinor })
}
export function resolveCollectPayPreview(item: CollectPayItem, input: {
  intent: SettlementIntent; partialAmount: string; overpayDisposition?: OverpayDisposition | null
}) {
  if (item.remainingMinor <= 0) throw new Error('no_outstanding_debt')
  if (item.context.scope === 'space' && input.overpayDisposition) throw new Error('overpay_direct_only')
  if (item.direction === 'collect' && input.overpayDisposition) throw new Error('amount_exceeds_outstanding_balance')
  const proposal = resolveSettlementProposal({ ...input, outstandingMinor: item.remainingMinor, currency: item.currency })
  return { ...proposal, remainingAfterMinor: addMinor(item.remainingMinor, -proposal.sharedAmountMinor) }
}

/** Simulate confirmation with the existing relational engine, within the same immutable scope/pair/currency. */
export function previewCollectPayReceipt(snapshot: CollectPaySnapshot, item: CollectPayItem, paymentId: string, allocationId: string) {
  const payment = snapshot.payments.find(p => p.id === paymentId)
  const allocation = payment?.allocations.find(a => a.id === allocationId)
  if (!payment || !allocation || allocation.state !== 'pending' || item.direction !== 'collect'
    || payment.currency !== item.currency || allocation.creditorParticipantId !== snapshot.owner
    || !matchesPair(payment, allocation.creditorParticipantId, item.context, snapshot.owner, item.otherId)) throw new Error('invalid_settlement_preview')
  if (item.context.scope === 'space' && snapshot.cashTrackedPaymentIds.includes(paymentId)
    && snapshot.paymentIntents?.[paymentId]?.expectedOutstandingMinor != null
    && allocation.amountMinor > item.remainingMinor) throw new Error('balance_changed')
  const payments = snapshot.payments.map(p => p.id !== paymentId ? p : { ...p,
    allocations: p.allocations.map(a => a.id === allocationId ? { ...a, state: 'accepted' as const } : a) })
  const position = deriveSignedRelationalPositions(snapshot.expenses, payments, item.context)
    .find(p => p.currency === item.currency && [p.lowerParticipantId, p.higherParticipantId].includes(snapshot.owner)
      && [p.lowerParticipantId, p.higherParticipantId].includes(item.otherId))
  const signed = (position?.finalSignedMinor ?? 0) * (position?.lowerParticipantId === snapshot.owner ? -1 : 1)
  return { amountMinor: allocation.amountMinor, remainingAfterMinor: signed }
}
