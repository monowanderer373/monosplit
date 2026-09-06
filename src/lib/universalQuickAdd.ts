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
  originalContext?: MoneyContextRef | null
  initialValues?: Partial<UniversalQuickAddValues>
}>

export type SaveFeedbackState =
  | Readonly<{ kind: 'recorded' }>
  | Readonly<{ kind: 'awaiting-confirmation' }>
  | Readonly<{ kind: 'pending-sync' }>
  | Readonly<{ kind: 'needs-attention' }>

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function defaultSelectedParticipantIds(
  context: ResolvedMoneyContext,
): string[] {
  const allIds = context.availableParticipants.map((participant) => participant.id)
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
    !sameSet(session.values.selectedParticipantIds, defaults) ||
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
    values: {
      ...session.values,
      currency: nextContext.defaultCurrency,
      category: preserveUserCategory ? session.values.category : '',
      categorySource: preserveUserCategory ? 'USER' : 'DEFAULT',
      selectedParticipantIds: defaultSelectedParticipantIds(nextContext),
      splitMode: 'equal',
      exactShareAmounts: {},
      payerAmounts: {},
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
