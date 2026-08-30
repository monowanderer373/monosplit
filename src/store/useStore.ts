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
  markLedgerCommandRetrying: (identityId: string, requestId: string) => void
  acknowledgeLedgerCommand: (identityId: string, requestId: string, serverExpenseId: string) => void
  rejectLedgerCommand: (identityId: string, requestId: string, error: string) => void
  retryLedgerCommand: (identityId: string, requestId: string) => void
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
  }

  delete state.fontId
  delete state.groups
  delete state.hiddenDeletedGroupIds
  delete state.myPersonIdByGroupId
  return state
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
      markLedgerCommandRetrying: (identityId, requestId) => {
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
                    ? { ...item, status: 'retrying', attempts: item.attempts + 1, error: null }
                    : item
                )),
              },
            },
          }
        })
      },
      acknowledgeLedgerCommand: (identityId, requestId, serverExpenseId) => {
        set((state) => {
          const partition = state.ledgerByIdentity[identityId]
          if (!partition) return state
          return {
            ledgerByIdentity: {
              ...state.ledgerByIdentity,
              [identityId]: {
                expenses: partition.expenses.map((expense) => (
                  expense.clientRequestId === requestId
                    ? { ...expense, id: serverExpenseId, updatedAt: new Date().toISOString() }
                    : expense
                )),
                outbox: partition.outbox.filter((item) => item.command.requestId !== requestId),
              },
            },
          }
        })
      },
      rejectLedgerCommand: (identityId, requestId, error) => {
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
                    ? { ...item, status: 'rejected', error }
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
                    ? { ...expense, status: 'voided', voidedAt: new Date().toISOString() }
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
      version: 7,
      migrate: migratePersistedState,
      partialize: (state) => ({
        lang: state.lang,
        themeId: state.themeId,
        ledgerByIdentity: state.ledgerByIdentity,
      }),
    },
  ),
)
