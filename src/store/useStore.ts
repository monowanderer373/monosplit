import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mergeServerExpensesWithOutbox } from '../lib/ledgerOutbox'
import { DEFAULT_THEME_ID, resolveThemeId } from '../lib/themes'
import type { CreateExpenseCommand, LedgerExpenseDraft } from '../lib/compileExpense'
import type { CanonicalExpense } from '../types'

export type PendingLedgerCommand = {
  command: CreateExpenseCommand
  optimisticExpense: CanonicalExpense
  status: 'pending' | 'retrying' | 'rejected'
  commitState: 'not_started' | 'dispatching' | 'unknown' | 'not_committed'
  attempts: number
  error: string | null
  createdAt: string
  captureDurationMs: number | null
  captureSource: NonNullable<LedgerExpenseDraft['captureSource']>
}

type LedgerPartition = {
  expenses: CanonicalExpense[]
  outbox: PendingLedgerCommand[]
}

type AppState = {
  lang: 'en' | 'zh'
  setLang: (lang: 'en' | 'zh') => void
  themeId: string
  setThemeId: (id: string) => void
  ledgerByIdentity: Record<string, LedgerPartition>
  setLedgerExpenses: (identityId: string, expenses: CanonicalExpense[]) => void
  queueLedgerCommand: (identityId: string, item: PendingLedgerCommand) => void
  claimLedgerCommand: (identityId: string, requestId: string) => PendingLedgerCommand | null
  acknowledgeLedgerCommand: (identityId: string, requestId: string, serverExpenseId: string) => void
  adoptLedgerCommand: (identityId: string, requestId: string, expense: CanonicalExpense) => void
  rejectLedgerCommand: (
    identityId: string,
    requestId: string,
    error: string,
    commitState: 'unknown' | 'not_committed',
  ) => void
  retryLedgerCommand: (identityId: string, requestId: string) => void
  discardUnflushedLedgerCommand: (
    identityId: string,
    requestId: string,
  ) => PendingLedgerCommand | null
  discardRejectedLedgerCommand: (identityId: string, requestId: string) => boolean
  voidCachedLedgerExpense: (identityId: string, expenseId: string) => void
  clearLedgerIdentity: (identityId: string) => void
}

export function migratePersistedState(persisted: unknown): Record<string, unknown> {
  const state = persisted && typeof persisted === 'object'
    ? { ...(persisted as Record<string, unknown>) }
    : {}

  state.themeId = resolveThemeId(state.themeId as string | undefined)
  if (!state.ledgerByIdentity || typeof state.ledgerByIdentity !== 'object') {
    state.ledgerByIdentity = {}
  } else {
    state.ledgerByIdentity = migrateLedgerPartitions(state.ledgerByIdentity)
  }

  delete state.fontId
  delete state.groups
  delete state.hiddenDeletedGroupIds
  delete state.myPersonIdByGroupId
  return state
}

function migrateLedgerPartitions(value: unknown): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([identityId, rawPartition]) => {
    if (!rawPartition || typeof rawPartition !== 'object') return [identityId, rawPartition]
    const partition = { ...(rawPartition as Record<string, unknown>) }
    if (!Array.isArray(partition.outbox)) return [identityId, partition]
    partition.outbox = partition.outbox.map((rawItem) => {
      if (!rawItem || typeof rawItem !== 'object') return rawItem
      const item = { ...(rawItem as Record<string, unknown>) }
      if (typeof item.commitState === 'string') return item
      item.commitState = item.status === 'pending' && item.attempts === 0
        ? 'not_started'
        : 'unknown'
      return item
    })
    return [identityId, partition]
  }))
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      lang: 'en' as 'en' | 'zh',
      setLang: (lang: 'en' | 'zh') => set({ lang }),
      themeId: DEFAULT_THEME_ID,
      setThemeId: (id: string) => set({ themeId: resolveThemeId(id) }),
      ledgerByIdentity: {},
      setLedgerExpenses: (identityId, expenses) => {
        set((state) => {
          const outbox = state.ledgerByIdentity[identityId]?.outbox ?? []
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                expenses: mergeServerExpensesWithOutbox(expenses, outbox),
                outbox,
              },
            },
          }
        })
      },
      queueLedgerCommand: (identityId, item) => {
        set((state) => {
          const partition = state.ledgerByIdentity[identityId] ?? { expenses: [], outbox: [] }
          if (partition.outbox.some((entry) => entry.command.requestId === item.command.requestId)) {
            return state
          }
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                expenses: [
                  item.optimisticExpense,
                  ...partition.expenses.filter(
                    (expense) => expense.clientRequestId !== item.command.requestId,
                  ),
                ],
                outbox: [...partition.outbox, item],
              },
            },
          }
        })
      },
      claimLedgerCommand: (identityId, requestId) => {
        let claimed: PendingLedgerCommand | null = null
        set((state) => {
          const partition = state.ledgerByIdentity[identityId]
          if (!partition) return state
          const candidate = partition.outbox.find((item) => (
            item.command.requestId === requestId && item.status === 'pending'
          ))
          if (!candidate) return state
          claimed = {
            ...candidate,
            status: 'retrying',
            commitState: 'dispatching',
            attempts: candidate.attempts + 1,
            error: null,
          }
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                ...partition,
                outbox: partition.outbox.map((item) => (
                  item.command.requestId === requestId
                    ? claimed!
                    : item
                )),
              },
            },
          }
        })
        return claimed
      },
      acknowledgeLedgerCommand: (identityId, requestId, serverExpenseId) => {
        set((state) => {
          const partition = state.ledgerByIdentity[identityId]
          if (!partition) return state
          const matching = partition.expenses.filter(
            (expense) => expense.clientRequestId === requestId,
          )
          const reconciled = matching[0]
            ? { ...matching[0], id: serverExpenseId, updatedAt: new Date().toISOString() }
            : null
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                expenses: [
                  ...(reconciled ? [reconciled] : []),
                  ...partition.expenses.filter(
                    (expense) => expense.clientRequestId !== requestId,
                  ),
                ],
                outbox: partition.outbox.filter((item) => item.command.requestId !== requestId),
              },
            },
          }
        })
      },
      adoptLedgerCommand: (identityId, requestId, expense) => {
        set((state) => {
          const partition = state.ledgerByIdentity[identityId]
          if (!partition) return state
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                expenses: [
                  expense,
                  ...partition.expenses.filter(
                    (candidate) => candidate.clientRequestId !== requestId,
                  ),
                ],
                outbox: partition.outbox.filter(
                  (item) => item.command.requestId !== requestId,
                ),
              },
            },
          }
        })
      },
      rejectLedgerCommand: (identityId, requestId, error, commitState) => {
        set((state) => {
          const partition = state.ledgerByIdentity[identityId]
          if (!partition) return state
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                ...partition,
                outbox: partition.outbox.map((item) => (
                  item.command.requestId === requestId
                    ? { ...item, status: 'rejected', commitState, error }
                    : item
                )),
              },
            },
          }
        })
      },
      retryLedgerCommand: (identityId, requestId) => {
        set((state) => {
          const partition = state.ledgerByIdentity[identityId]
          if (!partition) return state
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                ...partition,
                outbox: partition.outbox.map((item) => (
                  item.command.requestId === requestId
                    ? { ...item, status: 'pending', error: null }
                    : item
                )),
              },
            },
          }
        })
      },
      discardUnflushedLedgerCommand: (identityId, requestId) => {
        let discarded: PendingLedgerCommand | null = null
        set((state) => {
          const partition = state.ledgerByIdentity[identityId]
          if (!partition) return state
          const candidate = partition.outbox.find((item) => (
            item.command.requestId === requestId
          ))
          const optimisticExists = partition.expenses.some((expense) => (
            expense.id === `pending:${requestId}`
            && expense.clientRequestId === requestId
          ))
          if (
            !candidate
            || candidate.status !== 'pending'
            || candidate.attempts !== 0
            || candidate.commitState !== 'not_started'
            || !optimisticExists
          ) return state
          discarded = candidate
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                expenses: partition.expenses.filter(
                  (expense) => expense.clientRequestId !== requestId,
                ),
                outbox: partition.outbox.filter(
                  (item) => item.command.requestId !== requestId,
                ),
              },
            },
          }
        })
        return discarded
      },
      discardRejectedLedgerCommand: (identityId, requestId) => {
        let discarded = false
        set((state) => {
          const partition = state.ledgerByIdentity[identityId]
          if (!partition) return state
          const candidate = partition.outbox.find((item) => (
            item.command.requestId === requestId
          ))
          if (
            !candidate
            || candidate.status !== 'rejected'
            || candidate.commitState !== 'not_committed'
          ) return state
          discarded = true
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                expenses: partition.expenses.filter(
                  (expense) => expense.clientRequestId !== requestId,
                ),
                outbox: partition.outbox.filter(
                  (item) => item.command.requestId !== requestId,
                ),
              },
            },
          }
        })
        return discarded
      },
      voidCachedLedgerExpense: (identityId, expenseId) => {
        set((state) => {
          const partition = state.ledgerByIdentity[identityId]
          if (!partition) return state
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                ...partition,
                expenses: partition.expenses.map((expense) => (
                  expense.id === expenseId
                    ? {
                      ...expense,
                      status: 'voided',
                      terminationKind: 'cancelled',
                      voidedAt: new Date().toISOString(),
                    }
                    : expense
                )),
              },
            },
          }
        })
      },
      clearLedgerIdentity: (identityId) => {
        set((state) => {
          const ledgerByIdentity = { ...state.ledgerByIdentity }
          delete ledgerByIdentity[identityId]
          return { ledgerByIdentity }
        })
      },
    }),
    {
      name: 'monosplit-storage',
      version: 8,
      migrate: migratePersistedState,
      partialize: (state) => ({
        lang: state.lang,
        themeId: state.themeId,
        ledgerByIdentity: state.ledgerByIdentity,
      }),
    },
  ),
)
