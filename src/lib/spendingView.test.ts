import { describe, expect, it } from 'vitest'
import { spendingFilter, spendingSnapshot, spendingCategoryColor, spendingQuery } from './spendingView'
import { derivePersonalLedgerRows } from './ledgerSummary'
import { spendingExpense } from '../test/spendingFixtures'
const filter = { month: '2026-10', scope: 'all' as const, currency: 'MYR', tab: 'category' as const }
describe('one spending snapshot for charts and records', () => {
  it('reconciles full count, own shares, category and daily totals across scope/currency', () => {
    const expenses = [spendingExpense('personal', 1200), spendingExpense('direct', 7200, 'direct'), spendingExpense('trip', 3000, 'space'), spendingExpense('other-currency', 99900, 'personal', { currency: 'JPY' }), spendingExpense('old', 4000, 'personal', { occurredOn: '2026-09-30' })]
    const rows = derivePersonalLedgerRows(expenses, 'you')
    const snapshot = spendingSnapshot(rows, 'you', filter, 'MYR')
    expect(snapshot.count).toBe(3)
    expect(snapshot.totalMinor).toBe(6300)
    expect(snapshot.records.reduce((sum, row) => sum + row.personalSpendingMinor, 0)).toBe(snapshot.totalMinor)
    expect(snapshot.categories.reduce((sum, [, amount]) => sum + amount, 0)).toBe(snapshot.totalMinor)
    expect(snapshot.days.reduce((sum, [, amount]) => sum + amount, 0)).toBe(snapshot.totalMinor)
    expect(spendingSnapshot(rows, 'you', { ...filter, scope: 'shared' }, 'MYR').totalMinor).toBe(5100)
    expect(spendingSnapshot(rows, 'you', { ...filter, scope: 'personal' }, 'MYR').count).toBe(1)
    expect(spendingSnapshot(rows, 'you', { ...filter, currency: 'JPY' }, 'MYR').totalMinor).toBe(99900)
  })
  it('excludes unsubmitted outbox, pending/declined shares, void and correction candidates', () => {
    const pending = spendingExpense('pending-share', 1000, 'direct')
    pending.participations[0].state = 'pending'
    const declined = spendingExpense('declined-share', 1000, 'direct')
    declined.participations[0].state = 'declined'
    const expenses = [pending, declined, spendingExpense('pending:create'), spendingExpense('void', 1000, 'personal', { status: 'voided' }), spendingExpense('candidate', 1000, 'direct', { status: 'correction_pending' }), spendingExpense('confirmed', 2000)]
    const snapshot = spendingSnapshot(derivePersonalLedgerRows(expenses, 'you'), 'you', filter, 'MYR')
    expect(snapshot.count).toBe(1)
    expect(snapshot.totalMinor).toBe(2000)
  })
  it('preserves original category-ranking ties from authoritative ledger ordering', () => {
    const rows = derivePersonalLedgerRows([spendingExpense('b',3500,'personal',{category:'Food'}),spendingExpense('a',3500,'personal',{category:'Shopping'})], 'you')
    expect(spendingSnapshot(rows,'you',filter,'MYR').categories).toEqual([['Food',3500],['Shopping',3500]])
  })
  it('retains explicit zero-result currency and counts more than a visible page', () => {
    const rows = derivePersonalLedgerRows(Array.from({ length: 85 }, (_, index) => spendingExpense(String(index), 100)), 'you')
    expect(spendingSnapshot(rows, 'you', filter, 'MYR').count).toBe(85)
    const empty = spendingSnapshot(rows, 'you', { ...filter, currency: 'JPY' }, 'MYR')
    expect(empty).toMatchObject({ currency: 'JPY', count: 0, totalMinor: 0 })
    expect(spendingSnapshot(rows, null, filter, 'MYR').count).toBe(0)
    expect(spendingSnapshot(rows, 'someone-else', filter, 'MYR').count).toBe(0)
  })
  it('validates deep links and retains filters/tabs without accepting identity from URLs', () => {
    expect(spendingFilter(new URLSearchParams('month=0000-13&scope=admin&currency=FAKE&tab=bad&participant=you'), '2026-11-01')).toEqual({ month: '2026-11', scope: 'all', currency: '', tab: 'category' })
    const original = { ...filter, scope: 'shared' as const, tab: 'ranking' as const }
    expect(spendingFilter(new URLSearchParams(spendingQuery(original)), '2026-11-01')).toEqual(original)
    expect(spendingCategoryColor('Food')).toBe(spendingCategoryColor('Food'))
  })
})
