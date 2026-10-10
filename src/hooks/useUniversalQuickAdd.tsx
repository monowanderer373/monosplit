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
import type { MoneyContextRef, RouteMoneyContext } from '../lib/moneyContext'
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
  followPageContext?: boolean
  directDeepLink?: boolean
  onSave?: (
    draft: LedgerExpenseDraft,
    startedAtMs: number,
  ) => Promise<SaveResult>
  onSaved?: () => void | Promise<void>
}>

type SessionCallbacks = Pick<OpenRequest, 'onSave' | 'onSaved'>

type UniversalQuickAddContextValue = Readonly<{
  pageTarget: { pathname: string; target: RouteMoneyContext; ready: boolean } | null
  setPageTarget: (target: { pathname: string; target: RouteMoneyContext; ready: boolean } | null) => void
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
  setContextPickerOpen: (open: boolean) => void
  commitInlineContext: (ref: MoneyContextRef, selectedIds?: string[], draftChoice?: 'resume' | 'move') => Promise<{ ok: boolean; session?: UniversalQuickAddSession; error?: 'unavailable' | 'network' | 'draft-conflict' | 'cancelled' }>
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
  const [pageTarget, setPageTarget] = useState<UniversalQuickAddContextValue['pageTarget']>(null)
  const [session, setSessionState] = useState<UniversalQuickAddSession | null>(null)
  const sessionRef = useRef<UniversalQuickAddSession | null>(null)
  const callbacksRef = useRef<SessionCallbacks>({})
  const [feedback, setFeedback] = useState<SaveFeedbackState | null>(null)
  const [resolving, setResolving] = useState(false)
  const [contextError, setContextError] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState<MoneyContextRef | null>(null)
  const resolutionGenerationRef = useRef(0)
  const contextPickerOpenRef = useRef(false)

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
      const entryValues = ref.kind === 'person' && resolved.ref.kind === 'person'
        ? remapQuickAddParticipant(active.values, ref.participantId, resolved.ref.participantId)
        : active.values
      if (entryValues.selectedParticipantIds.some(id => !resolved.availableParticipants.some(p => p.id === id))) {
        setContextError(true)
        history.replace({ step: 'gate', startedAtMs: active.startedAtMs })
        return
      }
      const next = {
        ...active,
        clientRequestId: active.originalContext && !sameContext(active.originalContext, resolved.ref) ? generateId() : active.clientRequestId,
        context: resolved,
        originalContext: active.originalContext ?? resolved.ref,
        values: active.context
          ? entryValues
          : {
              ...entryValues,
              currency: entryValues.selectedParticipantIds.length ? entryValues.currency : resolved.defaultCurrency,
              selectedParticipantIds: entryValues.selectedParticipantIds.length
                ? [...new Set([resolved.currentParticipantId, ...entryValues.selectedParticipantIds.filter(id => resolved.availableParticipants.some(p => p.id === id))])]
                : resolved.ref.kind === 'person'
                  ? [resolved.currentParticipantId, resolved.ref.participantId]
                  : active.followPageContext ? [resolved.currentParticipantId] : resolved.availableParticipants.map((participant) => participant.id),
            },
      }
      installSession(next)
      history.replace({
        step: 'capture',
        context: resolved.ref,
        startedAtMs: active.startedAtMs,
        directDeepLink,
      })
    } catch {
      if (generation !== resolutionGenerationRef.current || sessionRef.current?.sessionId !== active.sessionId) return
      setContextError(true)
      history.replace({ step: 'gate', excludedSpaceId: ref.kind === 'space' ? ref.spaceId : undefined, startedAtMs: active.startedAtMs })
    } finally {
      if (generation === resolutionGenerationRef.current) {
        setResolving(false)
      }
    }
  }, [history, installSession, resolveRef])

  const open = useCallback((request: OpenRequest) => {
    resolutionGenerationRef.current += 1
    contextPickerOpenRef.current = false
    setResolving(false)
    const startedAtMs = Date.now()
    const requestedContext = request.context && isResolvedMoneyContext(request.context) ? request.context.ref : request.context
    const target = request.spaceCandidateId ? { kind: 'space' as const, spaceId: request.spaceCandidateId }
      : request.personCandidateId ? { kind: 'person' as const, personId: request.personCandidateId }
      : requestedContext ?? { kind: 'personal' as const }
    const restore = !request.initialValues && !request.onSave && !request.onSaved && (!request.captureSource || request.captureSource === 'manual') && request.contextPolicy !== 'locked'
      && (request.entryPoint === 'global' || request.entryPoint === 'personal') ? readQuickDraft(identityKey, target) : null
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
      followPageContext: request.followPageContext,
      context: resolved,
      originalContext: resolved?.ref ?? unresolved,
      initialValues: request.initialValues ?? restore?.values ?? (request.followPageContext && resolved?.ref.kind === 'space' ? { selectedParticipantIds: [resolved.currentParticipantId] } : undefined),
    })
    callbacksRef.current = {
      onSave: request.onSave,
      onSaved: request.onSaved,
    }
    setFeedback(null)
    setContextError(false)
    setPendingSwitch(null)
    installSession(next)

    if (request.directDeepLink && (resolved || unresolved)) {
      const directUrl = `${location.pathname}${location.search}${location.hash}`
      navigate('/', { replace: true })
      navigate(directUrl, {
        state: {
          moneyAction: resolved ? {
            step: 'capture',
            context: resolved.ref,
            startedAtMs,
            directDeepLink: true,
          } : {
            step: 'resolve-context',
            context: unresolved!,
            mode: 'entry',
            startedAtMs,
          } satisfies MoneyActionState,
        },
      })
      // Restored drafts contain a ref which must be revalidated. Keep the
      // shortcut's safe Daily history entry and close behavior during that path.
      if (unresolved) void resolveEntryContext(unresolved, true)
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
            setContextError(true)
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
          setContextError(true)
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
            setContextError(true)
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
          setContextError(true)
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
    const active = sessionRef.current
    // An explicit gate choice starts a reviewed split, preserving the amount
    // and note while discarding an unavailable draft's financial allocation.
    if (active && !active.context) installSession({ ...active, values: {
      ...active.values, selectedParticipantIds: [], splitMode: 'equal', exactShareAmounts: {}, payerAmounts: {}, items: [],
    } })
    void resolveEntryContext(context)
  }, [installSession, resolveEntryContext])

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
      const switched = { ...switchUniversalQuickAddContext(active, resolved), clientRequestId: generateId() }
      const next = active.followPageContext && resolved.ref.kind === 'space' ? { ...switched, values: { ...switched.values, selectedParticipantIds: [resolved.currentParticipantId] } } : switched
      installSession(next)
      setPendingSwitch(null)
      history.collapseSwitchToCapture({
        step: 'capture',
        context: resolved.ref,
        startedAtMs: active.startedAtMs,
      })
    } catch {
      if (generation !== resolutionGenerationRef.current || sessionRef.current?.sessionId !== active.sessionId) return
      setContextError(true)
      history.replace({ step: 'switch-picker', startedAtMs: active.startedAtMs })
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
    installSession({ ...next, clientRequestId: active.context && !sameContext(active.context.ref, resolved.ref) ? generateId() : active.clientRequestId, values: { ...next.values,
      currency: active.values.currency,
      category: active.values.category,
      categorySource: active.values.categorySource,
      selectedParticipantIds: selectedIds
        ? [...new Set([resolved.currentParticipantId, ...selectedIds.filter(id => resolved.availableParticipants.some(p => p.id === id))])]
        : next.values.selectedParticipantIds,
    } })
    return true
  }, [installSession, resolveRef])

  // A synchronous provider guard also covers callers outside the visible buttons.
  const setContextPickerOpen = useCallback((open: boolean) => {
    contextPickerOpenRef.current = open
    if (!open) resolutionGenerationRef.current += 1
  }, [])

  const commitInlineContext = useCallback(async (
    ref: MoneyContextRef, selectedIds?: string[], draftChoice?: 'resume' | 'move',
  ): Promise<{ ok: boolean; session?: UniversalQuickAddSession; error?: 'unavailable' | 'network' | 'draft-conflict' | 'cancelled' }> => {
    const active = sessionRef.current
    if (!active?.context || active.contextPolicy === 'locked') return { ok: false, error: 'unavailable' }
    const generation = ++resolutionGenerationRef.current
    try {
      const resolved = await resolveRef(ref)
      const latest = sessionRef.current
      if (generation !== resolutionGenerationRef.current || latest?.sessionId !== active.sessionId) return { ok: false, error: 'cancelled' }
      if (!resolved) return { ok: false, error: 'unavailable' }
      const same = sameContext(active.context.ref, resolved.ref)
      const stored = !same ? readQuickDraft(identityKey, resolved.ref) : null
      const nonempty = stored && (stored.values.amount || stored.values.calculation || stored.values.description || stored.values.selectedParticipantIds.some(id => id !== resolved.currentParticipantId))
      if (nonempty && stored.clientRequestId !== active.clientRequestId && !draftChoice) return { ok: false, error: 'draft-conflict' }
      let values = latest.values
      if (same && active.context.ref.kind === 'person' && resolved.ref.kind === 'person') values = remapQuickAddParticipant(values, active.context.ref.participantId, resolved.ref.participantId)
      if (draftChoice === 'resume' && stored) {
        values = stored.values
        if (stored.context?.ref.kind === 'person' && resolved.ref.kind === 'person') values = remapQuickAddParticipant(values, stored.context.ref.participantId, resolved.ref.participantId)
        if (values.selectedParticipantIds.some(id => !resolved.availableParticipants.some(p => p.id === id))) return { ok: false, error: 'unavailable' }
      } else {
        let ids = selectedIds ?? (same ? values.selectedParticipantIds : [resolved.currentParticipantId])
        if (ref.kind === 'person' && resolved.ref.kind === 'person') ids = ids.map(id => id === ref.participantId ? resolved.ref.kind === 'person' ? resolved.ref.participantId : id : id)
        ids = [...new Set([resolved.currentParticipantId, ...ids])]
        if (ids.some(id => !resolved.availableParticipants.some(p => p.id === id))) return { ok: false, error: 'unavailable' }
        const keepAllocation = same && ids.length === values.selectedParticipantIds.length && ids.every(id => values.selectedParticipantIds.includes(id))
        values = { ...values, selectedParticipantIds: ids, ...(keepAllocation ? {} : { splitMode: 'equal' as const, exactShareAmounts: {}, payerAmounts: {}, items: [], detailsExpanded: false }) }
      }
      const next = { ...latest, context: resolved, clientRequestId: draftChoice === 'resume' && stored ? stored.clientRequestId : same ? latest.clientRequestId : generateId(), values }
      installSession(next)
      history.replace({ step: 'capture', context: resolved.ref, startedAtMs: next.startedAtMs })
      return { ok: true, session: next }
    } catch {
      if (generation !== resolutionGenerationRef.current || sessionRef.current?.sessionId !== active.sessionId) return { ok: false, error: 'cancelled' }
      return { ok: false, error: 'network' }
    }
  }, [history, identityKey, installSession, resolveRef])

  const submittingRef = useRef(false)
  const submit = useCallback(async (options?: { continueAdding?: boolean; beforeClose?: () => Promise<void>; values?: Partial<UniversalQuickAddValues> }): Promise<SaveResult> => {
    if (contextPickerOpenRef.current) return { ok: false, error: 'selection_in_progress' }
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
    writeQuickDraft(identityKey, null, context.ref)
    if (options?.continueAdding && active.captureSource === 'manual' ) {
      const personal = context.availableParticipants.find(p => p.id === context.currentParticipantId)!
      const nextContext: ResolvedMoneyContext = active.contextPolicy === 'locked' || active.followPageContext ? context : {
        ref: { kind: 'personal' }, currentParticipantId: personal.id,
        availableParticipants: [personal], defaultCurrency: values.currency,
      }
      const next = createUniversalQuickAddSession({
        identityKey, sessionId: generateId(), clientRequestId: generateId(), startedAtMs: Date.now(),
        entryPoint: active.entryPoint, contextPolicy: active.contextPolicy, context: nextContext, followPageContext: active.followPageContext,
        initialValues: { category: values.category, categorySource: values.categorySource,
          occurredOn: values.occurredOn, currency: values.currency, accountId: values.accountId,
          ...(active.followPageContext && nextContext.ref.kind === 'space' ? { selectedParticipantIds: [nextContext.currentParticipantId] } : {}) },
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
    contextPickerOpenRef.current = false
    setResolving(false)
    history.close()
    installSession(null)
    callbacksRef.current = {}
    setPendingSwitch(null)
  }, [history, installSession])

  const cancelPicker = useCallback(() => {
    resolutionGenerationRef.current += 1
    contextPickerOpenRef.current = false
    setResolving(false)
    setPendingSwitch(null)
    setContextError(false)
    history.close()
  }, [history])

  const value: UniversalQuickAddContextValue = {
    pageTarget,
    setPageTarget,
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
    setContextPickerOpen,
    commitInlineContext,
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
