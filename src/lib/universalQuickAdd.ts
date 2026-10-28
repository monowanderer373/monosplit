import type { FundingPlan } from './multicurrency'
import type { LedgerDraftParticipant } from './compileExpense'
import type { MoneyContextRef } from './moneyContext'
import type { TranslationKey } from './i18n'

export type ContextSwitchPolicy = 'switchable' | 'locked'

export type QuickAddEntryPoint =
  | 'global'
  | 'personal'
  | 'person'
  | 'space'
  | 'smart-capture'
  | 'recent-preset'
  | 'recurring-draft'

export type ResolvedMoneyContext = Readonly<{
  ref: MoneyContextRef
  currentParticipantId: string
  availableParticipants: LedgerDraftParticipant[]
  defaultCurrency: string
}>

export type CategorySource = 'DEFAULT' | 'SUGGESTED' | 'USER'

export type UniversalQuickAddValues = Readonly<{
  amount: string
  description: string
  occurredOn: string
  currency: string
  category: string
  categorySource: CategorySource
  selectedParticipantIds: string[]
  splitMode: 'equal' | 'exact'
  exactShareAmounts: Record<string, string>
  payerAmounts: Record<string, string>
  detailsExpanded: boolean
  accountId?: string | null
  fundingPlan?: FundingPlan
  calculation?: string
  items?: { id: string; name: string; amount: string; participantIds: string[] }[]
}>

export type UniversalQuickAddSession = Readonly<{
  sessionId: string
  clientRequestId: string
  identityKey: string
  startedAtMs: number
  entryPoint: QuickAddEntryPoint
  captureSource: 'manual' | 'template' | 'recurring' | 'natural_language' | 'voice' | 'ocr'
  contextPolicy: ContextSwitchPolicy
  context: ResolvedMoneyContext | null
  followPageContext?: boolean
  selectionInitialized?: boolean
  participantOrder?: string[]
  originalContext: MoneyContextRef | null
  values: UniversalQuickAddValues
}>

export type CreateQuickAddSessionInput = Readonly<{
  identityKey: string
  sessionId: string
  clientRequestId: string
  startedAtMs: number
  entryPoint: QuickAddEntryPoint
  captureSource?: UniversalQuickAddSession['captureSource']
  contextPolicy?: ContextSwitchPolicy
  context?: ResolvedMoneyContext | null
  followPageContext?: boolean
  originalContext?: MoneyContextRef | null
  initialValues?: Partial<UniversalQuickAddValues>
  participantOrder?: string[]
}>

export type SaveFeedbackState =
  | Readonly<{ kind: 'recorded' }>
  | Readonly<{ kind: 'awaiting-confirmation' }>
  | Readonly<{ kind: 'pending-sync' }>
  | Readonly<{ kind: 'needs-attention' }>

export function todayIso(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Preserve the reviewed Trip order while names/permissions come from the fresh authorized snapshot. */
export function orderTripContext(context:ResolvedMoneyContext, order:readonly string[]=[]):ResolvedMoneyContext {
  if(context.ref.kind!=='space'||context.ref.spaceType!=='trip'||!order.length)return context
  const rows=new Map(context.availableParticipants.map(p=>[p.id,p]))
  const ids=[...new Set([...order,...context.availableParticipants.map(p=>p.id)])]
  return {...context,availableParticipants:ids.flatMap(id=>rows.has(id)?[rows.get(id)!]:[])}
}

export function defaultSelectedParticipantIds(
  context: ResolvedMoneyContext,
): string[] {
  const allIds = context.availableParticipants.map((participant) => participant.id)
  if (context.ref.kind === 'space' && context.ref.spaceType === 'trip') return [context.currentParticipantId]
  if (context.ref.kind !== 'person') return allIds

  const personId = context.ref.participantId
  return [context.currentParticipantId, personId]
    .filter((id, index, ids) => Boolean(id) && ids.indexOf(id) === index)
}

function createDefaultValues(
  context: ResolvedMoneyContext | null,
): UniversalQuickAddValues {
  return {
    amount: '',
    description: '',
    occurredOn: todayIso(),
    currency: context?.defaultCurrency ?? 'MYR',
    category: '',
    categorySource: 'DEFAULT',
    selectedParticipantIds: context
      ? defaultSelectedParticipantIds(context)
      : [],
    splitMode: 'equal',
    exactShareAmounts: {},
    payerAmounts: {},
    detailsExpanded: false,
  }
}

export function createUniversalQuickAddSession(
  input: CreateQuickAddSessionInput,
): UniversalQuickAddSession {
  const context = input.context ?? null
  return {
    sessionId: input.sessionId,
    clientRequestId: input.clientRequestId,
    identityKey: input.identityKey,
    startedAtMs: input.startedAtMs,
    entryPoint: input.entryPoint,
    captureSource: input.captureSource ?? 'manual',
    contextPolicy: input.contextPolicy ?? 'switchable',
    context,
    followPageContext: input.followPageContext,
    selectionInitialized: !!context || input.initialValues?.selectedParticipantIds !== undefined,
    participantOrder: input.participantOrder ?? (context?.ref.kind === 'space' && context.ref.spaceType === 'trip' ? context.availableParticipants.map(p=>p.id) : undefined),
    originalContext: input.originalContext ?? context?.ref ?? null,
    values: {
      ...createDefaultValues(context),
      ...input.initialValues,
    },
  }
}

export function updateUniversalQuickAddValues(
  session: UniversalQuickAddSession,
  patch: Partial<UniversalQuickAddValues>,
): UniversalQuickAddSession {
  return {
    ...session,
    values: {
      ...session.values,
      ...patch,
    },
  }
}

export function applySuggestedCategory(
  values: UniversalQuickAddValues,
  category: string,
): UniversalQuickAddValues {
  if (!category || values.categorySource === 'USER') return values
  return {
    ...values,
    category,
    categorySource: 'SUGGESTED',
  }
}

export function remapQuickAddParticipant(
  values: UniversalQuickAddValues,
  previousParticipantId: string,
  nextParticipantId: string,
): UniversalQuickAddValues {
  if (
    !previousParticipantId
    || !nextParticipantId
    || previousParticipantId === nextParticipantId
  ) return values

  const remapRecord = (record: Record<string, string>) => {
    const next = { ...record }
    if (previousParticipantId in next) {
      next[nextParticipantId] = next[previousParticipantId]
      delete next[previousParticipantId]
    }
    return next
  }
  return {
    ...values,
    selectedParticipantIds: values.selectedParticipantIds.map((id) =>
      id === previousParticipantId ? nextParticipantId : id,
    ).filter((id, index, ids) => ids.indexOf(id) === index),
    payerAmounts: remapRecord(values.payerAmounts),
    exactShareAmounts: remapRecord(values.exactShareAmounts),
  }
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}

export function hasCustomContextConfiguration(
  session: UniversalQuickAddSession,
): boolean {
  if (!session.context) return false
  const defaults = defaultSelectedParticipantIds(session.context)
  return (
    (!sameSet(session.values.selectedParticipantIds, defaults) && !(session.followPageContext && sameSet(session.values.selectedParticipantIds, [session.context.currentParticipantId]))) ||
    session.values.splitMode === 'exact' ||
    Object.values(session.values.exactShareAmounts).some(
      (amount) => amount.trim() !== '',
    ) ||
    Object.values(session.values.payerAmounts).some(
      (amount) => amount.trim() !== '',
    )
  )
}

export function switchUniversalQuickAddContext(
  session: UniversalQuickAddSession,
  nextContext: ResolvedMoneyContext,
): UniversalQuickAddSession {
  if (session.contextPolicy === 'locked') return session
  const preserveUserCategory = session.values.categorySource === 'USER'

  return {
    ...session,
    context: nextContext,
    participantOrder: nextContext.ref.kind === 'space' && nextContext.ref.spaceType === 'trip' ? nextContext.availableParticipants.map(p=>p.id) : undefined,
    values: {
      ...session.values,
      currency: nextContext.defaultCurrency,
      category: preserveUserCategory ? session.values.category : '',
      categorySource: preserveUserCategory ? 'USER' : 'DEFAULT',
      selectedParticipantIds: defaultSelectedParticipantIds(nextContext),
      splitMode: 'equal',
      exactShareAmounts: {},
      payerAmounts: {},
      items: [],
      detailsExpanded: false,
    },
  }
}

export function sessionForIdentity(
  session: UniversalQuickAddSession | null,
  identityKey: string,
): UniversalQuickAddSession | null {
  return session?.identityKey === identityKey ? session : null
}

export function saveFeedbackLabel(
  feedback: SaveFeedbackState,
  translate: (key: TranslationKey) => string,
): string {
  if (feedback.kind === 'pending-sync') {
    return translate('quickAdd.feedback.pendingSync')
  }
  if (feedback.kind === 'needs-attention') {
    return translate('quickAdd.feedback.needsAttention')
  }
  if (feedback.kind === 'awaiting-confirmation') {
    return translate('quickAdd.feedback.awaitingConfirmation')
  }
  return translate('quickAdd.feedback.recorded')
}
