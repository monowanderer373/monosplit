import { describe, expect, it, vi } from 'vitest'
import type { LedgerExpenseDraft } from './compileExpense'
import { compileLedgerExpense } from './compileExpense'
import { InMemoryLedgerRepository } from './ledgerRepository'
import {
  createPendingLedgerCommand,
  drainLedgerOutbox,
  flushLedgerOutbox,
  mergeServerExpensesWithOutbox,
} from './ledgerOutbox'

const draft: LedgerExpenseDraft = {
  clientRequestId: '11111111-1111-4111-8111-111111111111',
  scope: 'personal',
  spaceId: null,
  currentParticipantId: 'dav',
  amount: '12.34',
  currency: 'MYR',
  description: '',
  category: 'Other',
  occurredOn: '2026-08-30',
  participants: [{ id: 'dav', displayName: 'Dav', kind: 'account' }],
  payerAmounts: {},
  splitMode: 'equal',
  exactShareAmounts: {},
}

describe('ledger outbox', () => {
  it('builds an honest pending optimistic expense and acknowledges one server record', async () => {
    const compiled = compileLedgerExpense(draft)
    if (!compiled.ok) throw new Error(compiled.error)
    const pending = createPendingLedgerCommand(draft, compiled.command)
    expect(pending.optimisticExpense.id).toContain('pending:')

    const repository = new InMemoryLedgerRepository()
    const callbacks = {
      markRetrying: vi.fn(),
      acknowledge: vi.fn(),
      reject: vi.fn(),
    }
    await flushLedgerOutbox(repository, [pending, pending], callbacks)

    expect(await repository.listExpenses()).toHaveLength(1)
    expect(callbacks.acknowledge).toHaveBeenCalledTimes(2)
    expect(callbacks.reject).not.toHaveBeenCalled()
  })

  it('keeps unsynced and rejected optimistic rows visible across server refreshes', () => {
    const compiled = compileLedgerExpense(draft)
    if (!compiled.ok) throw new Error(compiled.error)
    const pending = createPendingLedgerCommand(draft, compiled.command)
    const rejected = { ...pending, status: 'rejected' as const, error: 'server_rejected' }

    expect(mergeServerExpensesWithOutbox([], [rejected])).toEqual([
      pending.optimisticExpense,
    ])

    const serverExpense = { ...pending.optimisticExpense, id: 'expense-1' }
    expect(mergeServerExpensesWithOutbox([serverExpense], [pending])).toEqual([
      serverExpense,
    ])
  })

  it('drains a command queued while another command is being saved', async () => {
    const firstResult = compileLedgerExpense(draft)
    const secondDraft = {
      ...draft,
      clientRequestId: '22222222-2222-4222-8222-222222222222',
    }
    const secondResult = compileLedgerExpense(secondDraft)
    if (!firstResult.ok || !secondResult.ok) throw new Error('compile_failed')
    const first = createPendingLedgerCommand(draft, firstResult.command)
    const second = createPendingLedgerCommand(secondDraft, secondResult.command)
    let items = [first]
    let queuedSecond = false
    const repository = new InMemoryLedgerRepository()

    await drainLedgerOutbox(repository, () => items, {
      markRetrying: (requestId) => {
        if (requestId === first.command.requestId && !queuedSecond) {
          queuedSecond = true
          items = [...items, second]
        }
      },
      acknowledge: (requestId) => {
        items = items.filter((item) => item.command.requestId !== requestId)
      },
      reject: vi.fn(),
    })

    expect(await repository.listExpenses()).toHaveLength(2)
    expect(items).toEqual([])
  })
})
