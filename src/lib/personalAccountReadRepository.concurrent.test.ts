import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ accounts: vi.fn(), movements: vi.fn(), read: vi.fn() }))
vi.mock('./multicurrencyRepository', () => ({ loadCurrencyAccounts: mocks.accounts, loadMovementHistory: mocks.movements }))
vi.mock('./supabase', () => ({ supabase: { from: (table: string) => {
  const query = { select: () => query, in: () => query, eq: () => query, order: () => query,
    range: () => mocks.read(table) }
  return query
} } }))
import { loadPersonalAccountHome } from './personalAccountReadRepository'
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
beforeEach(() => {
  mocks.accounts.mockReset().mockResolvedValue([])
  mocks.movements.mockReset().mockResolvedValue({ movements: [], fees: [] })
  mocks.read.mockReset().mockResolvedValue({ data: [], error: null })
})
describe('complete Home reads without serial network waterfalls', () => {
  it('starts independent reads and transaction-dependent entries while accounts are still pending', async () => {
    const account = deferred<never[]>()
    mocks.accounts.mockReturnValue(account.promise)
    mocks.read.mockImplementation(async (table: string) => ({ data: table === 'personal_account_transactions'
      ? [{ id: 'tx', kind: 'income', occurred_on: '2026-10-17', memo: null, expense_id: null, created_at: '2026-10-17T00:00:00Z' }]
      : table === 'personal_account_entries' ? [{ transaction_id: 'tx', account_id: 'wallet', amount_minor: 100, currency: 'MYR' }] : [], error: null }))
    const read = loadPersonalAccountHome({ includeAllActivity: true })
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalledWith('personal_account_entries'))
    expect(mocks.read.mock.calls.map(([table]) => table)).toEqual(expect.arrayContaining([
      'personal_funding_intents', 'personal_funding_bundle_legs', 'personal_funding_bundles',
      'personal_recurring_occurrences', 'personal_installments', 'personal_installment_plans',
    ]))
    account.resolve([])
    const snapshot = await read
    expect(snapshot.journals).toEqual([expect.objectContaining({ id: 'tx', amountMinor: 100, accountId: 'wallet' })])
  })
  it('rejects the entire account snapshot when any independent financial read fails', async () => {
    mocks.read.mockImplementation(async (table: string) => ({ data: [], error: table === 'personal_funding_bundles' ? new Error('unavailable') : null }))
    await expect(loadPersonalAccountHome()).rejects.toThrow('unavailable')
  })
})
