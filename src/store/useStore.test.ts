import { beforeEach, describe, expect, it } from 'vitest'
import { compileLedgerExpense, type LedgerExpenseDraft } from '../lib/compileExpense'
import { createPendingLedgerCommand } from '../lib/ledgerOutbox'
import { migratePersistedState, useStore } from './useStore'

const identityId = 'identity-1'
const draft: LedgerExpenseDraft = {
  clientRequestId: '11111111-1111-4111-8111-111111111111',
  scope: 'personal',
  spaceId: null,
  currentParticipantId: 'participant-1',
  amount: '12.34',
  currency: 'MYR',
  description: 'Offline lunch',
  category: 'Food',
  occurredOn: '2026-09-08',
  participants: [{
    id: 'participant-1',
    displayName: 'Owner',
    kind: 'account',
  }],
  payerAmounts: {},
  splitMode: 'equal',
  exactShareAmounts: {},
}

function pendingCommand() {
  const result = compileLedgerExpense(draft)
  if (!result.ok) throw new Error(result.error)
  return createPendingLedgerCommand(draft, result.command)
}

beforeEach(() => {
  useStore.setState({ ledgerByIdentity: {} })
})

describe('migratePersistedState', () => {
  it('drops legacy group caches while preserving relational preferences and outbox state', () => {
    const ledgerByIdentity = {
      participant: {
        expenses: [],
        outbox: [{ command: { requestId: 'request-id' } }],
      },
    }

    const migrated = migratePersistedState({
      lang: 'zh',
      themeId: 'solid-vintage',
      ledgerByIdentity,
      groups: [{ id: 'legacy-group' }],
      hiddenDeletedGroupIds: ['legacy-group'],
      myPersonIdByGroupId: { 'legacy-group': 'legacy-person' },
      fontId: 'legacy-font',
    })

    expect(migrated).toMatchObject({
      lang: 'zh',
      themeId: 'solid-vintage',
      ledgerByIdentity: {
        participant: {
          outbox: [{
            command: { requestId: 'request-id' },
            commitState: 'unknown',
          }],
        },
      },
    })
    expect(migrated).not.toHaveProperty('groups')
    expect(migrated).not.toHaveProperty('hiddenDeletedGroupIds')
    expect(migrated).not.toHaveProperty('myPersonIdByGroupId')
    expect(migrated).not.toHaveProperty('fontId')
  })

  it('initializes an empty relational ledger cache for malformed persisted state', () => {
    expect(migratePersistedState({ ledgerByIdentity: null })).toMatchObject({
      ledgerByIdentity: {},
    })
  })

  it('preserves and conservatively classifies existing queued commands', () => {
    const item = pendingCommand()
    const legacyRetrying = {
      ...item,
      status: 'retrying',
      attempts: 1,
    }
    const withoutCommitState: Partial<typeof legacyRetrying> = { ...legacyRetrying }
    delete withoutCommitState.commitState

    const migrated = migratePersistedState({
      ledgerByIdentity: {
        [identityId]: {
          expenses: [item.optimisticExpense],
          outbox: [withoutCommitState],
        },
      },
    })

    expect(migrated).toMatchObject({
      ledgerByIdentity: {
        [identityId]: {
          outbox: [{
            command: { requestId: item.command.requestId },
            status: 'retrying',
            attempts: 1,
            commitState: 'unknown',
          }],
        },
      },
    })
  })
})

describe('ledger outbox state transitions', () => {
  it('atomically discards only an unflushed command and its optimistic expense', () => {
    const item = pendingCommand()
    useStore.getState().queueLedgerCommand(identityId, item)

    const discarded = useStore.getState().discardUnflushedLedgerCommand(
      identityId,
      item.command.requestId,
    )

    expect(discarded).toEqual(item)
    expect(useStore.getState().ledgerByIdentity[identityId]).toEqual({
      expenses: [],
      outbox: [],
    })
    const reloaded = migratePersistedState({
      ledgerByIdentity: useStore.getState().ledgerByIdentity,
    })
    expect(reloaded).toMatchObject({
      ledgerByIdentity: {
        [identityId]: { expenses: [], outbox: [] },
      },
    })
  })

  it('restores the exact discarded command and optimistic identity in session', () => {
    const item = pendingCommand()
    useStore.getState().queueLedgerCommand(identityId, item)
    const discarded = useStore.getState().discardUnflushedLedgerCommand(
      identityId,
      item.command.requestId,
    )
    if (!discarded) throw new Error('Expected discard snapshot')

    useStore.getState().queueLedgerCommand(identityId, discarded)

    const restored = useStore.getState().ledgerByIdentity[identityId]
    expect(restored.outbox).toEqual([item])
    expect(restored.expenses).toEqual([item.optimisticExpense])
    expect(restored.outbox[0].command).toEqual(item.command)
  })

  it('lets a dispatch claim win atomically and then refuses local Undo', () => {
    const item = pendingCommand()
    useStore.getState().queueLedgerCommand(identityId, item)

    const claimed = useStore.getState().claimLedgerCommand(
      identityId,
      item.command.requestId,
    )
    const discarded = useStore.getState().discardUnflushedLedgerCommand(
      identityId,
      item.command.requestId,
    )

    expect(claimed).toMatchObject({
      status: 'retrying',
      commitState: 'dispatching',
      attempts: 1,
    })
    expect(discarded).toBeNull()
    expect(useStore.getState().ledgerByIdentity[identityId].outbox).toHaveLength(1)
  })

  it('fails closed when the optimistic row is missing', () => {
    const item = pendingCommand()
    useStore.setState({
      ledgerByIdentity: {
        [identityId]: { expenses: [], outbox: [item] },
      },
    })

    expect(useStore.getState().discardUnflushedLedgerCommand(
      identityId,
      item.command.requestId,
    )).toBeNull()
    expect(useStore.getState().ledgerByIdentity[identityId].outbox).toEqual([item])
  })

  it('discards only a rejected draft with a proven non-commit outcome', () => {
    const first = pendingCommand()
    const second = {
      ...pendingCommand(),
      command: {
        ...pendingCommand().command,
        requestId: '22222222-2222-4222-8222-222222222222',
      },
      optimisticExpense: {
        ...pendingCommand().optimisticExpense,
        id: 'pending:22222222-2222-4222-8222-222222222222',
        clientRequestId: '22222222-2222-4222-8222-222222222222',
      },
    }
    useStore.getState().queueLedgerCommand(identityId, first)
    useStore.getState().queueLedgerCommand(identityId, second)
    useStore.getState().claimLedgerCommand(identityId, first.command.requestId)
    useStore.getState().claimLedgerCommand(identityId, second.command.requestId)
    useStore.getState().rejectLedgerCommand(
      identityId,
      first.command.requestId,
      'validation_failed',
      'not_committed',
    )
    useStore.getState().rejectLedgerCommand(
      identityId,
      second.command.requestId,
      'failed_to_fetch',
      'unknown',
    )

    expect(useStore.getState().discardRejectedLedgerCommand(
      identityId,
      first.command.requestId,
    )).toBe(true)
    expect(useStore.getState().discardRejectedLedgerCommand(
      identityId,
      second.command.requestId,
    )).toBe(false)
    useStore.getState().retryLedgerCommand(identityId, second.command.requestId)
    expect(useStore.getState().ledgerByIdentity[identityId].outbox[0]).toMatchObject({
      command: { requestId: second.command.requestId },
      status: 'pending',
      attempts: 1,
      commitState: 'unknown',
    })
  })

  it('records complete local cancellation lifecycle state after server success', () => {
    const optimistic = pendingCommand().optimisticExpense
    const serverExpense = { ...optimistic, id: 'expense-1' }
    useStore.setState({
      ledgerByIdentity: {
        [identityId]: { expenses: [serverExpense], outbox: [] },
      },
    })

    useStore.getState().voidCachedLedgerExpense(identityId, serverExpense.id)

    expect(useStore.getState().ledgerByIdentity[identityId].expenses[0]).toMatchObject({
      status: 'voided',
      terminationKind: 'cancelled',
    })
  })
})
