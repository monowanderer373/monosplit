import { describe, expect, it, vi } from 'vitest'
import type { CreateExpenseCommand, LedgerExpenseDraft } from './compileExpense'
import { compileLedgerExpense } from './compileExpense'
import {
  InMemoryLedgerRepository,
  LedgerRepositoryError,
} from './ledgerRepository'
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
    let live = pending
    const callbacks = {
      claimForDispatch: vi.fn(() => {
        if (live.status !== 'pending') return null
        live = { ...live, status: 'retrying', commitState: 'dispatching', attempts: 1 }
        return live
      }),
      acknowledge: vi.fn(() => {
        live = { ...live, status: 'rejected' }
      }),
      adopt: vi.fn(),
      reject: vi.fn(),
    }
    await flushLedgerOutbox(repository, [pending, pending], callbacks)

    expect(await repository.listExpenses()).toHaveLength(1)
    expect(callbacks.acknowledge).toHaveBeenCalledTimes(1)
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
      claimForDispatch: (requestId) => {
        const current = items.find((item) => item.command.requestId === requestId)
        if (!current || current.status !== 'pending') return null
        const claimed = {
          ...current,
          status: 'retrying' as const,
          commitState: 'dispatching' as const,
          attempts: current.attempts + 1,
        }
        items = items.map((item) => (
          item.command.requestId === requestId ? claimed : item
        ))
        if (requestId === first.command.requestId && !queuedSecond) {
          queuedSecond = true
          items = [...items, second]
        }
        return claimed
      },
      acknowledge: (requestId) => {
        items = items.filter((item) => item.command.requestId !== requestId)
      },
      adopt: vi.fn(),
      reject: vi.fn(),
    })

    expect(await repository.listExpenses()).toHaveLength(2)
    expect(items).toEqual([])
  })

  it('does not dispatch a command removed before its dispatch claim', async () => {
    const compiled = compileLedgerExpense(draft)
    if (!compiled.ok) throw new Error(compiled.error)
    const pending = createPendingLedgerCommand(draft, compiled.command)
    const repository = new InMemoryLedgerRepository()
    const create = vi.spyOn(repository, 'createExpense')

    await flushLedgerOutbox(repository, [pending], {
      claimForDispatch: () => null,
      acknowledge: vi.fn(),
      adopt: vi.fn(),
      reject: vi.fn(),
    })

    expect(create).not.toHaveBeenCalled()
    expect(await repository.listExpenses()).toEqual([])
  })

  it('adopts an authoritative expense after an ambiguous create response', async () => {
    const compiled = compileLedgerExpense(draft)
    if (!compiled.ok) throw new Error(compiled.error)
    const pending = createPendingLedgerCommand(draft, compiled.command)
    class CommittedWithoutResponseRepository extends InMemoryLedgerRepository {
      override async createExpense(command: CreateExpenseCommand): Promise<string> {
        await super.createExpense(command)
        throw new LedgerRepositoryError('server_rejected', 'failed to fetch', 'ambiguous')
      }
    }
    const repository = new CommittedWithoutResponseRepository()
    const adopt = vi.fn()

    await flushLedgerOutbox(repository, [pending], {
      claimForDispatch: () => ({
        ...pending,
        status: 'retrying',
        commitState: 'dispatching',
        attempts: 1,
      }),
      acknowledge: vi.fn(),
      adopt,
      reject: vi.fn(),
    })

    expect(adopt).toHaveBeenCalledWith(
      pending.command.requestId,
      expect.objectContaining({ clientRequestId: pending.command.requestId }),
    )
    expect(await repository.listExpenses()).toHaveLength(1)
  })

  it('keeps an unproven ambiguous failure for idempotent recovery', async () => {
    const compiled = compileLedgerExpense(draft)
    if (!compiled.ok) throw new Error(compiled.error)
    const pending = createPendingLedgerCommand(draft, compiled.command)
    class UnknownOutcomeRepository extends InMemoryLedgerRepository {
      override async createExpense(): Promise<string> {
        throw new LedgerRepositoryError('server_rejected', 'failed to fetch', 'ambiguous')
      }
    }
    const reject = vi.fn()

    await flushLedgerOutbox(new UnknownOutcomeRepository(), [pending], {
      claimForDispatch: () => ({
        ...pending,
        status: 'retrying',
        commitState: 'dispatching',
        attempts: 1,
      }),
      acknowledge: vi.fn(),
      adopt: vi.fn(),
      reject,
    })

    expect(reject).toHaveBeenCalledWith(
      pending.command.requestId,
      'failed to fetch',
      'unknown',
    )
    expect(pending.command.requestId).toBe(draft.clientRequestId)
  })

  it('does not adopt a conflicting server expense with the same request ID', async () => {
    const compiled = compileLedgerExpense(draft)
    if (!compiled.ok) throw new Error(compiled.error)
    const pending = createPendingLedgerCommand(draft, compiled.command)
    class ConflictingRequestRepository extends InMemoryLedgerRepository {
      override async createExpense(): Promise<string> {
        throw new LedgerRepositoryError(
          'server_rejected',
          'request_id_idempotency_conflict',
        )
      }
    }
    const repository = new ConflictingRequestRepository()
    await InMemoryLedgerRepository.prototype.createExpense.call(repository, {
      ...pending.command,
      totalMinor: pending.command.totalMinor + 1,
    })
    const reject = vi.fn()
    const adopt = vi.fn()

    await flushLedgerOutbox(repository, [pending], {
      claimForDispatch: () => ({
        ...pending,
        status: 'retrying',
        commitState: 'dispatching',
        attempts: 1,
      }),
      acknowledge: vi.fn(),
      adopt,
      reject,
    })

    expect(adopt).not.toHaveBeenCalled()
    expect(reject).toHaveBeenCalledWith(
      pending.command.requestId,
      'request_id_reconciliation_conflict',
      'unknown',
    )
  })

  it('retains the Manual Participant captured before a later Person link', () => {
    const preLinkDraft: LedgerExpenseDraft = {
      ...draft,
      scope: 'direct',
      participants: [
        { id: 'dav', displayName: 'Dav', kind: 'account' },
        { id: 'manual-lan', displayName: 'Lan', kind: 'manual' },
      ],
    }
    const compiled = compileLedgerExpense(preLinkDraft)
    if (!compiled.ok) throw new Error(compiled.error)
    const queued = createPendingLedgerCommand(preLinkDraft, compiled.command)

    const personNowLinksTo = 'account-lan'
    expect(personNowLinksTo).not.toBe('manual-lan')
    expect(queued.command.participantIds).toEqual(['dav', 'manual-lan'])
    expect(
      queued.optimisticExpense.participations.map(
        (participation) => participation.participantId,
      ),
    ).toEqual(['dav', 'manual-lan'])
  })
})
