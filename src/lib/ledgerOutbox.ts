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
    attempts: 0,
    error: null,
    createdAt,
    captureDurationMs,
    captureSource: draft.captureSource ?? 'manual',
  }
}

export type FlushOutboxCallbacks = {
  markRetrying: (requestId: string) => void
  acknowledge: (requestId: string, expenseId: string) => void
  reject: (requestId: string, error: string) => void
}

export async function flushLedgerOutbox(
  repository: LedgerRepository,
  items: readonly PendingLedgerCommand[],
  callbacks: FlushOutboxCallbacks,
): Promise<void> {
  for (const item of items) {
    if (item.status === 'rejected') continue
    callbacks.markRetrying(item.command.requestId)
    try {
      const expenseId = await repository.createExpense(item.command)
      callbacks.acknowledge(item.command.requestId, expenseId)
    } catch (error) {
      if (error instanceof LedgerRepositoryError && error.code === 'not_configured') return
      callbacks.reject(
        item.command.requestId,
        error instanceof Error ? error.message : 'server_rejected',
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
      item.status !== 'rejected'
      && !processedRequestIds.has(item.command.requestId)
    ))
    if (items.length === 0) return
    items.forEach((item) => processedRequestIds.add(item.command.requestId))
    await flushLedgerOutbox(repository, items, callbacks)
  }
}
