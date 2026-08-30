import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAuth } from './useAuth'
import { useStore } from '../store/useStore'
import {
  compileLedgerExpense,
  type LedgerExpenseDraft,
} from '../lib/compileExpense'
import { ledgerRepository } from '../lib/ledgerRepository'
import {
  createPendingLedgerCommand,
  drainLedgerOutbox,
} from '../lib/ledgerOutbox'
import {
  derivePersonalLedgerRows,
  totalPersonalLedgerRows,
} from '../lib/ledgerSummary'
import { recordProductEvent } from '../lib/productEvents'
import { supabase } from '../lib/supabase'

const EMPTY_EXPENSES: never[] = []

export function usePersonalLedger() {
  const flushingRef = useRef(false)
  const { authUser } = useAuth()
  const identityId = authUser?.id ?? null
  const participantId = authUser?.participantId ?? null
  const partition = useStore((state) => (
    identityId ? state.ledgerByIdentity[identityId] : undefined
  ))
  const setLedgerExpenses = useStore((state) => state.setLedgerExpenses)
  const queueLedgerCommand = useStore((state) => state.queueLedgerCommand)
  const markLedgerCommandRetrying = useStore((state) => state.markLedgerCommandRetrying)
  const acknowledgeLedgerCommand = useStore((state) => state.acknowledgeLedgerCommand)
  const rejectLedgerCommand = useStore((state) => state.rejectLedgerCommand)
  const retryLedgerCommand = useStore((state) => state.retryLedgerCommand)
  const voidCachedLedgerExpense = useStore((state) => state.voidCachedLedgerExpense)

  const refresh = useCallback(async () => {
    if (!identityId || !participantId) return
    try {
      const expenses = await ledgerRepository.listExpenses()
      setLedgerExpenses(identityId, expenses)
    } catch {
      // Cached rows remain visible while offline or before migrations are applied.
    }
  }, [identityId, participantId, setLedgerExpenses])

  const flush = useCallback(async () => {
    if (!identityId || !participantId || !navigator.onLine || flushingRef.current) return
    flushingRef.current = true
    try {
      await drainLedgerOutbox(
        ledgerRepository,
        () => navigator.onLine
          ? useStore.getState().ledgerByIdentity[identityId]?.outbox ?? []
          : [],
        {
          markRetrying: (requestId) => markLedgerCommandRetrying(identityId, requestId),
          acknowledge: (requestId, expenseId) => {
            const item = useStore.getState().ledgerByIdentity[identityId]?.outbox
              .find((candidate) => candidate.command.requestId === requestId)
            acknowledgeLedgerCommand(identityId, requestId, expenseId)
            void recordProductEvent({
              participantId,
              eventName: 'quick_add_saved',
              source: item?.captureSource ?? 'manual',
              durationMs: item?.captureDurationMs ?? undefined,
              succeeded: true,
              metadata: { scope: item?.command.scope ?? 'personal' },
            })
          },
          reject: (requestId, error) => rejectLedgerCommand(identityId, requestId, error),
        },
      )
    } finally {
      flushingRef.current = false
    }
  }, [
    acknowledgeLedgerCommand,
    identityId,
    markLedgerCommandRetrying,
    participantId,
    rejectLedgerCommand,
  ])

  useEffect(() => {
    void refresh()
    void flush()
    const handleOnline = () => void flush()
    window.addEventListener('online', handleOnline)
    const channel = identityId && supabase
      ? supabase
        .channel(`ledger:${identityId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => void refresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_participations' }, () => void refresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payer_contributions' }, () => void refresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_shares' }, () => void refresh())
        .subscribe()
      : null
    return () => {
      window.removeEventListener('online', handleOnline)
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [flush, identityId, refresh])

  const saveDraft = useCallback(async (
    draft: LedgerExpenseDraft,
    startedAtMs: number,
  ) => {
    if (!identityId || !participantId) {
      return { ok: false as const, error: 'not_authenticated' }
    }
    const result = compileLedgerExpense(draft)
    if (!result.ok) {
      void recordProductEvent({
        participantId,
        eventName: 'quick_add_failed',
        source: draft.captureSource ?? 'manual',
        durationMs: Math.max(0, Date.now() - startedAtMs),
        succeeded: false,
        metadata: { reason: result.error },
      })
      return result
    }

    const captureDurationMs = Math.max(0, Date.now() - startedAtMs)
    const pending = createPendingLedgerCommand(draft, result.command, captureDurationMs)
    queueLedgerCommand(identityId, pending)
    await flush()
    return { ok: true as const, requestId: result.command.requestId }
  }, [flush, identityId, participantId, queueLedgerCommand])

  const voidExpense = useCallback(async (expenseId: string) => {
    if (!identityId) return
    if (!expenseId.startsWith('pending:')) await ledgerRepository.voidExpense(expenseId)
    voidCachedLedgerExpense(identityId, expenseId)
  }, [identityId, voidCachedLedgerExpense])

  const retryCommand = useCallback(async (requestId: string) => {
    if (!identityId) return
    retryLedgerCommand(identityId, requestId)
    await flush()
  }, [flush, identityId, retryLedgerCommand])

  const expenses = partition?.expenses ?? EMPTY_EXPENSES
  const rows = useMemo(
    () => participantId ? derivePersonalLedgerRows(expenses, participantId) : [],
    [expenses, participantId],
  )
  const totals = useMemo(() => totalPersonalLedgerRows(rows), [rows])

  return {
    identityId,
    participantId,
    expenses,
    rows,
    totals,
    outbox: partition?.outbox ?? [],
    refresh,
    flush,
    saveDraft,
    retryCommand,
    voidExpense,
  }
}
