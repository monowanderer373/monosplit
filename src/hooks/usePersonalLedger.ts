import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
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
  reconcileUncertainLedgerCommands,
} from '../lib/ledgerOutbox'
import { LedgerRepositoryError } from '../lib/ledgerRepository'
import {
  derivePersonalLedgerRows,
  totalPersonalLedgerRows,
} from '../lib/ledgerSummary'
import { isOwnerLocalExpense } from '../lib/expenseActionPolicy'
import { recordProductEvent } from '../lib/productEvents'
import { supabase } from '../lib/supabase'
import {loadPersonalPeriods,NO_PERIOD_CAPABILITY,type PeriodState} from '../lib/personalPeriods'

const EMPTY_EXPENSES: never[] = []

function usePersonalLedgerController() {
  const flushingRef = useRef(false)
  const readGeneration = useRef(0)
  const invalidateRead = useCallback(() => { readGeneration.current += 1 }, [])
  const activeIdentity = useRef<string | null>(null)
  const [verifiedIdentity, setVerifiedIdentity] = useState<string | null>(null)
  const discardUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [discardUndo, setDiscardUndo] = useState<{
    item: ReturnType<typeof createPendingLedgerCommand>
    expiresAt: number
  } | null>(null)
  const [restoreCandidate, setRestoreCandidate] = useState<{
    expenseId: string
    expectedVersion: number
    description: string | null
  } | null>(null)
  const [expensesStatus, setExpensesStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const { authUser } = useAuth()
  const identityId = authUser?.id ?? null
  const participantId = authUser?.participantId ?? null
  const partition = useStore((state) => (
    identityId ? state.ledgerByIdentity[identityId] : undefined
  ))
  const [periodRead,setPeriodRead]=useState<{identity:string|null;state:PeriodState;status:'loading'|'ready'|'error'}>({identity:null,state:NO_PERIOD_CAPABILITY,status:'loading'})
  const periodGeneration=useRef(0)
  const refreshPeriods=useCallback(async()=>{
    if(!identityId||!participantId||activeIdentity.current!==identityId)return
    const generation=++periodGeneration.current
    try{
      const state=authUser?.isAnonymous?NO_PERIOD_CAPABILITY:await loadPersonalPeriods(participantId)
      if(generation===periodGeneration.current&&activeIdentity.current===identityId)setPeriodRead({identity:identityId,state,status:'ready'})
    }catch{
      if(generation===periodGeneration.current&&activeIdentity.current===identityId)setPeriodRead(old=>({identity:identityId,state:old.identity===identityId?old.state:NO_PERIOD_CAPABILITY,status:'error'}))
    }
  },[identityId,participantId,authUser?.isAnonymous])
  const setLedgerExpenses = useStore((state) => state.setLedgerExpenses)
  const queueLedgerCommand = useStore((state) => state.queueLedgerCommand)
  const claimLedgerCommand = useStore((state) => state.claimLedgerCommand)
  const acknowledgeLedgerCommand = useStore((state) => state.acknowledgeLedgerCommand)
  const adoptLedgerCommand = useStore((state) => state.adoptLedgerCommand)
  const rejectLedgerCommand = useStore((state) => state.rejectLedgerCommand)
  const retryLedgerCommand = useStore((state) => state.retryLedgerCommand)
  const discardUnflushedLedgerCommand = useStore(
    (state) => state.discardUnflushedLedgerCommand,
  )
  const discardRejectedLedgerCommand = useStore(
    (state) => state.discardRejectedLedgerCommand,
  )
  const voidCachedLedgerExpense = useStore((state) => state.voidCachedLedgerExpense)

  useEffect(() => {
    setDiscardUndo(null)
    setRestoreCandidate(null)
    if (discardUndoTimerRef.current) {
      clearTimeout(discardUndoTimerRef.current)
      discardUndoTimerRef.current = null
    }
    return () => {
      if (discardUndoTimerRef.current) clearTimeout(discardUndoTimerRef.current)
    }
  }, [identityId])

  const refresh = useCallback(async () => {
    if (!identityId || !participantId || activeIdentity.current !== identityId) return
    const generation = ++readGeneration.current
    const periodRead=refreshPeriods()
    setExpensesStatus((current) => (current === 'ready' ? current : 'loading'))
    try {
      const expenses = await ledgerRepository.listExpenses()
      if (generation !== readGeneration.current || activeIdentity.current !== identityId) return
      setLedgerExpenses(identityId, expenses)
      setVerifiedIdentity(identityId)
      setExpensesStatus('ready')
    } catch {
      // Drop late responses from another identity or an older refresh.
      if (generation !== readGeneration.current || activeIdentity.current !== identityId) return
      setVerifiedIdentity(identityId)
      // Keep cached rows internally; consumers must not present a failed read as verified.
      setExpensesStatus('error')
    }finally{await periodRead}
  }, [identityId, participantId, setLedgerExpenses,refreshPeriods])

  const flush = useCallback(async () => {
    if (!identityId || !participantId || !navigator.onLine || flushingRef.current) return
    flushingRef.current = true
    try {
      const callbacks = {
        claimForDispatch: (requestId: string) => (
          claimLedgerCommand(identityId, requestId)
        ),
        adopt: (requestId: string, expense: Parameters<typeof adoptLedgerCommand>[2]) => {
          adoptLedgerCommand(identityId, requestId, expense)
        },
        reject: (
          requestId: string,
          error: string,
          commitState: 'unknown' | 'not_committed',
        ) => rejectLedgerCommand(identityId, requestId, error, commitState),
        acknowledge: (requestId: string, expenseId: string) => {
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
      }
      await reconcileUncertainLedgerCommands(
        ledgerRepository,
        useStore.getState().ledgerByIdentity[identityId]?.outbox ?? [],
        callbacks,
      )
      await drainLedgerOutbox(
        ledgerRepository,
        () => navigator.onLine
          ? useStore.getState().ledgerByIdentity[identityId]?.outbox ?? []
          : [],
        callbacks,
      )
      await refresh()
    } finally {
      flushingRef.current = false
    }
  }, [
    acknowledgeLedgerCommand,
    adoptLedgerCommand,
    claimLedgerCommand,
    identityId,
    participantId,
    rejectLedgerCommand,
    refresh,
  ])

  useEffect(() => {
    activeIdentity.current = identityId
    setExpensesStatus('loading')
    void refresh()
    // An empty outbox has nothing to reconcile or dispatch. Calling flush here
    // also performs a second full expense read and restarts Home/notice loads.
    // Reconnect and actual queued commands retain the original flush path.
    if (identityId && useStore.getState().ledgerByIdentity[identityId]?.outbox.length) void flush()
    const handleOnline = () => void flush()
    const scheduleSharedRefresh=()=>void refresh()
    const handlePeriodRead=()=>void refreshPeriods()
    const handlePeriodChanged=()=>{
      setPeriodRead(old=>old.identity===identityId?{...old,status:'loading'}:old)
      void refreshPeriods()
    }
    window.addEventListener('focus',handlePeriodRead)
    window.addEventListener('tt:accounts-changed',handlePeriodRead)
    window.addEventListener('tt:personal-period-changed',handlePeriodChanged)
    window.addEventListener('tt:personal-periods-changed',scheduleSharedRefresh)
    window.addEventListener('tt:shared-restart-changed',scheduleSharedRefresh)
    window.addEventListener('online', handleOnline)
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleAuthoritativeRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => void refresh(), 80)
    }
    const channel = identityId && supabase
      ? supabase
        .channel(`ledger:${identityId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, scheduleAuthoritativeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_participations' }, scheduleAuthoritativeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payer_contributions' }, scheduleAuthoritativeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_shares' }, scheduleAuthoritativeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_ledger_periods' }, handlePeriodChanged)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_restart_retags' }, scheduleAuthoritativeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_restart_expenses' }, scheduleAuthoritativeRefresh)
        .subscribe()
      : null
    return () => {
      activeIdentity.current = null
      invalidateRead()
      // This is a request generation counter, not a DOM ref. Invalidate on cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      periodGeneration.current++
      window.removeEventListener('focus',handlePeriodRead)
      window.removeEventListener('tt:accounts-changed',handlePeriodRead)
      window.removeEventListener('tt:personal-period-changed',handlePeriodChanged)
      window.removeEventListener('tt:personal-periods-changed',scheduleSharedRefresh)
      window.removeEventListener('tt:shared-restart-changed',scheduleSharedRefresh)
      window.removeEventListener('online', handleOnline)
      if (refreshTimer) clearTimeout(refreshTimer)
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [flush, identityId, refresh, invalidateRead,refreshPeriods])

  const hasDispatchableCommands = Boolean(partition?.outbox.some(
    (item) => item.status === 'pending',
  ))
  useEffect(() => {
    if (!hasDispatchableCommands) return
    const retryTimer = setInterval(() => {
      if (navigator.onLine) void flush()
    }, 1_000)
    return () => clearInterval(retryTimer)
  }, [flush, hasDispatchableCommands])

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
    const remaining = useStore
      .getState()
      .ledgerByIdentity[identityId]?.outbox
      .find((item) => item.command.requestId === result.command.requestId)
    if (remaining?.status === 'rejected') {
      return {
        ok: true as const,
        requestId: result.command.requestId,
        saveState: 'needs-attention' as const,
      }
    }
    const awaitingConfirmation =
      !remaining
      && result.command.scope === 'direct'
      && draft.participants.some(
        (candidate) =>
          candidate.id !== draft.currentParticipantId
          && candidate.kind === 'account',
      )
    return {
      ok: true as const,
      requestId: result.command.requestId,
      saveState: remaining
        ? 'pending-sync' as const
        : awaitingConfirmation
          ? 'awaiting-confirmation' as const
          : 'recorded' as const,
    }
  }, [flush, identityId, participantId, queueLedgerCommand])

  const voidExpense = useCallback(async (expenseId: string) => {
    if (!identityId) return
    const expense = useStore.getState().ledgerByIdentity[identityId]?.expenses
      .find((candidate) => candidate.id === expenseId)
    if (!expense) {
      throw new LedgerRepositoryError('not_found', 'expense_not_found')
    }
    if (expenseId.startsWith('pending:')) {
      if (!discardUnflushedLedgerCommand(identityId, expense.clientRequestId)) {
        throw new LedgerRepositoryError(
          'server_rejected',
          'command_already_dispatching',
        )
      }
      return
    }
    const nextVersion = await ledgerRepository.voidExpense(expenseId, expense.version)
    voidCachedLedgerExpense(identityId, expenseId)
    if (participantId && isOwnerLocalExpense(expense, participantId)) {
      setRestoreCandidate({
        expenseId,
        expectedVersion: nextVersion,
        description: expense.description,
      })
    }
  }, [
    discardUnflushedLedgerCommand,
    identityId,
    participantId,
    voidCachedLedgerExpense,
  ])

  const retryCommand = useCallback(async (requestId: string) => {
    if (!identityId) return
    retryLedgerCommand(identityId, requestId)
    await flush()
  }, [flush, identityId, retryLedgerCommand])

  const discardLocalCreate = useCallback((requestId: string) => {
    if (!identityId) return false
    const item = discardUnflushedLedgerCommand(identityId, requestId)
    if (!item) return false
    if (discardUndoTimerRef.current) clearTimeout(discardUndoTimerRef.current)
    const expiresAt = Date.now() + 8_000
    setDiscardUndo({ item, expiresAt })
    discardUndoTimerRef.current = setTimeout(() => setDiscardUndo(null), 8_000)
    return true
  }, [discardUnflushedLedgerCommand, identityId])

  const undoLocalDiscard = useCallback(async () => {
    if (!identityId || !discardUndo || discardUndo.expiresAt <= Date.now()) {
      setDiscardUndo(null)
      return false
    }
    queueLedgerCommand(identityId, discardUndo.item)
    setDiscardUndo(null)
    if (discardUndoTimerRef.current) clearTimeout(discardUndoTimerRef.current)
    await flush()
    return true
  }, [discardUndo, flush, identityId, queueLedgerCommand])

  const discardFailedCreate = useCallback((requestId: string) => (
    Boolean(identityId && discardRejectedLedgerCommand(identityId, requestId))
  ), [discardRejectedLedgerCommand, identityId])

  const restoreOwnerLocalCancellation = useCallback(async () => {
    if (!restoreCandidate) return false
    await ledgerRepository.restoreOwnerLocalExpense(
      restoreCandidate.expenseId,
      restoreCandidate.expectedVersion,
    )
    setRestoreCandidate(null)
    await refresh()
    return true
  }, [refresh, restoreCandidate])

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
    periodState:periodRead.identity===identityId?periodRead.state:null,
    periodStatus:periodRead.identity===identityId?periodRead.status:'loading' as const,
    refreshPeriods,
    expensesStatus: verifiedIdentity === identityId ? expensesStatus : 'loading' as const,
    rows,
    totals,
    outbox: partition?.outbox ?? [],
    refresh,
    flush,
    saveDraft,
    retryCommand,
    discardLocalCreate,
    undoLocalDiscard,
    discardFailedCreate,
    discardUndo,
    restoreCandidate,
    restoreOwnerLocalCancellation,
    clearRestoreCandidate: () => setRestoreCandidate(null),
    voidExpense,
  }
}

type PersonalLedgerContextValue = ReturnType<typeof usePersonalLedgerController>

const PersonalLedgerContext = createContext<PersonalLedgerContextValue | null>(null)

export function PersonalLedgerProvider({ children }: { children: ReactNode }) {
  const value = usePersonalLedgerController()
  return createElement(PersonalLedgerContext.Provider, { value }, children)
}

export function usePersonalLedger(): PersonalLedgerContextValue {
  const value = useContext(PersonalLedgerContext)
  if (!value) throw new Error('usePersonalLedger must be used inside <PersonalLedgerProvider>')
  return value
}
