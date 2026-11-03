import { describe, expect, it } from 'vitest'
import { fraction, unavailableFx, type FxSnapshot } from './fx'
import { coverMinor, convertMinor, quotePair, settlementRequestId, systemForeignPerTarget } from './fxSettlement'
import { replaceHistoricalConsumer, splitNeedsReview, tripEditorPayload } from './tripExpenseEditor'
import type { CanonicalExpense } from '../types'

const rate = (foreignPerTarget: string) => () => fraction(BigInt(foreignPerTarget))
const lines = (you: [string, number][], they: [string, number][] = []) => ({
  youOwe: you.map(([currency, amountMinor]) => ({ currency, amountMinor })),
  theyOwe: they.map(([currency, amountMinor]) => ({ currency, amountMinor })),
  target: 'MYR',
  rateFor: (currency: string) => currency === 'MYR' ? fraction(1n) : rate('6000')(),
})

describe('issue 08 settlement arithmetic', () => {
  it('values my spending and the shared total at the example rate', () => {
    expect(convertMinor(37300n, 'MYR', 'MYR', fraction(1n)) + convertMinor(522000n, 'VND', 'MYR', fraction(6000n))).toBe(46000n)
    expect(convertMinor(149200n, 'MYR', 'MYR', fraction(1n)) + convertMinor(2088000n, 'VND', 'MYR', fraction(6000n))).toBe(184000n)
  })
  it('nets both directions once and reprices when the agreed rate changes', () => {
    const gross = quotePair({ ...lines([['MYR', 37000], ['VND', 522000]], [['MYR', 5000], ['VND', 204000]]), intent: 'full' })
    const netted = quotePair({ ...lines([['MYR', 32000], ['VND', 318000]]), intent: 'full' })
    expect(gross.ok && netted.ok && gross.cashMinor === 37300n && netted.cashMinor === 37300n).toBe(true)
    const repriced = quotePair({ ...lines([['MYR', 32000], ['VND', 318000]]), intent: 'full', rateFor: currency => currency === 'MYR' ? fraction(1n) : fraction(6200n) })
    expect(repriced.ok && repriced.cashMinor).toBe(37129n)
  })
  it('covers half of each original-currency obligation and rejects a useless partial', () => {
    const half = quotePair({ ...lines([['MYR', 32000], ['VND', 318000]]), intent: 'partial', cashMinor: 18650n })
    expect(half.ok && half.coverages.map(row => [row.currency, row.coveredMinor, row.remainingMinor])).toEqual([
      ['MYR', 16000n, 16000n], ['VND', 159000n, 159000n],
    ])
    const crossed = quotePair({
      ...lines([['MYR', 10000]], [['VND', 120000]]), intent: 'partial', cashMinor: 4000n,
    })
    expect(crossed.ok && crossed.coverages.map(row => [row.direction, row.coveredMinor])).toEqual([
      ['you_owe', 5000n], ['they_owe', 60000n],
    ])
    expect(coverMinor(1n, 1n, 10000n)).toBe(0n)
    const tiny = { ...lines([['VND', 1]]), intent: 'partial' as const, cashMinor: 1n, rateFor: () => fraction(1n, 100n) }
    expect(() => quotePair(tiny)).toThrow('amount_too_small')
    expect(() => quotePair({ ...lines([['MYR', 100]]), intent: 'partial', cashMinor: 0n })).toThrow('invalid_amount')
  })
  it('does not invent a total when a rate is missing and does not treat a quote as identity', () => {
    const fx: FxSnapshot = { ...unavailableFx, rates: {} }
    expect(systemForeignPerTarget('VND', 'MYR', fx)).toBeNull()
    const missing = quotePair({ ...lines([['MYR', 100], ['VND', 6000]]), intent: 'full', rateFor: currency => currency === 'MYR' ? fraction(1n) : null })
    expect(missing.ok).toBe(false)
    expect(systemForeignPerTarget('USD', 'EUR', { ...unavailableFx, status: 'fresh', rates: { USD: { currency: 'USD', quote: 'MYR', numerator: '1', denominator: '4', direction: 'MYR-per-foreign', rateDate: '2026-11-03', fetchedAt: '2026-11-03T00:00:00Z', provider: 'Frankfurter' } } })).toBeNull()
  })
})

const people = ['you', 'yii', 'exson', 'chong']
const expense = (shares: number[], payers: number[]): CanonicalExpense => ({
  id: 'bill', clientRequestId: 'req', scope: 'space', spaceId: 'trip', createdBy: 'you', totalMinor: 17200, participantCount: 4,
  currency: 'MYR', description: 'Dinner', category: 'Food', occurredOn: '2026-11-05', status: 'active', terminationKind: null,
  correctsExpenseId: null, voidedAt: null, version: 1, createdAt: '2026-11-05T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z',
  participations: people.map((id, order) => ({ id: 'p-' + id, expenseId: 'bill', participantId: id, nameSnapshot: id, order, state: 'accepted', trackingMode: 'tracked' })),
  payerContributions: payers.map((amountMinor, index) => ({ expenseParticipationId: 'p-' + people[index], expenseId: 'bill', amountMinor })),
  shares: shares.map((amountMinor, index) => ({ expenseParticipationId: 'p-' + people[index], expenseId: 'bill', amountMinor })),
})

it('keeps one request id until the form changes', () => {
  const first = settlementRequestId(null, 'full', 'a')
  expect(settlementRequestId(first, 'full', 'b')).toBe(first)
  expect(settlementRequestId(first, 'partial', 'b').id).toBe('b')
})

describe('historical consumer repair', () => {
  const draft = { amount: '172.00', note: '', category: 'Food', date: '2026-11-05', consumers: ['you', 'yii', 'exson', 'chong'], paid: { you: '172.00', yii: '0', exson: '0', chong: '0' }, shares: {}, mode: 'equal' as const, items: [], makePrivate: false }
  it('gives Kian Exson’s 43 and leaves the payer unchanged', () => {
    const next = replaceHistoricalConsumer(expense([4300, 4300, 4300, 4300], [17200, 0, 0, 0]), draft, 'exson', 'kian')
    const payload = tripEditorPayload(expense([4300, 4300, 4300, 4300], [17200, 0, 0, 0]), next)
    const share = (id: string) => payload.share_amounts[payload.participant_ids.indexOf(id)] ?? 0
    const paid = (id: string) => payload.contribution_amounts[payload.participant_ids.indexOf(id)] ?? 0
    expect([share('you'), share('yii'), share('kian'), share('chong'), share('exson')]).toEqual([4300, 4300, 4300, 4300, 0])
    expect(paid('you')).toBe(17200)
    expect(paid('exson')).toBe(0)
    expect(paid('kian')).toBe(0)
  })
  it('flags only a loaded roster with a removed positive consumer', () => {
    const bill = expense([4300, 4300, 4300, 4300], [17200, 0, 0, 0])
    expect(splitNeedsReview(bill, null)).toBe(false)
    expect(splitNeedsReview(bill, new Set(['you', 'yii', 'chong']))).toBe(true)
    expect(splitNeedsReview(bill, new Set(['you', 'yii', 'exson', 'chong']))).toBe(false)
  })
})
