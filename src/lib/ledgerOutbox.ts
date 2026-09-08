import type { CanonicalExpense, ExpenseParticipation } from '../types'
import type {
  CreateExpenseCommand,
  LedgerExpenseDraft,
} from './compileExpense'
import {
  LedgerRepositoryError,
  type LedgerRepository,
} from './ledgerRepository'
import type { PendingLedgerCommand } from '../store/useStore'

export function mergeServerExpensesWithOutbox(
  serverExpenses: readonly CanonicalExpense[],
  outbox: readonly PendingLedgerCommand[],
): CanonicalExpense[] {
  const serverRequestIds = new Set(serverExpenses.map((expense) => expense.clientRequestId))
  return [
    ...outbox
      .filter((item) => !serverRequestIds.has(item.command.requestId))
      .map((item) => item.optimisticExpense),
    ...serverExpenses,
  ]
}

export function buildOptimisticExpense(
  draft: LedgerExpenseDraft,
  command: CreateExpenseCommand,
  createdAt = new Date().toISOString(),
): CanonicalExpense {
  const participantsById = new Map(draft.participants.map((participant) => [participant.id, participant]))
  const participations: ExpenseParticipation[] = command.participantIds.map((participantId, index) => {
    const participant = participantsById.get(participantId)
    const isManualDirect = command.scope === 'direct' && participant?.kind === 'manual'
    return {
      id: `pending:${command.requestId}:${index}`,
      expenseId: `pending:${command.requestId}`,
      participantId,
      nameSnapshot: participant?.displayName ?? participantId,
      order: index,
      state: isManualDirect
        ? 'untracked'
        : command.scope === 'direct' && participantId !== draft.currentParticipantId
          ? 'pending'
          : 'accepted',
      trackingMode: isManualDirect ? 'untracked' : 'tracked',
    }
  })

  return {
    id: `pending:${command.requestId}`,
    clientRequestId: command.requestId,
    scope: command.scope,
    spaceId: command.spaceId,
    createdBy: draft.currentParticipantId,
    totalMinor: command.totalMinor,
    participantCount: command.participantIds.length,
    currency: command.currency,
    description: command.description,
    category: command.category,
    occurredOn: command.occurredOn,
    status: 'active',
    version: 1,
    correctsExpenseId: null,
    terminationKind: null,
    voidedAt: null,
    createdAt,
    updatedAt: createdAt,
    participations,
    payerContributions: participations.flatMap((participation, index) =>
      command.contributionAmounts[index] > 0
        ? [{
          expenseParticipationId: participation.id,
          expenseId: `pending:${command.requestId}`,
          amountMinor: command.contributionAmounts[index],
        }]
        : [],
    ),
    shares: participations.map((participation, index) => ({
      expenseParticipationId: participation.id,
      expenseId: `pending:${command.requestId}`,
      amountMinor: command.shareAmounts[index],
    })),
  }
}

export function createPendingLedgerCommand(
  draft: LedgerExpenseDraft,
  command: CreateExpenseCommand,
  captureDurationMs: number | null = null,
  createdAt = new Date().toISOString(),
): PendingLedgerCommand {
  return {
    command,
    optimisticExpense: buildOptimisticExpense(draft, command, createdAt),
    status: 'pending',
    commitState: 'not_started',
    attempts: 0,
    error: null,
    createdAt,
    captureDurationMs,
    captureSource: draft.captureSource ?? 'manual',
  }
}

export function expenseMatchesCreateCommand(
  expense: CanonicalExpense,
  command: CreateExpenseCommand,
): boolean {
  const participations = [...expense.participations].sort((a, b) => a.order - b.order)
  if (
    expense.clientRequestId !== command.requestId
    || expense.scope !== command.scope
    || expense.spaceId !== command.spaceId
    || expense.totalMinor !== command.totalMinor
    || expense.currency !== command.currency
    || expense.description !== command.description
    || expense.category !== command.category
    || expense.occurredOn !== command.occurredOn
    || participations.length !== command.participantIds.length
  ) return false

  return participations.every((participation, index) => {
    const contribution = expense.payerContributions.find((item) => (
      item.expenseParticipationId === participation.id
    ))?.amountMinor ?? 0
    const share = expense.shares.find((item) => (
      item.expenseParticipationId === participation.id
    ))?.amountMinor ?? 0
    return (
      participation.participantId === command.participantIds[index]
      && contribution === command.contributionAmounts[index]
      && share === command.shareAmounts[index]
    )
  })
}

export type FlushOutboxCallbacks = {
  claimForDispatch: (requestId: string) => PendingLedgerCommand | null
  acknowledge: (requestId: string, expenseId: string) => void
  adopt: (requestId: string, expense: CanonicalExpense) => void
  reject: (
    requestId: string,
    error: string,
    commitState: 'unknown' | 'not_committed',
  ) => void
}

export async function flushLedgerOutbox(
  repository: LedgerRepository,
  items: readonly PendingLedgerCommand[],
  callbacks: FlushOutboxCallbacks,
): Promise<void> {
  for (const item of items) {
    if (item.status !== 'pending') continue
    const claimed = callbacks.claimForDispatch(item.command.requestId)
    if (!claimed) continue
    try {
      const expenseId = await repository.createExpense(claimed.command)
      callbacks.acknowledge(claimed.command.requestId, expenseId)
    } catch (error) {
      if (error instanceof LedgerRepositoryError && error.code === 'not_configured') return
      try {
        const committed = await repository.findExpenseByRequestId(
          claimed.command.requestId,
        )
        if (committed) {
          if (expenseMatchesCreateCommand(committed, claimed.command)) {
            callbacks.adopt(claimed.command.requestId, committed)
          } else {
            callbacks.reject(
              claimed.command.requestId,
              'request_id_reconciliation_conflict',
              'unknown',
            )
          }
          continue
        }
      } catch {
        // A failed reconciliation query cannot prove whether the create committed.
      }
      callbacks.reject(
        claimed.command.requestId,
        error instanceof Error ? error.message : 'server_rejected',
        error instanceof LedgerRepositoryError && error.outcome === 'definitive'
          ? 'not_committed'
          : 'unknown',
      )
    }
  }
}

export async function drainLedgerOutbox(
  repository: LedgerRepository,
  getItems: () => readonly PendingLedgerCommand[],
  callbacks: FlushOutboxCallbacks,
): Promise<void> {
  const processedRequestIds = new Set<string>()
  while (true) {
    const items = getItems().filter((item) => (
      item.status === 'pending'
      && !processedRequestIds.has(item.command.requestId)
    ))
    if (items.length === 0) return
    items.forEach((item) => processedRequestIds.add(item.command.requestId))
    await flushLedgerOutbox(repository, items, callbacks)
  }
}

export async function reconcileUncertainLedgerCommands(
  repository: LedgerRepository,
  items: readonly PendingLedgerCommand[],
  callbacks: Pick<FlushOutboxCallbacks, 'adopt' | 'reject'>,
): Promise<void> {
  for (const item of items) {
    if (
      item.status !== 'retrying'
      && item.commitState !== 'unknown'
    ) continue
    try {
      const committed = await repository.findExpenseByRequestId(
        item.command.requestId,
      )
      if (committed) {
        if (expenseMatchesCreateCommand(committed, item.command)) {
          callbacks.adopt(item.command.requestId, committed)
        } else {
          callbacks.reject(
            item.command.requestId,
            'request_id_reconciliation_conflict',
            'unknown',
          )
        }
      } else if (item.status === 'retrying') {
        callbacks.reject(
          item.command.requestId,
          'server_outcome_unknown',
          'unknown',
        )
      }
    } catch {
      if (item.status === 'retrying') {
        callbacks.reject(
          item.command.requestId,
          'server_outcome_unknown',
          'unknown',
        )
      }
    }
  }
}
