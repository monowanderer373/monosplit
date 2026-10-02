import { describe, expect, it, vi } from 'vitest'
import { saveExpenseEdits, type ExpenseEditSnapshot } from './saveExpenseEdits'
const snapshot: ExpenseEditSnapshot = {
  expenseId: 'expense', version: 4,
  payload: { totalMinor: 3500, currency: 'MYR', description: 'Dinner', category: 'Food', occurredOn: '2026-10-02', participantIds: ['you', 'lan'], contributionAmounts: [3500, 0], shareAmounts: [1750, 1750] },
}
describe('unified expense save across existing versioned RPCs', () => {
  it('uses the financial ACK version for metadata, preserving both edits', async () => {
    const repository = { replaceExpenseFinancials: vi.fn().mockResolvedValue(5), updateExpenseMetadata: vi.fn().mockResolvedValue(6) }
    const applied = vi.fn()
    const next = { ...snapshot.payload, totalMinor: 4000, description: 'Dinner and tea', contributionAmounts: [4000, 0], shareAmounts: [2000, 2000] }
    await saveExpenseEdits(snapshot, next, repository, applied)
    expect(repository.replaceExpenseFinancials).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 4, totalMinor: 4000 }))
    expect(repository.updateExpenseMetadata).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 5, description: next.description }))
    expect(applied.mock.calls.at(-1)?.[0]).toEqual({ ...snapshot, version: 6, payload: next })
  })
  it('retries only remaining metadata after a partial save', async () => {
    const repository = { replaceExpenseFinancials: vi.fn().mockResolvedValue(5), updateExpenseMetadata: vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(6) }
    const next = { ...snapshot.payload, totalMinor: 4000, description: 'Dinner and tea', contributionAmounts: [4000, 0], shareAmounts: [2000, 2000] }
    let current = snapshot
    await expect(saveExpenseEdits(current, next, repository, applied => { current = applied })).rejects.toThrow('network')
    expect(current.version).toBe(5)
    expect(current.payload.description).toBe('Dinner')
    await saveExpenseEdits(current, next, repository, applied => { current = applied })
    expect(repository.replaceExpenseFinancials).toHaveBeenCalledTimes(1)
    expect(repository.updateExpenseMetadata.mock.calls[1][0].expectedVersion).toBe(5)
    expect(current.payload.description).toBe(next.description)
  })
  it('keeps metadata-only edits out of financial reconfirmation', async () => {
    const repository = { replaceExpenseFinancials: vi.fn(), updateExpenseMetadata: vi.fn().mockResolvedValue(5) }
    await saveExpenseEdits(snapshot, { ...snapshot.payload, category: 'Shopping' }, repository, vi.fn())
    expect(repository.replaceExpenseFinancials).not.toHaveBeenCalled()
    expect(repository.updateExpenseMetadata).toHaveBeenCalledTimes(1)
  })
  it('rejects inconsistent split amounts before any mutation', async () => {
    const repository = { replaceExpenseFinancials: vi.fn(), updateExpenseMetadata: vi.fn() }
    await expect(saveExpenseEdits(snapshot, { ...snapshot.payload, totalMinor: 4000 }, repository, vi.fn())).rejects.toThrow()
    expect(repository.replaceExpenseFinancials).not.toHaveBeenCalled()
    expect(repository.updateExpenseMetadata).not.toHaveBeenCalled()
  })
  it('does not save metadata after a stale financial version fails', async () => {
    const repository = { replaceExpenseFinancials: vi.fn().mockRejectedValue(new Error('version_conflict')), updateExpenseMetadata: vi.fn() }
    await expect(saveExpenseEdits(snapshot, { ...snapshot.payload, totalMinor: 4000, contributionAmounts: [4000,0], shareAmounts: [2000,2000], description: 'Tea' }, repository, vi.fn())).rejects.toThrow('version_conflict')
    expect(repository.updateExpenseMetadata).not.toHaveBeenCalled()
  })
})
