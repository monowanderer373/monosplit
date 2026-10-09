import { supabase } from './supabase'
import { ledgerRepository } from './ledgerRepository'
import { personRepository } from './personRepository'
import { spaceRepository } from './spaceRepository'
import { settlementRepository, type SettlementPayment } from './settlementRepository'
import { loadPersonalAccountHome, readAllPages } from './personalAccountReadRepository'
import { assertMinorAmount, parseMajorAmount } from './money'
import { buildCollectPayItems, financialFingerprint, previewCollectPayReceipt, resolveCollectPayPreview, type CollectPayItem,
  type CollectPaySnapshot, type CashLeg, type PaymentRequest } from './collectPay'
import type { OverpayDisposition, SettlementIntent } from './settlementIntent'

export class CollectPayRpcError extends Error {
  readonly definitive: boolean
  constructor(message: string, definitive: boolean) { super(message); this.definitive = definitive }
}
export class CollectPaySaveError extends Error {
  readonly retrySameInput: boolean
  constructor(message: string, retrySameInput: boolean) { super(message); this.retrySameInput = retrySameInput }
}
function client() { if (!supabase) throw new Error('not_configured'); return supabase }
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await client().rpc(name, args)
  if (error) throw new CollectPayRpcError(error.message, Boolean(error.code))
  return data
}
function minor(value: unknown): number { return assertMinorAmount(Number(value), { allowZero: true }) }
async function rows(table: string, select: string) {
  return readAllPages(async (from, to) => {
    const result = await client().from(table).select(select).order('id').range(from, to)
    if (result.error) throw new Error(result.error.message)
    return (result.data ?? []) as unknown as Record<string, unknown>[]
  })
}
export const collectPayRepository = {
  async load(owner: string): Promise<CollectPaySnapshot> {
    const [expenses, payments, people, spaces, accounts, requestRows, legs, metadata] = await Promise.all([
      ledgerRepository.listExpenses(), settlementRepository.listSettlements(), personRepository.listPeople(),
      spaceRepository.list(), loadPersonalAccountHome(),
      rows('settlement_payment_requests', '*'), rows('personal_settlement_cash_legs', '*'),
      rows('settlement_payments', 'id,cash_tracking_required,overpay_disposition,source_payment_request_id,expected_outstanding_minor'),
    ])
    const members = await Promise.all(spaces.map(s => spaceRepository.listMembers(s.space.id)))
    const accountParticipantIds = [...new Set(members.flatMap(group => group.filter(m => m.participant.kind === 'account').map(m => m.participant.id)))]
    return { owner, accountParticipantIds, expenses, payments, people, spaces, accounts: accounts.accounts,
      cashTrackedPaymentIds: metadata.filter(p => p.cash_tracking_required).map(p => String(p.id)),
      paymentIntents: Object.fromEntries(metadata.map(p => [String(p.id), { overpay: p.overpay_disposition as OverpayDisposition | null,
        sourceRequestId: p.source_payment_request_id as string | null,
        expectedOutstandingMinor: p.expected_outstanding_minor == null ? null : minor(p.expected_outstanding_minor) }])),
      requests: requestRows.map((r): PaymentRequest => ({ id: String(r.id), clientRequestId: String(r.client_request_id),
        scope: r.scope as PaymentRequest['scope'], spaceId: r.space_id as string | null,
        debtorParticipantId: String(r.debtor_participant_id), creditorParticipantId: String(r.creditor_participant_id),
        currency: String(r.currency), amountMinor: minor(r.amount_minor), status: r.status as PaymentRequest['status'],
        note: r.note as string | null, version: Number(r.version), createdAt: String(r.created_at) })),
      cashLegs: legs.map((r): CashLeg => ({ id: String(r.id), allocationId: String(r.settlement_allocation_id),
        accountId: String(r.account_id), currency: String(r.account_currency), amountMinor: minor(r.cash_amount_minor),
        status: r.status as CashLeg['status'], role: r.role as CashLeg['role'] })),
    }
  },
  async directOutstanding(other: string, currency: string) {
    const data = await rpc('get_direct_outstanding', { target_counterparty_id: other, currency_code: currency })
    if (!data || data.currency !== currency || !Number.isSafeInteger(Number(data.signed_outstanding_minor))) throw new Error('financial_invariant_violation')
    return Number(data.signed_outstanding_minor)
  },
  async request(item: CollectPayItem, requestId: string, amountMinor: number, note: string) {
    const data = await rpc('create_settlement_payment_request', { request_id: requestId, target_debtor_id: item.otherId,
      request_scope: item.context.scope, target_space_id: item.context.scope === 'space' ? item.context.spaceId : null,
      currency_code: item.currency, requested_amount_minor: amountMinor, request_note: note.trim() || null, request_expires_at: null })
    if (!data || typeof data.payment_request_id !== 'string') throw new Error('financial_invariant_violation')
    return data.payment_request_id as string
  },
  async propose(item: CollectPayItem, input: { requestId: string; amountMinor: number; date: string; note: string;
    overpay: OverpayDisposition | null; sourceRequestId: string | null }) {
    // Existing Phase 6 overload adds the authoritative direct-net guard and cash tracking.
    const data = await rpc('propose_settlement', { request_id: input.requestId, settlement_scope: item.context.scope,
      target_space_id: item.context.scope === 'space' ? item.context.spaceId : null, currency_code: item.currency,
      total_amount_minor: input.amountMinor, payment_date: input.date, creditor_ids: [item.otherId],
      allocation_amounts: [input.amountMinor], settlement_note: input.note.trim() || null,
      overpay_disposition: input.overpay, expected_outstanding_minor: item.remainingMinor,
      selected_expense_ids: null, attribution_amounts: null, source_payment_request_id: input.sourceRequestId })
    if (typeof data !== 'string') throw new Error('financial_invariant_violation')
    return data
  },
  async authorize(input: { requestId: string; allocationId: string; role: 'payer' | 'receiver'; accountId: string; cashMinor: number | null }) {
    const data = await rpc('authorize_personal_settlement_cash_leg', { request_id: input.requestId,
      target_allocation_id: input.allocationId, cash_role: input.role, target_account_id: input.accountId,
      supplied_cash_amount_minor: input.cashMinor })
    if (!data || typeof data.cash_leg_id !== 'string') throw new Error('financial_invariant_violation')
    return data
  },
  payments: () => settlementRepository.listSettlements(),
  respond: settlementRepository.respondToAllocation.bind(settlementRepository),
  cancel: settlementRepository.cancelPendingAllocation.bind(settlementRepository),
  reverse: settlementRepository.reverseAllocation.bind(settlementRepository),
  async cancelRequest(id: string, version: number) {
    await rpc('cancel_settlement_payment_request', { target_request_id: id, expected_version: version })
  },
}

export type CollectPayFormInput = { intent: SettlementIntent; partialAmount: string; overpay: OverpayDisposition | null;
  accountId: string; cashAmount: string; date: string; note: string; sourceRequestId: string | null }
export type CollectPayPreview = { item: CollectPayItem; input: CollectPayFormInput; fingerprint: string;
  sharedAmountMinor: number; cashAmountMinor: number; remainingAfterMinor: number; accountCurrency: string | null }
export type CollectPayAttempt = { requestId: string; cashRequestId: string }

export function createCollectPayService(repository = collectPayRepository) {
  async function checked(owner: string, key: string) {
    const snapshot = await repository.load(owner)
    const item = buildCollectPayItems(snapshot).find(i => i.key === key)
    if (!item) throw new Error('balance_changed')
    if (item.context.scope === 'direct') {
      const signed = await repository.directOutstanding(item.otherId, item.currency)
      const remaining = item.direction === 'pay' ? signed : -signed
      if (Math.max(0, remaining) !== item.remainingMinor) throw new Error('balance_changed')
    }
    return { snapshot, item }
  }
  return {
    load: repository.load,
    async preview(owner: string, key: string, input: CollectPayFormInput): Promise<CollectPayPreview> {
      const { snapshot, item } = await checked(owner, key)
      if (!item.canPay) throw new Error('permission_denied')
      const proposal = resolveCollectPayPreview(item, { intent: input.intent, partialAmount: input.partialAmount,
        overpayDisposition: input.overpay })
      let cashAmountMinor = proposal.cashAmountMinor
      let accountCurrency: string | null = null
      if (item.direction === 'pay') {
        if (!item.canPay) throw new Error('permission_denied')
        const account = snapshot.accounts.find(a => a.id === input.accountId && a.accountClass === 'asset' && !a.archived)
        if (!account) throw new Error('settlement_cash_account_invalid')
        accountCurrency = account.currency
        if (account.currency !== item.currency) {
          if (input.overpay === 'gift') throw new Error('gift_cash_must_match_settlement_currency')
          cashAmountMinor = parseMajorAmount(input.cashAmount, account.currency)
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date) throw new Error('invalid_payment_date')
      }
      return { item, input: { ...input }, fingerprint: financialFingerprint(snapshot, item),
        sharedAmountMinor: proposal.sharedAmountMinor, cashAmountMinor,
        remainingAfterMinor: proposal.remainingAfterMinor, accountCurrency }
    },
    async save(owner: string, preview: CollectPayPreview, attempt: CollectPayAttempt): Promise<{ kind: 'requested' | 'pending' | 'confirmed'; id: string }> {
      // Until a successful read reconciles this request, a previous network attempt
      // may have committed. Never unlock a new request ID after an uncertain read.
      let uncertain = true, recorded = false
      async function firstWrite<T>(work: () => Promise<T>) {
        uncertain = true
        try { return await work() }
        catch (cause) {
          if (!recorded && cause instanceof CollectPayRpcError && cause.definitive) uncertain = false
          throw cause
        }
      }
      try {
        // Reconcile a committed proposal first. A failed account authorization must not create another payment.
        if (preview.item.direction === 'collect') {
          const fresh = await repository.load(owner)
          const recorded = fresh.requests.find(r => r.clientRequestId === attempt.requestId && r.creditorParticipantId === owner)
          if (recorded) {
            if (recorded.debtorParticipantId !== preview.item.otherId || recorded.currency !== preview.item.currency
              || recorded.scope !== preview.item.context.scope || recorded.spaceId !== (preview.item.context.scope === 'space' ? preview.item.context.spaceId : null)
              || recorded.amountMinor !== preview.sharedAmountMinor || recorded.note !== (preview.input.note.trim() || null)) throw new Error('idempotency_conflict')
            return { kind: 'requested', id: recorded.id }
          }
        }
        const existing = (await repository.payments()).find(p => p.clientRequestId === attempt.requestId && p.debtorParticipantId === owner)
        recorded = Boolean(existing); uncertain = recorded
        const { snapshot, item } = existing ? { snapshot: await repository.load(owner), item: preview.item }
          : await checked(owner, preview.item.key)
        if (!existing && financialFingerprint(snapshot, item) !== preview.fingerprint) throw new Error('balance_changed')
        if (item.direction === 'collect') {
          const id = await firstWrite(() => repository.request(item, attempt.requestId, preview.sharedAmountMinor, preview.input.note))
          return { kind: 'requested', id }
        }
        const account = snapshot.accounts.find(a => a.id === preview.input.accountId && a.accountClass === 'asset' && !a.archived)
        if (!account || account.currency !== preview.accountCurrency) throw new Error('settlement_cash_account_invalid')
        const id = existing?.id ?? await firstWrite(() => repository.propose(item, { requestId: attempt.requestId,
          amountMinor: preview.sharedAmountMinor, date: preview.input.date, note: preview.input.note,
          overpay: preview.input.overpay, sourceRequestId: preview.input.sourceRequestId }))
        recorded = true; uncertain = true
        const savedIntent = snapshot.paymentIntents?.[id]
        if (savedIntent && (savedIntent.overpay !== preview.input.overpay || savedIntent.sourceRequestId !== preview.input.sourceRequestId)) throw new Error('idempotency_conflict')
        const payment = existing ?? (await repository.payments()).find(p => p.id === id)
        const allocation = payment?.allocations.find(a => a.creditorParticipantId === item.otherId)
        if (!payment || !allocation || payment.currency !== item.currency || allocation.amountMinor !== preview.sharedAmountMinor
          || payment.scope !== item.context.scope || payment.spaceId !== (item.context.scope === 'space' ? item.context.spaceId : null)
          || payment.amountMinor !== preview.sharedAmountMinor || payment.allocations.length !== 1 || payment.paymentDate !== preview.input.date || payment.note !== (preview.input.note.trim() || null)) throw new Error('idempotency_conflict')
        if (allocation.state === 'accepted') {
          const leg = snapshot.cashLegs.find(l => l.allocationId === allocation.id && l.role === 'payer')
          if (!leg || leg.status !== 'posted' || leg.accountId !== account.id || leg.currency !== preview.accountCurrency
            || leg.amountMinor !== preview.cashAmountMinor) throw new Error('idempotency_conflict')
          return { kind: 'confirmed', id }
        }
        if (allocation.state !== 'pending') throw new Error('allocation_not_pending')
        await repository.authorize({ requestId: attempt.cashRequestId, allocationId: allocation.id, role: 'payer',
          accountId: preview.input.accountId, cashMinor: preview.cashAmountMinor })
        return { kind: 'pending', id }
      } catch (cause) {
        throw new CollectPaySaveError(cause instanceof Error ? cause.message : 'unknown_error', uncertain)
      }
    },
    async confirmReceived(owner: string, payment: SettlementPayment, allocationId: string, accountId: string, requestId: string, expectedFingerprint: string) {
      const snapshot = await repository.load(owner)
      const item = buildCollectPayItems(snapshot).find(i => i.direction === 'collect' && i.currency === payment.currency
        && i.otherId === payment.debtorParticipantId && i.context.scope === payment.scope
        && (i.context.scope === 'direct' ? payment.spaceId == null : i.context.spaceId === payment.spaceId))
      if (!item || financialFingerprint(snapshot, item) !== expectedFingerprint) throw new Error('balance_changed')
      const fresh = snapshot.payments.find(p => p.id === payment.id)
      const allocation = fresh?.allocations.find(a => a.id === allocationId && a.creditorParticipantId === owner)
      if (!fresh || fresh.version !== payment.version || allocation?.state !== 'pending') throw new Error('version_conflict')
      previewCollectPayReceipt(snapshot, item, fresh.id, allocationId)
      if (snapshot.cashTrackedPaymentIds.includes(payment.id)) {
        if (!snapshot.accounts.some(a => a.id === accountId && a.accountClass === 'asset' && !a.archived)) throw new Error('settlement_cash_account_invalid')
        await repository.authorize({ requestId, allocationId, role: 'receiver', accountId, cashMinor: null })
      }
      return repository.respond(allocationId, 'accepted', fresh.version)
    },
    repository,
  }
}
export const collectPayService = createCollectPayService()
