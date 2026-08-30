import { describe, expect, it } from 'vitest'
import type { CreateExpenseCommand } from './compileExpense'
import { InMemoryLedgerRepository } from './ledgerRepository'

const command: CreateExpenseCommand = {
  requestId: '11111111-1111-4111-8111-111111111111',
  scope: 'personal',
  spaceId: null,
  totalMinor: 1000,
  currency: 'MYR',
  description: null,
  category: 'Other',
  occurredOn: '2026-08-30',
  participantIds: ['dav'],
  contributionAmounts: [1000],
  shareAmounts: [1000],
}

describe('InMemoryLedgerRepository contract', () => {
  it('returns the same expense for idempotent retries', async () => {
    const repository = new InMemoryLedgerRepository()
    const [first, retry] = await Promise.all([
      repository.createExpense(command),
      repository.createExpense(command),
    ])
    expect(first).toBe(retry)
    expect(await repository.listExpenses()).toHaveLength(1)
  })

  it('voids instead of deleting financial records', async () => {
    const repository = new InMemoryLedgerRepository()
    const expenseId = await repository.createExpense(command)
    await repository.voidExpense(expenseId)
    expect(await repository.listExpenses()).toEqual([
      expect.objectContaining({ id: expenseId, status: 'voided' }),
    ])
  })
})
