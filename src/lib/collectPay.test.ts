import { describe, expect, it } from 'vitest'
import { buildCollectPayItems, collectPayTotals, collectPayPreviews, financialFingerprint, previewCollectPayReceipt, resolveCollectPayPreview } from './collectPay'
import { obligation, payment, snapshot } from '../test/collectPayFixtures'

const item = (s = snapshot(), direction = 'pay') => buildCollectPayItems(s).find(i => i.direction === direction)!
describe('collect/pay real relational scope', () => {
  it('rejects an opted-in group receipt above the now-confirmed net without removing legacy receipt behavior', () => {
    const s = snapshot([obligation(2800, 'collect')])
    s.expenses[0].scope = 'space'; s.expenses[0].spaceId = 'trip'
    const p = payment(4800, 'collect'); p.scope = 'space'; p.spaceId = 'trip'; s.payments = [p]
    s.cashTrackedPaymentIds = [p.id]
    s.paymentIntents = { [p.id]: { overpay: null, sourceRequestId: null, expectedOutstandingMinor: 4800 } }
    expect(() => previewCollectPayReceipt(s, item(s, 'collect'), p.id, 'allocation')).toThrow('balance_changed')
    s.paymentIntents[p.id].expectedOutstandingMinor = null
    expect(previewCollectPayReceipt(s, item(s, 'collect'), p.id, 'allocation').remainingAfterMinor).toBe(-2000)
  })
  it('uses one friend net row across expenses and offsets instead of repeating a balance per expense', () => {
    const s = snapshot([obligation(5000), obligation(800, 'collect', 'offset')])
    expect(buildCollectPayItems(s)).toHaveLength(1)
    expect(item(s)).toMatchObject({ remainingMinor: 4200, originalNetMinor: 4200 })
    expect(item(s).expenses).toHaveLength(2)
  })
  it('keeps 48 outstanding for pending 20, then shows 28 only after confirmation', () => {
    const s = snapshot(); s.payments = [payment(2000)]
    expect(item(s).remainingMinor).toBe(4800)
    s.payments = [payment(2000, 'pay', 'accepted')]
    expect(item(s)).toMatchObject({ remainingMinor: 2800, confirmedNetMinor: 2000 })
  })
  it('previews and confirms collection of 5 to 0, retaining its real history', () => {
    const s = snapshot([obligation(500, 'collect')]); s.payments = [payment(500, 'collect')]
    expect(previewCollectPayReceipt(s, item(s, 'collect'), 'payment', 'allocation')).toEqual({ amountMinor: 500, remainingAfterMinor: 0 })
    expect(item(s, 'collect').remainingMinor).toBe(500)
    s.payments = [payment(500, 'collect', 'accepted')]
    expect(item(s, 'collect').remainingMinor).toBe(0)
    expect(item(s, 'collect').payments).toHaveLength(1)
  })
  it('never sums different currencies', () => {
    const s = snapshot([obligation(4800), obligation(500, 'pay', 'usd', 'USD')])
    expect(collectPayTotals(buildCollectPayItems(s))).toEqual([{ currency: 'MYR', amountMinor: 4800 }, { currency: 'USD', amountMinor: 500 }])
  })
  it('separates pending expenses from confirmed totals, including a zero confirmed balance', () => {
    const s = snapshot(); s.expenses[0].participations[1].state = 'pending'
    expect(buildCollectPayItems(s)).toEqual([])
    expect(collectPayPreviews(s)).toHaveLength(1)
  })
  it('retains reverse credit and the opposite-direction payment facts', () => {
    const s = snapshot(); s.payments = [payment(5000, 'pay', 'accepted')]
    expect(item(s, 'collect').remainingMinor).toBe(200)
    expect(item(s, 'collect').balancePayments).toHaveLength(1)
    expect(item(s, 'pay').remainingMinor).toBe(0)
  })
  it('keeps gift extra out of shared debt and carry extra as reverse credit without clamping', () => {
    expect(resolveCollectPayPreview(item(), { intent: 'partial', partialAmount: '50', overpayDisposition: 'gift' }))
      .toMatchObject({ sharedAmountMinor: 4800, cashAmountMinor: 5000, remainingAfterMinor: 0 })
    expect(resolveCollectPayPreview(item(), { intent: 'partial', partialAmount: '50', overpayDisposition: 'carry' }))
      .toMatchObject({ sharedAmountMinor: 5000, cashAmountMinor: 5000, remainingAfterMinor: -200 })
  })
  it.each(['', '0', '-1', '20.001', '49'])('uses existing precision and overpayment rules for %j', partialAmount => {
    expect(() => resolveCollectPayPreview(item(), { intent: 'partial', partialAmount })).toThrow()
  })
  it('fingerprints confirmed financial source changes even when the amount is unchanged', () => {
    const s = snapshot(); const before = financialFingerprint(s, item(s))
    s.expenses[0].version++
    expect(financialFingerprint(s, item(s))).not.toBe(before)
  })
  it('scope-isolates group balances and tracks every source in their aggregate fingerprint', () => {
    const s = snapshot([obligation(500), obligation(400, 'pay', 'space')])
    s.expenses[1].scope = 'space'; s.expenses[1].spaceId = 'trip'
    s.spaces = [{ role: 'full_access', space: { id: 'trip', type: 'trip', name: 'Trip', ownerParticipantId: 'owner',
      defaultCurrency: 'MYR', status: 'active', version: 1, startDate: null, endDate: null, createdAt: '', updatedAt: '' } }]
    const rows = buildCollectPayItems(s)
    expect(rows.map(r => r.remainingMinor).sort()).toEqual([400, 500])
    const group = rows.find(i => i.source === 'trip')!
    const before = financialFingerprint(s, group)
    s.expenses[1].version++
    expect(financialFingerprint(s, buildCollectPayItems(s).find(i => i.source === 'trip')!)).not.toBe(before)
  })
})
