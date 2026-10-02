import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import {
  useMoneyActionHistory,
  type MoneyActionState,
} from './useMoneyActionHistory'
import { usePersonalLedger } from './usePersonalLedger'
import type { LedgerExpenseDraft } from '../lib/compileExpense'
import { generateId } from '../lib/id'
import { readQuickDraft, writeQuickDraft } from '../lib/quickDraft'
import type { MoneyContextRef } from '../lib/moneyContext'
import { resolveMoneyContext } from '../lib/moneyContextCatalog'
import {
  createUniversalQuickAddSession,
  hasCustomContextConfiguration,
  remapQuickAddParticipant,
  switchUniversalQuickAddContext,
  updateUniversalQuickAddValues,
  type ContextSwitchPolicy,
  type QuickAddEntryPoint,
  type ResolvedMoneyContext,
  type SaveFeedbackState,
  type UniversalQuickAddSession,
  type UniversalQuickAddValues,
} from '../lib/universalQuickAdd'

type SaveResult = Readonly<{
  ok: boolean
  error?: string
  saveState?: SaveFeedbackState['kind']
}>

type OpenRequest = Readonly<{
  entryPoint: QuickAddEntryPoint
  context?: ResolvedMoneyContext | MoneyContextRef | null
  spaceCandidateId?: string
  personCandidateId?: string
  contextPolicy?: ContextSwitchPolicy
  captureSource?: UniversalQuickAddSession['captureSource']
  initialValues?: Partial<UniversalQuickAddValues>
  clientRequestId?: string
  directDeepLink?: boolean
  onSave?: (
    draft: LedgerExpenseDraft,
    startedAtMs: number,
  ) => Promise<SaveResult>
  onSaved?: () => void | Promise<void>
}>

type SessionCallbacks = Pick<OpenRequest, 'onSave' | 'onSaved'>

type UniversalQuickAddContextValue = Readonly<{
  action: MoneyActionState | null
  session: UniversalQuickAddSession | null
  feedback: SaveFeedbackState | null
  resolving: boolean
  contextError: boolean
  pendingSwitch: MoneyContextRef | null
  open: (request: OpenRequest) => void
  selectEntryContext: (context: MoneyContextRef) => void
  openSwitchPicker: () => void
  cancelPicker: () => void
  requestContextSwitch: (context: MoneyContextRef) => void
  confirmContextSwitch: () => void
  cancelContextSwitchWarning: () => void
  updateValues: (patch: Partial<UniversalQuickAddValues>) => void
  configureSplit: (ref: MoneyContextRef, selectedIds?: string[]) => Promise<boolean>
  submit: (options?: { continueAdding?: boolean; beforeClose?: () => Promise<void>; values?: Partial<UniversalQuickAddValues> }) => Promise<SaveResult>
  close: () => void
  clearFeedback: () => void
}>

const UniversalQuickAddContext =
  createContext<UniversalQuickAddContextValue | null>(null)

function isResolvedMoneyContext(
  context: ResolvedMoneyContext | MoneyContextRef,
): context is ResolvedMoneyContext {
  return 'currentParticipantId' in context
}

function sameContext(left: MoneyContextRef, right: MoneyContextRef): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'personal' && right.kind === 'personal') return true
  if (left.kind === 'person' && right.kind === 'person') {
    return left.personId === right.personId
  }
  return left.kind === 'space'
    && right.kind === 'space'
    && left.spaceId === right.spaceId
}

export function UniversalQuickAddProvider({
  identityKey,
  children,
}: {
  identityKey: string
  children: ReactNode
}) {
  const { authUser } = useAuth()
  const ledger = usePersonalLedger()
  const history = useMoneyActionHistory()
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSessionState] = useState<UniversalQuickAddSession | null>(null)
  const sessionRef = useRef<UniversalQuickAddSession | null>(null)
  const callbacksRef = useRef<SessionCallbacks>({})
  const [feedback, setFeedback] = useState<SaveFeedbackState | null>(null)
  const [resolving, setResolving] = useState(false)
  const [contextError, setContextError] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState<MoneyContextRef | null>(null)
  const resolutionGenerationRef = useRef(0)

  const installSession = useCallback((next: UniversalQuickAddSession | null) => {
    sessionRef.current = next
    if (next?.context && next.captureSource === 'manual') writeQuickDraft(identityKey, next)
    setSessionState(next)
  }, [identityKey])

  const resolveRef = useCallback(async (
    ref: MoneyContextRef,
  ): Promise<ResolvedMoneyContext | null> => {
    if (!authUser?.participantId) return null
    return resolveMoneyContext({
      ref,
      currentParticipant: {
        id: authUser.participantId,
        displayName: authUser.displayName ?? authUser.email ?? 'Me',
        kind: 'account',
      },
      defaultCurrency: authUser.defaultCurrency ?? 'MYR',
      isAnonymous: Boolean(authUser.isAnonymous),
    })
  }, [authUser])

  const resolveEntryContext = useCallback(async (
    ref: MoneyContextRef,
    directDeepLink = false,
  ) => {
    const active = sessionRef.current
    if (!active) return
    const generation = ++resolutionGenerationRef.current
    setResolving(true)
    setContextError(false)
    history.replace({
      step: 'resolve-context',
      context: ref,
      mode: 'entry',
      startedAtMs: active.startedAtMs,
    })
    try {
      const resolved = await resolveRef(ref)
      if (
        generation !== resolutionGenerationRef.current
        || sessionRef.current?.sessionId !== active.sessionId
      ) return
      if (!resolved) {
        setContextError(true)
        history.replace({
          step: 'gate',
          excludedSpaceId: ref.kind === 'space' ? ref.spaceId : undefined,
          startedAtMs: active.startedAtMs,
        })
        return
      }
      const next = {
        ...active,
        context: resolved,
        originalContext: active.originalContext ?? resolved.ref,
        values: active.context
          ? active.values
          : {
              ...active.values,
              currency: active.values.selectedParticipantIds.length ? active.values.currency : resolved.defaultCurrency,
              selectedParticipantIds: active.values.selectedParticipantIds.length
                ? [...new Set([resolved.currentParticipantId, ...active.values.selectedParticipantIds.filter(id => resolved.availableParticipants.some(p => p.id === id))])]
                : resolved.ref.kind === 'person'
                  ? [resolved.currentParticipantId, resolved.ref.participantId]
                  : resolved.availableParticipants.map((participant) => participant.id),
            },
      }
      installSession(next)
      history.replace({
        step: 'capture',
        context: resolved.ref,
        startedAtMs: active.startedAtMs,
        directDeepLink,
      })
    } finally {
      if (generation === resolutionGenerationRef.current) {
        setResolving(false)
      }
    }
  }, [history, installSession, resolveRef])

  const open = useCallback((request: OpenRequest) => {
    resolutionGenerationRef.current += 1
    const startedAtMs = Date.now()
    const restore = !request.initialValues && !request.onSave && !request.onSaved && !request.spaceCandidateId && !request.personCandidateId && (request.entryPoint === 'global' || request.entryPoint === 'personal') ? readQuickDraft(identityKey) : null
    const provided = restore?.context?.ref ?? request.context ?? null
    const resolved = provided && isResolvedMoneyContext(provided) ? provided : null
    const unresolved = provided && !isResolvedMoneyContext(provided) ? provided : null
    const next = createUniversalQuickAddSession({
      identityKey,
      sessionId: generateId(),
      clientRequestId: request.clientRequestId ?? restore?.clientRequestId ?? generateId(),
      startedAtMs,
      entryPoint: request.entryPoint,
      captureSource: request.captureSource,
      contextPolicy: request.contextPolicy,
      context: resolved,
      originalContext: resolved?.ref ?? unresolved,
      initialValues: request.initialValues ?? restore?.values,
    })
    callbacksRef.current = {
      onSave: request.onSave,
      onSaved: request.onSaved,
    }
    setFeedback(null)
    setContextError(false)
    setPendingSwitch(null)
    installSession(next)

    if (request.directDeepLink && resolved) {
      const directUrl = `${location.pathname}${location.search}${location.hash}`
      navigate('/', { replace: true })
      navigate(directUrl, {
        state: {
          moneyAction: {
            step: 'capture',
            context: resolved.ref,
            startedAtMs,
            directDeepLink: true,
          } satisfies MoneyActionState,
        },
      })
      return
    }
    if (resolved) {
      history.push({
        step: 'capture',
        context: resolved.ref,
        startedAtMs,
      })
      return
    }
    if (unresolved) {
      history.push({
        step: 'resolve-context',
        context: unresolved,
        mode: 'entry',
        startedAtMs,
      })
      void resolveEntryContext(unresolved)
      return
    }
    if (request.spaceCandidateId) {
      const candidateGeneration = resolutionGenerationRef.current
      history.push({
        step: 'resolve-space',
        spaceId: request.spaceCandidateId,
        startedAtMs,
      })
      void (async () => {
        try {
          const entry = await import('../lib/spaceRepository').then(
            ({ spaceRepository }) => spaceRepository.get(request.spaceCandidateId!),
          )
          if (
            candidateGeneration !== resolutionGenerationRef.current
            || sessionRef.current?.sessionId !== next.sessionId
          ) return
          if (!entry) {
            history.replace({
              step: 'gate',
              excludedSpaceId: request.spaceCandidateId,
              startedAtMs,
            })
            return
          }
          await resolveEntryContext({
            kind: 'space',
            spaceId: entry.space.id,
            spaceType: entry.space.type,
            displayName: entry.space.name,
          })
        } catch {
          if (
            candidateGeneration !== resolutionGenerationRef.current
            || sessionRef.current?.sessionId !== next.sessionId
          ) return
          history.replace({
            step: 'gate',
            excludedSpaceId: request.spaceCandidateId,
            startedAtMs,
          })
        }
      })()
      return
    }
    if (request.personCandidateId) {
      const candidateGeneration = resolutionGenerationRef.current
      history.push({
        step: 'resolve-person',
        personId: request.personCandidateId,
        startedAtMs,
      })
      void (async () => {
        try {
          const { personRepository } = await import('../lib/personRepository')
          const { personToMoneyContext } = await import('../lib/moneyContextCatalog')
          const person = await personRepository.getPerson(request.personCandidateId!)
          if (
            candidateGeneration !== resolutionGenerationRef.current
            || sessionRef.current?.sessionId !== next.sessionId
          ) return
          const personRef = person ? personToMoneyContext(person) : null
          if (!personRef) {
            history.replace({
              step: 'gate',
              startedAtMs,
            })
            return
          }
          await resolveEntryContext(personRef)
        } catch {
          if (
            candidateGeneration !== resolutionGenerationRef.current
            || sessionRef.current?.sessionId !== next.sessionId
          ) return
          history.replace({
            step: 'gate',
            startedAtMs,
          })
        }
      })()
      return
    }
    history.push({ step: 'gate', startedAtMs })
  }, [
    history,
    identityKey,
    installSession,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    resolveEntryContext,
  ])

  const selectEntryContext = useCallback((context: MoneyContextRef) => {
    void resolveEntryContext(context)
  }, [resolveEntryContext])

  const openSwitchPicker = useCallback(() => {
    const active = sessionRef.current
    if (!active || active.contextPolicy === 'locked') return
    setPendingSwitch(null)
    setContextError(false)
    history.push({
      step: 'switch-picker',
      startedAtMs: active.startedAtMs,
    })
  }, [history])

  const commitContextSwitch = useCallback(async (ref: MoneyContextRef) => {
    const active = sessionRef.current
    if (!active || active.contextPolicy === 'locked') return
    const generation = ++resolutionGenerationRef.current
    setResolving(true)
    setContextError(false)
    history.replace({
      step: 'resolve-context',
      context: ref,
      mode: 'switch',
      startedAtMs: active.startedAtMs,
    })
    try {
      const resolved = await resolveRef(ref)
      if (
        generation !== resolutionGenerationRef.current
        || sessionRef.current?.sessionId !== active.sessionId
      ) return
      if (!resolved) {
        setContextError(true)
        history.replace({
          step: 'switch-picker',
          startedAtMs: active.startedAtMs,
        })
        return
      }
      const next = switchUniversalQuickAddContext(active, resolved)
      installSession(next)
      setPendingSwitch(null)
      history.collapseSwitchToCapture({
        step: 'capture',
        context: resolved.ref,
        startedAtMs: active.startedAtMs,
      })
    } finally {
      if (generation === resolutionGenerationRef.current) {
        setResolving(false)
      }
    }
  }, [history, installSession, resolveRef])

  const requestContextSwitch = useCallback((context: MoneyContextRef) => {
    const active = sessionRef.current
    if (!active?.context || active.contextPolicy === 'locked') return
    if (sameContext(active.context.ref, context)) {
      history.close()
      return
    }
    if (hasCustomContextConfiguration(active)) {
      setPendingSwitch(context)
      return
    }
    void commitContextSwitch(context)
  }, [commitContextSwitch, history])

  const confirmContextSwitch = useCallback(() => {
    if (pendingSwitch) void commitContextSwitch(pendingSwitch)
  }, [commitContextSwitch, pendingSwitch])

  const updateValues = useCallback((patch: Partial<UniversalQuickAddValues>) => {
    const active = sessionRef.current
    if (!active) return
    installSession(updateUniversalQuickAddValues(active, patch))
  }, [installSession])

  const configureSplit = useCallback(async (ref: MoneyContextRef, selectedIds?: string[]) => {
    const active = sessionRef.current
    if (!active || active.contextPolicy === 'locked') return false
    const resolved = await resolveRef(ref)
    if (!resolved || sessionRef.current?.sessionId !== active.sessionId) return false
    if (selectedIds?.some(id => !resolved.availableParticipants.some(p => p.id === id))) return false
    const next = switchUniversalQuickAddContext(active, resolved)
    installSession({ ...next, values: { ...next.values,
      currency: active.values.currency,
      category: active.values.category,
      categorySource: active.values.categorySource,
      selectedParticipantIds: selectedIds
        ? [...new Set([resolved.currentParticipantId, ...selectedIds.filter(id => resolved.availableParticipants.some(p => p.id === id))])]
        : next.values.selectedParticipantIds,
    } })
    return true
  }, [installSession, resolveRef])

  const submittingRef = useRef(false)
  const submit = useCallback(async (options?: { continueAdding?: boolean; beforeClose?: () => Promise<void>; values?: Partial<UniversalQuickAddValues> }): Promise<SaveResult> => {
    if (submittingRef.current) return { ok: false, error: 'saving' }
    submittingRef.current = true
    try {
    const active = sessionRef.current
    let context = active?.context
    if (!active || !context) return { ok: false, error: 'invalid_context' }
    let values = { ...active.values, ...options?.values }
    if (context.ref.kind === 'person') {
      const previousParticipantId = context.ref.participantId
      const resolved = await resolveRef(context.ref)
      if (
        !resolved
        || sessionRef.current?.sessionId !== active.sessionId
      ) return { ok: false, error: 'invalid_context' }
      context = resolved
      values = remapQuickAddParticipant(
        values,
        previousParticipantId,
        resolved.ref.kind === 'person'
          ? resolved.ref.participantId
          : previousParticipantId,
      )
    }
    if (values.selectedParticipantIds.some(id => !context.availableParticipants.some(p => p.id === id))) return { ok: false, error: 'invalid_context' }
    const participants = context.availableParticipants.filter((participant) =>
      values.selectedParticipantIds.includes(participant.id),
    )
    const scope =
      context.ref.kind === 'personal'
        ? 'personal'
        : context.ref.kind === 'person'
          ? 'direct'
          : 'space'
    const draft: LedgerExpenseDraft = {
      captureSource: active.captureSource,
      clientRequestId: active.clientRequestId,
      scope,
      spaceId: context.ref.kind === 'space' ? context.ref.spaceId : null,
      currentParticipantId: context.currentParticipantId,
      amount: values.amount,
      currency: values.currency,
      description: values.description,
      category: values.category || 'Other',
      occurredOn: values.occurredOn,
      participants,
      payerAmounts: values.payerAmounts,
      splitMode: values.splitMode,
      exactShareAmounts: values.exactShareAmounts,
      fundingAccountId: values.accountId,
    }
    const result = await (callbacksRef.current.onSave ?? ledger.saveDraft)(
      draft,
      active.startedAtMs,
    )
    if (!result.ok) return result
    try {
      await callbacksRef.current.onSaved?.()
    } catch {
      return { ok: false, error: 'recurring_pending' }
    }
    const saveState = result.saveState ?? 'recorded'
    setFeedback({ kind: saveState })
    writeQuickDraft(identityKey, null)
    if (options?.continueAdding && active.captureSource === 'manual' ) {
      const personal = context.availableParticipants.find(p => p.id === context.currentParticipantId)!
      const nextContext: ResolvedMoneyContext = active.contextPolicy === 'locked' ? context : {
        ref: { kind: 'personal' }, currentParticipantId: personal.id,
        availableParticipants: [personal], defaultCurrency: values.currency,
      }
      const next = createUniversalQuickAddSession({
        identityKey, sessionId: generateId(), clientRequestId: generateId(), startedAtMs: Date.now(),
        entryPoint: active.entryPoint, contextPolicy: active.contextPolicy, context: nextContext,
        initialValues: { category: values.category, categorySource: values.categorySource,
          occurredOn: values.occurredOn, currency: values.currency, accountId: values.accountId },
      })
      callbacksRef.current = {}
      window.dispatchEvent(new Event('tt:accounts-changed'))
      history.replace({ step: 'capture', context: nextContext.ref, startedAtMs: next.startedAtMs })
      installSession(next)
    } else {
      window.dispatchEvent(new Event('tt:accounts-changed'))
      await options?.beforeClose?.()
      history.close()
      installSession(null)
      callbacksRef.current = {}
    }
    return { ...result, saveState }
    } finally { submittingRef.current = false }
  }, [history, identityKey, installSession, ledger.saveDraft, resolveRef])

  const close = useCallback(() => {
    resolutionGenerationRef.current += 1
    history.close()
    installSession(null)
    callbacksRef.current = {}
    setPendingSwitch(null)
  }, [history, installSession])

  const cancelPicker = useCallback(() => {
    resolutionGenerationRef.current += 1
    setPendingSwitch(null)
    setContextError(false)
    history.close()
  }, [history])

  const value: UniversalQuickAddContextValue = {
    action: history.action,
    session,
    feedback,
    resolving,
    contextError,
    pendingSwitch,
    open,
    selectEntryContext,
    openSwitchPicker,
    cancelPicker,
    requestContextSwitch,
    confirmContextSwitch,
    cancelContextSwitchWarning: () => setPendingSwitch(null),
    updateValues,
    configureSplit,
    submit,
    close,
    clearFeedback: () => setFeedback(null),
  }

  return (
    <UniversalQuickAddContext.Provider value={value}>
      {children}
    </UniversalQuickAddContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUniversalQuickAdd(): UniversalQuickAddContextValue {
  const value = useContext(UniversalQuickAddContext)
  if (!value) {
    throw new Error(
      'useUniversalQuickAdd must be used inside <UniversalQuickAddProvider>',
    )
  }
  return value
}
