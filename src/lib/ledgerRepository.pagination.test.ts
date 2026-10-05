import { beforeEach, describe, expect, it, vi } from 'vitest'
const query = vi.hoisted(() => {
  const builder = { select: vi.fn(), order: vi.fn(), range: vi.fn() }
  builder.select.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  return builder
})
vi.mock('./supabase', () => ({ supabase: { from: vi.fn(() => query) } }))
import { ledgerRepository } from './ledgerRepository'
const row = (id: string) => ({
  id, client_request_id: id, scope: 'personal', space_id: null, created_by: 'you',
  total_minor: 100, currency: 'MYR', description: 'Record', category: 'Food', occurred_on: '2026-10-05',
  status: 'active', version: 1, corrects_expense_id: null, termination_kind: null,
  voided_at: null, created_at: '2026-10-05T00:00:00Z', updated_at: '2026-10-05T00:00:00Z',
})
beforeEach(() => { query.range.mockReset(); query.order.mockClear() })
describe('complete ledger history reads', () => {
  it('continues across server pages, preserves order and deduplicates overlapping rows', async () => {
    query.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, index) => row(String(index))), error: null })
      .mockResolvedValueOnce({ data: [row('499'), row('older')], error: null })
    const records = await ledgerRepository.listExpenses()
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]])
    expect(query.order).toHaveBeenCalledWith('id', { ascending: false })
    expect(records).toHaveLength(501)
    expect(records[500]?.id).toBe('older')
    expect(records.filter(record => record.id === '499')).toHaveLength(1)
  })
  it('rejects a later page failure instead of returning incomplete history as complete', async () => {
    query.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, index) => row(String(index))), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'network failed' } })
    await expect(ledgerRepository.listExpenses()).rejects.toThrow('network failed')
  })
})
