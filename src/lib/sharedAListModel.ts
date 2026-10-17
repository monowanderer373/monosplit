import type { CanonicalExpense, PersonRelationship } from '../types'
import type { CollectPayItem } from './collectPay'
import type { HomeNotification } from './homeNotifications'
import { formatMinorAmount } from './money'
import { noticeDestination } from './notificationPresentation'
import {
  personExpenses,
  trackedPersonDebtLines,
} from './personMoney'
import type { ConfirmedSettlement, RelationalDebtLine } from './relationalBalance'
import {
  candidateResolution,
  collectPayHref,
  collectionEntryLabel,
  compactMeta,
  exactCandidates,
  rowAmountView,
  uniqueActionableTasks,
  type AmountView,
  type Candidate,
  type Position,
} from './sharedAPresentation'

export type PersonListRow = {
  id: string
  name: string
  manual: boolean
  linkPending: boolean
  hasConfirmedHistory: boolean
  pendingCount: number
  lastShared?: string
  positions: readonly Position[]
  amount: AmountView
  meta: string
}

export function confirmedPositionsFromDebtLines(
  ownerId: string,
  linkedParticipantId: string | null,
  lines: readonly RelationalDebtLine[],
  locale?: string,
): Position[] {
  if (!linkedParticipantId) return []
  const byCurrency = new Map<string, Position>()
  for (const line of lines) {
    if (line.remainingMinor <= 0) continue
    const involvesOwner = line.debtorParticipantId === ownerId || line.creditorParticipantId === ownerId
    const involvesPerson = line.debtorParticipantId === linkedParticipantId || line.creditorParticipantId === linkedParticipantId
    if (!involvesOwner || !involvesPerson) continue
    const direction = line.debtorParticipantId === ownerId ? 'pay' : 'collect'
    byCurrency.set(line.currency, {
      currency: line.currency,
      nonzero: true,
      display: formatMinorAmount(line.remainingMinor, line.currency, locale),
      direction,
    })
  }
  return [...byCurrency.values()].sort((left, right) => left.currency.localeCompare(right.currency))
}

export function personHasConfirmedHistory(
  expenses: readonly CanonicalExpense[],
  ownerId: string,
  person: PersonRelationship,
  settlements: readonly ConfirmedSettlement[],
): boolean {
  if (personExpenses(expenses, ownerId, person).length > 0) return true
  if (!person.linkedParticipantId) return false
  return settlements.some((settlement) =>
    settlement.scope === 'direct'
    && (settlement.debtorParticipantId === ownerId || settlement.debtorParticipantId === person.linkedParticipantId)
    && settlement.allocations.some((allocation) =>
      allocation.creditorParticipantId === ownerId || allocation.creditorParticipantId === person.linkedParticipantId,
    ),
  )
}

export function lastSharedDate(
  expenses: readonly CanonicalExpense[],
  ownerId: string,
  person: PersonRelationship,
): string | undefined {
  return personExpenses(expenses, ownerId, person)[0]?.occurredOn
}

export function sharedReviewTasks(notices: readonly HomeNotification[]) {
  return uniqueActionableTasks(
    notices
      .filter((notice) => notice.source === 'shared-ledger' && notice.tab === 'tasks' && notice.state === 'pending')
      .map((notice) => ({
        kind: notice.ref.kind,
        id: notice.ref.id,
        actionable: true,
        state: 'pending',
        version: Number(notice.version) || 0,
        notice,
      })),
  )
}

export function pendingCountForPerson(
  person: PersonRelationship,
  ownerId: string,
  expenses: readonly CanonicalExpense[],
  notices: readonly HomeNotification[],
  settlements: readonly ConfirmedSettlement[] = [],
): number {
  const principalIds = new Set([
    ...person.manualParticipantIds,
    ...(person.linkedParticipantId ? [person.linkedParticipantId] : []),
  ])
  const ids = new Set<string>()
  for (const expense of expenses) {
    if (
      expense.scope === 'direct'
      && expense.status === 'active'
      && expense.participations.some((participation) => participation.participantId === ownerId && participation.state === 'pending')
      && expense.participations.some((participation) => principalIds.has(participation.participantId))
    ) ids.add(`expense:${expense.id}`)
  }
  for (const task of sharedReviewTasks(notices)) {
    if (task.kind === 'expense') {
      if (expenses.some((item) =>
        item.id === task.id
        && item.participations.some((participation) => principalIds.has(participation.participantId)),
      )) ids.add(`expense:${task.id}`)
      continue
    }
    if (task.kind === 'payment') {
      const payment = settlements.find((item) => item.id === task.id)
      if (payment && (
        principalIds.has(payment.debtorParticipantId)
        || payment.allocations.some((allocation) => principalIds.has(allocation.creditorParticipantId))
      )) ids.add(`payment:${task.id}`)
    }
  }
  return ids.size
}

export function buildPersonListRow(input: {
  person: PersonRelationship
  ownerId: string
  expenses: readonly CanonicalExpense[]
  settlements: readonly ConfirmedSettlement[]
  notices: readonly HomeNotification[]
  selectedCurrency: string
  hidden: boolean
  locale?: string
}): PersonListRow {
  const manual = !input.person.linkedParticipantId
  const positions = confirmedPositionsFromDebtLines(
    input.ownerId,
    input.person.linkedParticipantId,
    trackedPersonDebtLines(input.expenses, input.settlements, input.ownerId, input.person),
    input.locale,
  )
  const pendingCount = pendingCountForPerson(
    input.person,
    input.ownerId,
    input.expenses,
    input.notices,
    input.settlements,
  )
  const hasConfirmedHistory = personHasConfirmedHistory(
    input.expenses,
    input.ownerId,
    input.person,
    input.settlements,
  )
  const lastShared = lastSharedDate(input.expenses, input.ownerId, input.person)
  return {
    id: input.person.id,
    name: input.person.displayName,
    manual,
    linkPending: input.person.state === 'link-pending',
    hasConfirmedHistory,
    pendingCount,
    lastShared,
    positions,
    amount: rowAmountView({
      hidden: input.hidden,
      selectedCurrency: input.selectedCurrency,
      positions,
      hasConfirmedHistory,
      manual,
      pendingCount,
    }),
    meta: compactMeta({
      hidden: input.hidden,
      pendingCount,
      manual,
      linkPending: input.person.state === 'link-pending',
      lastShared,
      settled: hasConfirmedHistory && !positions.some((position) => position.nonzero),
    }),
  }
}

export function displayCurrencies(
  rows: readonly { positions: readonly Position[] }[],
  profileCurrency: string,
): string[] {
  const currencies = new Set<string>([profileCurrency.toUpperCase()])
  for (const row of rows) for (const position of row.positions) currencies.add(position.currency.toUpperCase())
  return [...currencies].sort((left, right) => left.localeCompare(right))
}

export function toCollectPayCandidates(owner: string, items: readonly CollectPayItem[]): Candidate[] {
  return items.map((item) => ({
    owner,
    personId: item.personId ?? '',
    currency: item.currency,
    direction: item.direction,
    context: { scope: item.context.scope },
    key: item.key,
  }))
}

export function pendingReceiptCount(owner: string, item: CollectPayItem): number {
  return item.payments.filter((payment) =>
    payment.allocations.some((allocation) =>
      allocation.creditorParticipantId === owner && allocation.state === 'pending',
    ),
  ).length
}

export function resolvePersonCollectPay(input: {
  owner: string
  personId: string
  currency: string
  direction: 'collect' | 'pay'
  items: readonly CollectPayItem[]
}): { resolution: 'unavailable' | 'open' | 'choose'; href?: string; candidates: CollectPayItem[] } {
  const mapped = toCollectPayCandidates(input.owner, input.items)
  const matches = exactCandidates(mapped, input)
  const candidates = matches
    .map((candidate) => input.items.find((item) => item.key === candidate.key))
    .filter((item): item is CollectPayItem => Boolean(item))
  const resolution = candidateResolution(candidates)
  if (resolution === 'open') return { resolution, href: collectPayHref(candidates[0]), candidates }
  return { resolution, candidates }
}

export function collectionActionCopy(owner: string, item: CollectPayItem | undefined): 'Confirm receipt' | 'Request payment' {
  return collectionEntryLabel(item ? pendingReceiptCount(owner, item) : 0)
}

export function reviewHref(kind: string, id: string): string {
  if (kind === 'manual-link') return '/shared?view=review'
  return noticeDestination({ kind: kind as never, id })
}
