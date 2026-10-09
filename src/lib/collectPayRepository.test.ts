import { describe, expect, it, vi } from 'vitest'
import { collectPayRepository, createCollectPayService, CollectPayRpcError, type CollectPayFormInput } from './collectPayRepository'
import { buildCollectPayItems, financialFingerprint } from './collectPay'
import { obligation, payment, snapshot } from '../test/collectPayFixtures'
const input: CollectPayFormInput = { intent: 'partial', partialAmount: '20', overpay: null, accountId: 'wallet',
  cashAmount: '', date: '2026-10-09', note: '', sourceRequestId: null }
const attempt = { requestId: 'attempt', cashRequestId: 'cash-attempt' }
function setup(direction: 'pay' | 'collect' = 'pay') {
  const s = snapshot([obligation(direction === 'pay' ? 4800 : 500, direction)])
  const repository = { ...collectPayRepository, load: vi.fn(async () => s), payments: vi.fn(async () => s.payments),
    directOutstanding: vi.fn(async (): Promise<number> => direction === 'pay' ? 4800 : -500),
    propose: vi.fn(async (_item, data) => { const p = payment(data.amountMinor, direction); p.note = data.note.trim() || null; p.paymentDate = data.date; s.payments.push(p); return p.id }),
    authorize: vi.fn<typeof collectPayRepository.authorize>(async () => ({ cash_leg_id: 'leg' })), request: vi.fn(async () => 'request'),
    respond: vi.fn(async () => ({ paymentStatus: 'confirmed' as const, paymentVersion: 2 })),
  } satisfies typeof collectPayRepository
  return { s, repository, service: createCollectPayService(repository), key: buildCollectPayItems(s)[0].key }
}
describe('existing settlement RPC orchestration', () => {
  it('blocks obsolete group receipt before cash authorization after another payment confirmed', async () => {
    const { service, s, repository } = setup('collect')
    s.expenses[0].scope = 'space'; s.expenses[0].spaceId = 'trip'
    const p = payment(600, 'collect'); p.scope = 'space'; p.spaceId = 'trip'; s.payments = [p]
    s.cashTrackedPaymentIds = [p.id]
    s.paymentIntents = { [p.id]: { overpay: null, sourceRequestId: null, expectedOutstandingMinor: 600 } }
    await expect(service.confirmReceived('owner', p, 'allocation', 'wallet', 'receipt',
      financialFingerprint(s, buildCollectPayItems(s)[0]))).rejects.toThrow('balance_changed')
    expect(repository.authorize).not.toHaveBeenCalled(); expect(repository.respond).not.toHaveBeenCalled()
  })
  it('keeps a committed attempt when a later cash authorization reports balance_changed', async () => {
    const { service, key, repository } = setup(); const preview = await service.preview('owner', key, input)
    repository.authorize.mockRejectedValueOnce(new CollectPayRpcError('balance_changed', true))
    await expect(service.save('owner', preview, attempt)).rejects.toMatchObject({ retrySameInput: true })
    await service.save('owner', preview, attempt)
    expect(repository.propose).toHaveBeenCalledTimes(1)
  })
  it('unlocks account corrections only when reconciliation proves nothing was written', async () => {
    const { service, key, s } = setup(); const preview = await service.preview('owner', key, input)
    s.accounts[0].archived = true
    await expect(service.save('owner', preview, attempt)).rejects.toMatchObject({ message: 'settlement_cash_account_invalid', retrySameInput: false })
  })
  it('treats explicit RPC transaction rejection as editable, but preserves an uncertain network proposal', async () => {
    const { service, key, repository } = setup(); const preview = await service.preview('owner', key, input)
    repository.propose.mockRejectedValueOnce(new CollectPayRpcError('permission_denied', true))
    await expect(service.save('owner', preview, attempt)).rejects.toMatchObject({ retrySameInput: false })
    repository.propose.mockRejectedValueOnce(new Error('network'))
    await expect(service.save('owner', preview, attempt)).rejects.toMatchObject({ retrySameInput: true })
  })
  it('never unlocks a new request ID when reconciliation itself fails', async () => {
    const { service, key, repository } = setup(); const preview = await service.preview('owner', key, input)
    repository.payments.mockRejectedValueOnce(new Error('network'))
    await expect(service.save('owner', preview, attempt)).rejects.toMatchObject({ retrySameInput: true })
  })
  it('rejects receipt confirmation if other confirmed source balances changed after preview', async () => {
    const { service, s, repository } = setup('collect'); const p = payment(500, 'collect'); s.payments = [p]
    const fingerprint = financialFingerprint(s, buildCollectPayItems(s)[0]); s.expenses[0].version++
    await expect(service.confirmReceived('owner', p, 'allocation', 'wallet', 'receipt', fingerprint)).rejects.toThrow('balance_changed')
    expect(repository.authorize).not.toHaveBeenCalled(); expect(repository.respond).not.toHaveBeenCalled()
  })
  it('records partial 20 as pending without changing confirmed 48', async () => {
    const { s, repository, service, key } = setup()
    const preview = await service.preview('owner', key, input)
    expect(preview.remainingAfterMinor).toBe(2800)
    expect(await service.save('owner', preview, attempt)).toEqual({ kind: 'pending', id: 'payment' })
    expect(repository.authorize).toHaveBeenCalledWith({ requestId: 'cash-attempt', allocationId: 'allocation', role: 'payer', accountId: 'wallet', cashMinor: 2000 })
    expect(buildCollectPayItems(s)[0].remainingMinor).toBe(4800)
  })
  it('uses the real remaining amount for full, not stale partial text', async () => {
    const { service, key } = setup()
    expect((await service.preview('owner', key, { ...input, intent: 'full', partialAmount: '999' })).sharedAmountMinor).toBe(4800)
  })
  it('fails closed on concurrent changed expense versions, without proposing', async () => {
    const { service, key, s, repository } = setup()
    const preview = await service.preview('owner', key, input); s.expenses[0].version++
    await expect(service.save('owner', preview, attempt)).rejects.toThrow('balance_changed')
    expect(repository.propose).not.toHaveBeenCalled()
  })
  it('checks authoritative direct outstanding independently of the client read', async () => {
    const { service, key, repository } = setup(); repository.directOutstanding.mockResolvedValue(4700)
    await expect(service.preview('owner', key, input)).rejects.toThrow('balance_changed')
  })
  it('retries a committed proposal after failed cash binding without creating another payment', async () => {
    const { service, key, repository, s } = setup()
    repository.authorize.mockRejectedValueOnce(new Error('network'))
    const preview = await service.preview('owner', key, input)
    await expect(service.save('owner', preview, attempt)).rejects.toThrow('network')
    await expect(service.save('owner', preview, attempt)).resolves.toEqual({ kind: 'pending', id: 'payment' })
    expect(s.payments).toHaveLength(1); expect(repository.propose).toHaveBeenCalledTimes(1)
    expect(repository.authorize.mock.calls.map(c => c[0].requestId)).toEqual(['cash-attempt', 'cash-attempt'])
  })
  it('rejects idempotent request reuse with a changed scope or amount', async () => {
    const { service, key, s } = setup(); const preview = await service.preview('owner', key, input)
    s.payments = [payment(2100)]
    await expect(service.save('owner', preview, attempt)).rejects.toThrow('idempotency_conflict')
  })
  it.each(['2026-02-31', '', 'garbage'])('rejects invalid calendar dates %j', async date => {
    const { service, key } = setup(); await expect(service.preview('owner', key, { ...input, date })).rejects.toThrow('invalid_payment_date')
  })
  it('rejects archived/liability/other-owned accounts from the real account read', async () => {
    const { service, key, s } = setup(); s.accounts[0].archived = true
    await expect(service.preview('owner', key, input)).rejects.toThrow('settlement_cash_account_invalid')
    s.accounts[0].archived = false; s.accounts[0].accountClass = 'liability'
    await expect(service.preview('owner', key, input)).rejects.toThrow('settlement_cash_account_invalid')
    await expect(service.preview('owner', key, { ...input, accountId: 'not-owned' })).rejects.toThrow('settlement_cash_account_invalid')
  })
  it('keeps cross-currency cash separate, requiring an explicit real cash amount', async () => {
    const { service, key, s } = setup(); s.accounts[0].currency = 'USD'
    await expect(service.preview('owner', key, input)).rejects.toThrow()
    expect(await service.preview('owner', key, { ...input, cashAmount: '4.20' })).toMatchObject({ sharedAmountMinor: 2000, cashAmountMinor: 420, accountCurrency: 'USD' })
  })
  it('records a collection request without inventing a payment or deducting the 5', async () => {
    const { service, key, s, repository } = setup('collect')
    const preview = await service.preview('owner', key, { ...input, intent: 'full' })
    expect(await service.save('owner', preview, attempt)).toEqual({ kind: 'requested', id: 'request' })
    expect(repository.request).toHaveBeenCalledWith(preview.item, 'attempt', 500, '')
    expect(repository.propose).not.toHaveBeenCalled(); expect(repository.authorize).not.toHaveBeenCalled()
    expect(buildCollectPayItems(s)[0].remainingMinor).toBe(500)
  })
  it('reconciles a committed request on retry even after the balance changes', async () => {
    const { service, key, s, repository } = setup('collect')
    const preview = await service.preview('owner', key, { ...input, intent: 'full' })
    s.requests = [{ id: 'saved', clientRequestId: 'attempt', debtorParticipantId: 'other', creditorParticipantId: 'owner',
      currency: 'MYR', amountMinor: 500, scope: 'direct', spaceId: null, status: 'converted', note: null, version: 1, createdAt: '' }]
    s.expenses[0].version++
    expect(await service.save('owner', preview, attempt)).toEqual({ kind: 'requested', id: 'saved' })
    expect(repository.request).not.toHaveBeenCalled()
  })
  it('binds only the receiving user account before existing acceptance RPC', async () => {
    const { service, s, repository } = setup('collect'); const p = payment(500, 'collect'); s.payments = [p]; s.cashTrackedPaymentIds = [p.id]
    const fingerprint = financialFingerprint(s, buildCollectPayItems(s)[0])
    await service.confirmReceived('owner', p, 'allocation', 'wallet', 'receipt', fingerprint)
    expect(repository.authorize).toHaveBeenCalledWith({ requestId: 'receipt', allocationId: 'allocation', role: 'receiver', accountId: 'wallet', cashMinor: null })
    expect(repository.respond).toHaveBeenCalledWith('allocation', 'accepted', 1)
    expect(repository.authorize.mock.invocationCallOrder[0]).toBeLessThan(repository.respond.mock.invocationCallOrder[0])
  })
  it('does not accept when receiving authorization fails', async () => {
    const { service, s, repository } = setup('collect'); const p = payment(500, 'collect'); s.payments = [p]; s.cashTrackedPaymentIds = [p.id]
    repository.authorize.mockRejectedValueOnce(new Error('payer_cash_authorization_required'))
    await expect(service.confirmReceived('owner', p, 'allocation', 'wallet', 'receipt', financialFingerprint(s, buildCollectPayItems(s)[0]))).rejects.toThrow('payer_cash_authorization_required')
    expect(repository.respond).not.toHaveBeenCalled()
  })
})
