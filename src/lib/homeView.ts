import type { CanonicalExpense } from '../types'
import type { PersonalLedgerRow } from './ledgerSummary'
import {
  deriveRelationalDebtLines,
  type ConfirmedSettlement,
} from './relationalBalance'

export const HOME_RECENT_LIMIT = 10

export function addMinor(left: number, right: number): number {
  const sum = left + right
  if (!Number.isSafeInteger(sum)) throw new Error('amount_overflow')
  return sum
}

export type HomeAccountType =
  | 'cash'
  | 'bank'
  | 'ewallet'
  | 'credit_card'
  | 'paylater'
  | 'loan'

export type HomeAccount = {
  id: string
  name: string
  accountClass: 'asset' | 'liability'
  accountType: HomeAccountType
  currency: string
  archived: boolean
  openingStatus: 'unknown' | 'posted'
  /** Sum of posted journal entries. Unknown opening must not be treated as zero. */
  entrySumMinor: number
  /** Ignored by available-money math. Future instalments are not posted cash. */
  unpostedInstallmentMinor?: number
  /** Ignored by available-money math. A credit limit is not spendable cash. */
  creditLimitMinor?: number
}

export type CurrencyAmount = {
  currency: string
  amountMinor: number
}

export type AvailableMoneyTotal = {
  currency: string
  /**
   * Null when the selected account has an unknown opening.
   * For all-accounts, this is the known subtotal only.
   */
  amountMinor: number | null
  knownOnly: boolean
  unknownOpeningCount: number
}

export type AccountAttentionKind =
  | 'pending_funding'
  | 'recurring_attention'
  | 'failed_installment'
  | 'pending_principal'
  | 'insufficient_balance'
  | 'informational'

export type AccountAttentionSource = {
  id: string
  kind: AccountAttentionKind
  actionable: boolean
  accountName?: string
}

export type SummaryTileLayout = 'hidden' | 'account' | 'shared' | 'both'

export type SharedContextSource = 'friend' | 'group' | 'trip'

export type SharedBalanceDirection = 'receivable' | 'payable'

export type SharedContext = {
  id: string
  source: SharedContextSource
  label: string
  personId: string | null
  spaceId: string | null
  lines: Array<{
    currency: string
    direction: SharedBalanceDirection
    amountMinor: number
  }>
}

export type HomePerson = {
  id: string
  displayName: string
  participantIds: readonly string[]
}

export type HomeSpaceRef = {
  id: string
  type: 'group' | 'trip'
  name: string
  status: 'active' | 'archived' | 'voided'
  startDate: string | null
  endDate: string | null
  updatedAt: string
}

export type HomeFunding = {
  expenseId: string
  status: 'pending' | 'posted' | 'reversed'
  accountId: string | null
  accountAmountMinor: number | null
  accountCurrency: string | null
}

export type HomeJournalKind =
  | 'income'
  | 'refund'
  | 'settlement_in'
  | 'settlement_out'
  | 'gift_in'
  | 'gift_out'
  | 'transfer'
  | 'liability_repayment'
  | 'reversal'
  | 'reconciliation'
  | 'expense_funding'
  | 'opening'
  | 'other'

export type HomeJournalEntry = {
  id: string
  kind: HomeJournalKind
  occurredOn: string
  createdAt: string
  amountMinor: number
  currency: string
  accountId: string
  accountName: string
  expenseId: string | null
  memo: string | null
}

export type HomeAffiliation = {
  expenseId: string
  label: string
  archived: boolean
}

export type HomeContextChip =
  | { kind: 'personal' }
  | { kind: 'personal-trip'; tripLabel: string }
  | { kind: 'direct'; personName: string | null }
  | { kind: 'space'; spaceName: string }

export type HomeRecord = {
  id: string
  expenseId: string | null
  spaceId: string | null
  occurredOn: string
  createdAt: string
  description: string
  category: string
  chip: HomeContextChip
  direction: 'in' | 'out'
  amountMinor: number
  currency: string
  accountId: string | null
  walletName: string | null
  fundingPending: boolean
  amountKnown: boolean
  affectsPersonalSpending: boolean
}

export type HomeRecordPresentation = HomeRecord & {
  showIcon: boolean
  showChip: boolean
  compact: boolean
}

export type DateGroupKind = 'today' | 'yesterday' | 'date'

export type HomeDateGroup = {
  date: string
  kind: DateGroupKind
  records: HomeRecordPresentation[]
}

export type HomeTripSelection = {
  trip: HomeSpaceRef
  phase: 'active' | 'ended'
}

const ASSET_TYPES = new Set<HomeAccountType>(['cash', 'bank', 'ewallet'])
const JOURNAL_ACTIVITY = new Set<HomeJournalKind>([
  'income',
  'refund',
  'settlement_in',
  'settlement_out',
  'gift_in',
  'gift_out',
  'transfer',
  'liability_repayment',
  'reversal',
  'reconciliation',
])

export function isAvailableMoneyAccount(account: HomeAccount): boolean {
  return !account.archived
    && account.accountClass === 'asset'
    && ASSET_TYPES.has(account.accountType)
}

export function availableMoney(
  accounts: readonly HomeAccount[],
  selectedAccountId: 'all' | string,
): AvailableMoneyTotal[] {
  const assets = accounts.filter(isAvailableMoneyAccount)
  const selected = selectedAccountId === 'all'
    ? assets
    : assets.filter((account) => account.id === selectedAccountId)
  const byCurrency = new Map<string, { knownMinor: number; unknownCount: number; singleUnknown: boolean }>()

  for (const account of selected) {
    const currency = account.currency.toUpperCase()
    const bucket = byCurrency.get(currency) ?? {
      knownMinor: 0,
      unknownCount: 0,
      singleUnknown: false,
    }
    if (account.openingStatus !== 'posted') {
      bucket.unknownCount += 1
      bucket.singleUnknown = selected.length === 1
    } else {
      bucket.knownMinor = addMinor(bucket.knownMinor, account.entrySumMinor)
    }
    byCurrency.set(currency, bucket)
  }

  return [...byCurrency.entries()]
    .map(([currency, bucket]) => ({
      currency,
      amountMinor: bucket.singleUnknown ? null : bucket.knownMinor,
      knownOnly: bucket.unknownCount > 0 && !bucket.singleUnknown,
      unknownOpeningCount: bucket.unknownCount,
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

export function balanceDisclosure(hidden: boolean, totals: readonly AvailableMoneyTotal[]) {
  return {
    hidden,
    totals: totals.map((total) => ({
      currency: total.currency,
      amountMinor: hidden ? null : total.amountMinor,
      knownOnly: total.knownOnly,
      unknownOpeningCount: total.unknownOpeningCount,
    })),
  }
}

export function accountAttentionSources(input: {
  pendingFundingIds: readonly string[]
  recurring: readonly { id: string; status: string }[]
  installments: readonly { id: string; status: string }[]
  pendingPrincipalPlanIds: readonly string[]
}): AccountAttentionSource[] {
  const sources: AccountAttentionSource[] = []
  for (const id of input.pendingFundingIds) {
    sources.push({ id: `funding:${id}`, kind: 'pending_funding', actionable: true })
  }
  for (const occurrence of input.recurring) {
    const actionable = occurrence.status === 'failed' || occurrence.status === 'pending_review'
    sources.push({
      id: `recurring:${occurrence.id}`,
      kind: actionable ? 'recurring_attention' : 'informational',
      actionable,
    })
  }
  for (const installment of input.installments) {
    const actionable = installment.status === 'failed'
    sources.push({
      id: `installment:${installment.id}`,
      kind: actionable ? 'failed_installment' : 'informational',
      actionable,
    })
  }
  for (const id of input.pendingPrincipalPlanIds) {
    sources.push({ id: `principal:${id}`, kind: 'pending_principal', actionable: true })
  }
  return sources
}

export function countActionableAccountTasks(
  sources: readonly AccountAttentionSource[],
  accounts: readonly HomeAccount[],
): number {
  return listActionableAccountTasks(sources, accounts).length
}

export function listActionableAccountTasks(
  sources: readonly AccountAttentionSource[],
  accounts: readonly HomeAccount[],
): AccountAttentionSource[] {
  const tasks = sources.filter((source) => source.actionable)
  for (const account of accounts) {
    if (
      isAvailableMoneyAccount(account)
      && account.openingStatus === 'posted'
      && account.entrySumMinor < 0
    ) {
      tasks.push({
        id: `insufficient:${account.id}`,
        kind: 'insufficient_balance',
        actionable: true,
        accountName: account.name,
      })
    }
  }
  return tasks
}

export function summaryTileLayout(
  accountTaskCount: number,
  sharedCount: number,
): SummaryTileLayout {
  if (accountTaskCount > 0 && sharedCount > 0) return 'both'
  if (accountTaskCount > 0) return 'account'
  if (sharedCount > 0) return 'shared'
  return 'hidden'
}

export function deriveOutstandingSharedContexts(input: {
  ownerParticipantId: string
  expenses: readonly CanonicalExpense[]
  settlements: readonly ConfirmedSettlement[]
  people: readonly HomePerson[]
  spaces: readonly HomeSpaceRef[]
}): SharedContext[] {
  const contexts: SharedContext[] = []
  const claimedParticipants = new Set<string>()

  for (const person of input.people) {
    const lines = debtLinesForParticipants(
      input,
      person.participantIds.filter((id) => id !== input.ownerParticipantId),
    )
    for (const id of person.participantIds) claimedParticipants.add(id)
    if (lines.length > 0) {
      contexts.push({
        id: `friend:${person.id}`,
        source: 'friend',
        label: person.displayName,
        personId: person.id,
        spaceId: null,
        lines,
      })
    }
  }

  const otherParticipants = new Map<string, string>()
  for (const expense of input.expenses) {
    if (expense.scope !== 'direct' || expense.status !== 'active') continue
    for (const participation of expense.participations) {
      if (participation.participantId === input.ownerParticipantId) continue
      if (claimedParticipants.has(participation.participantId)) continue
      otherParticipants.set(participation.participantId, participation.nameSnapshot)
    }
  }
  for (const [participantId, label] of otherParticipants) {
    const lines = debtLinesForParticipants(input, [participantId])
    if (lines.length === 0) continue
    contexts.push({
      id: `friend:${participantId}`,
      source: 'friend',
      label,
      personId: null,
      spaceId: null,
      lines,
    })
  }

  for (const space of input.spaces) {
    if (space.status === 'voided' || (space.type !== 'group' && space.type !== 'trip')) continue
    const lines = linesFromDebt(
      input.ownerParticipantId,
      deriveRelationalDebtLines(input.expenses, input.settlements, {
        scope: 'space',
        spaceId: space.id,
      }),
    )
    if (lines.length === 0) continue
    contexts.push({
      id: `${space.type}:${space.id}`,
      source: space.type === 'trip' ? 'trip' : 'group',
      label: space.name,
      personId: null,
      spaceId: space.id,
      lines,
    })
  }

  return contexts.sort((left, right) =>
    left.source.localeCompare(right.source) || left.label.localeCompare(right.label),
  )
}

export function receivableTotals(contexts: readonly SharedContext[]): CurrencyAmount[] {
  return sumDirection(contexts, 'receivable')
}

export function monthlyPersonalSpending(
  rows: readonly PersonalLedgerRow[],
  monthKey: string,
): CurrencyAmount[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (!row.expense.occurredOn.startsWith(monthKey)) continue
    const currency = row.expense.currency.toUpperCase()
    totals.set(currency, addMinor(totals.get(currency) ?? 0, row.personalSpendingMinor))
  }
  return [...totals.entries()]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

export function localCalendarDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) return instant.toISOString().slice(0, 10)
  return `${year}-${month}-${day}`
}

export function shiftCalendarDate(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return dateKey
  const shifted = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]) + days,
  ))
  return shifted.toISOString().slice(0, 10)
}

export function tripsFromAffiliations(
  affiliations: readonly HomeAffiliation[],
  spaces: readonly HomeSpaceRef[],
): HomeSpaceRef[] {
  const namedTrips = new Set(
    spaces.filter((space) => space.type === 'trip').map((space) => space.name.trim()),
  )
  const labels = new Set(
    affiliations
      .filter((affiliation) => !affiliation.archived)
      .map((affiliation) => affiliation.label.trim())
      .filter((label) => label.length > 0 && !namedTrips.has(label)),
  )
  return [...labels].sort().map((label) => ({
    id: `affiliation:${label}`,
    type: 'trip',
    name: label,
    status: 'active',
    startDate: null,
    endDate: null,
    updatedAt: '1970-01-01T00:00:00.000Z',
  }))
}

export function selectHomeTrip(
  trips: readonly HomeSpaceRef[],
  today: string,
  preferredId?: string | null,
): HomeTripSelection | null {
  const visible = trips.filter((trip) => trip.type === 'trip' && trip.status !== 'voided')
  const preferred = preferredId
    ? visible.find((trip) => trip.id === preferredId)
    : undefined
  if (preferred) return { trip: preferred, phase: tripPhase(preferred, today) }

  const active = visible
    .filter((trip) => tripPhase(trip, today) === 'active')
    .sort((left, right) => tripRecency(right).localeCompare(tripRecency(left)))
  if (active[0]) return { trip: active[0], phase: 'active' }

  const ended = visible
    .filter((trip) => tripPhase(trip, today) === 'ended')
    .sort((left, right) => (right.endDate ?? right.updatedAt).localeCompare(left.endDate ?? left.updatedAt))
  if (ended[0]) return { trip: ended[0], phase: 'ended' }
  return null
}

export function travelReadableExpenseIds(input: {
  readableExpenseIds: readonly string[]
  affiliations: readonly HomeAffiliation[]
  trip: { id: string; name: string }
  expenses: readonly { id: string; spaceId: string | null }[]
}): string[] {
  const readable = new Set(input.readableExpenseIds)
  const tripName = input.trip.name.trim()
  const affiliated = new Set(
    input.affiliations
      .filter((affiliation) => !affiliation.archived && affiliation.label.trim() === tripName)
      .map((affiliation) => affiliation.expenseId),
  )
  return input.expenses
    .filter((expense) =>
      readable.has(expense.id)
      && (expense.spaceId === input.trip.id || affiliated.has(expense.id)),
    )
    .map((expense) => expense.id)
}

export function isBookedHomeExpense(expense: CanonicalExpense, ownerParticipantId: string): boolean {
  if (expense.status !== 'active') return false
  const mine = expense.participations.find((participation) =>
    participation.participantId === ownerParticipantId,
  )
  if (!mine) return false
  if (expense.scope === 'direct' && (mine.state === 'pending' || mine.state === 'declined')) {
    return false
  }
  return true
}

export function homeRecordAccountFilter(
  mode: 'daily' | 'travel',
  selectedAccountId: 'all' | string,
): 'all' | string {
  return mode === 'travel' ? 'all' : selectedAccountId
}

export function buildHomeRecords(input: {
  ownerParticipantId: string
  expenses: readonly CanonicalExpense[]
  funding: readonly HomeFunding[]
  accounts: readonly HomeAccount[]
  people: readonly HomePerson[]
  spaces: readonly HomeSpaceRef[]
  affiliations: readonly HomeAffiliation[]
  journals: readonly HomeJournalEntry[]
  selectedAccountId: 'all' | string
  limit: number | null
  fundingKnown: boolean
}): HomeRecord[] {
  const accounts = new Map(input.accounts.map((account) => [account.id, account]))
  const spaces = new Map(input.spaces.map((space) => [space.id, space]))
  const fundingByExpense = new Map<string, HomeFunding>()
  for (const funding of input.funding) {
    const current = fundingByExpense.get(funding.expenseId)
    if (!current || fundingRank(funding) > fundingRank(current)) {
      fundingByExpense.set(funding.expenseId, funding)
    }
  }
  const activeAffiliations = input.affiliations.filter((affiliation) => !affiliation.archived)

  const expenseRecords = input.expenses.flatMap((expense) => {
    if (!isBookedHomeExpense(expense, input.ownerParticipantId)) return []
    const mine = expense.participations.find((participation) =>
      participation.participantId === input.ownerParticipantId,
    )
    if (!mine) return []
    const paidMinor = expense.payerContributions
      .find((item) => item.expenseParticipationId === mine.id)?.amountMinor ?? 0
    const shareMinor = expense.shares.find((item) => item.expenseParticipationId === mine.id)?.amountMinor ?? 0
    const funding = fundingByExpense.get(expense.id)
    const cash = cashLeg(expense, paidMinor, funding, accounts)
    if (paidMinor === 0 && shareMinor === 0 && !cash.fundingPending) return []
    const record: HomeRecord = {
      id: `expense:${expense.id}`,
      expenseId: expense.id,
      spaceId: expense.spaceId,
      occurredOn: expense.occurredOn,
      createdAt: expense.createdAt,
      description: expense.description?.trim() || expense.category,
      category: expense.category,
      chip: contextChip(expense, input.ownerParticipantId, input.people, spaces, activeAffiliations),
      direction: 'out',
      amountMinor: input.fundingKnown ? cash.amountMinor : 0,
      currency: cash.currency,
      accountId: cash.accountId,
      walletName: input.fundingKnown ? cash.walletName : null,
      fundingPending: input.fundingKnown && cash.fundingPending,
      amountKnown: input.fundingKnown,
      affectsPersonalSpending: true,
    }
    return [record]
  })

  const journalRecords = input.journals.flatMap((entry) => {
    if (!JOURNAL_ACTIVITY.has(entry.kind) || entry.amountMinor === 0) return []
    if (
      entry.kind !== 'refund'
      && entry.expenseId
      && expenseRecords.some((record) => record.expenseId === entry.expenseId)
    ) {
      return []
    }
    const direction = entry.amountMinor > 0 ? 'in' as const : 'out' as const
    const record: HomeRecord = {
      id: `journal:${entry.id}:${entry.accountId}`,
      expenseId: entry.expenseId,
      spaceId: null,
      occurredOn: entry.occurredOn,
      createdAt: entry.createdAt,
      description: entry.memo?.trim() || entry.kind,
      category: entry.kind === 'transfer' ? 'transfer' : 'Other',
      chip: { kind: 'personal' },
      direction,
      amountMinor: Math.abs(entry.amountMinor),
      currency: entry.currency.toUpperCase(),
      accountId: entry.accountId,
      walletName: entry.accountName,
      fundingPending: false,
      amountKnown: input.fundingKnown,
      affectsPersonalSpending: false,
    }
    return [record]
  })

  const visible = [...expenseRecords, ...journalRecords]
    .filter((record) =>
      input.selectedAccountId === 'all' || record.accountId === input.selectedAccountId,
    )
    .sort((left, right) =>
      right.occurredOn.localeCompare(left.occurredOn)
      || right.createdAt.localeCompare(left.createdAt)
      || left.id.localeCompare(right.id),
    )

  return input.limit == null ? visible : visible.slice(0, input.limit)
}

export function presentHomeRecords(
  records: readonly HomeRecord[],
  density: 'detailed' | 'compact',
): HomeRecordPresentation[] {
  return records.map((record) => ({
    ...record,
    showIcon: density === 'detailed',
    showChip: density === 'detailed' || record.chip.kind !== 'personal',
    compact: density === 'compact',
  }))
}

export function groupHomeRecords(
  records: readonly HomeRecordPresentation[],
  today: string,
): HomeDateGroup[] {
  const yesterday = shiftCalendarDate(today, -1)
  const groups: HomeDateGroup[] = []
  for (const record of records) {
    const kind: DateGroupKind = record.occurredOn === today
      ? 'today'
      : record.occurredOn === yesterday
        ? 'yesterday'
        : 'date'
    const current = groups[groups.length - 1]
    if (!current || current.date !== record.occurredOn) {
      groups.push({ date: record.occurredOn, kind, records: [record] })
    } else {
      current.records.push(record)
    }
  }
  return groups
}

export function signedAmountCue(direction: 'in' | 'out'): { sign: '+' | '−'; tone: 'incoming' | 'outgoing' } {
  return direction === 'in'
    ? { sign: '+', tone: 'incoming' }
    : { sign: '−', tone: 'outgoing' }
}

function debtLinesForParticipants(
  input: {
    ownerParticipantId: string
    expenses: readonly CanonicalExpense[]
    settlements: readonly ConfirmedSettlement[]
  },
  participantIds: readonly string[],
): SharedContext['lines'] {
  const merged = new Map<string, { currency: string; direction: SharedBalanceDirection; amountMinor: number }>()
  for (const participantId of participantIds) {
    if (participantId === input.ownerParticipantId) continue
    const lines = linesFromDebt(
      input.ownerParticipantId,
      deriveRelationalDebtLines(input.expenses, input.settlements, {
        scope: 'direct',
        participantIds: [input.ownerParticipantId, participantId],
      }),
    )
    for (const line of lines) {
      const key = `${line.direction}:${line.currency}`
      const current = merged.get(key)
      if (current) current.amountMinor = addMinor(current.amountMinor, line.amountMinor)
      else merged.set(key, { ...line })
    }
  }
  return [...merged.values()].sort((left, right) =>
    left.direction.localeCompare(right.direction) || left.currency.localeCompare(right.currency),
  )
}

function linesFromDebt(
  ownerParticipantId: string,
  debts: ReturnType<typeof deriveRelationalDebtLines>,
): SharedContext['lines'] {
  const merged = new Map<string, { currency: string; direction: SharedBalanceDirection; amountMinor: number }>()
  for (const debt of debts) {
    if (debt.remainingMinor <= 0) continue
    const direction: SharedBalanceDirection | null = debt.creditorParticipantId === ownerParticipantId
      ? 'receivable'
      : debt.debtorParticipantId === ownerParticipantId
        ? 'payable'
        : null
    if (!direction) continue
    const key = `${direction}:${debt.currency}`
    const current = merged.get(key)
    if (current) current.amountMinor = addMinor(current.amountMinor, debt.remainingMinor)
    else merged.set(key, { currency: debt.currency, direction, amountMinor: debt.remainingMinor })
  }
  return [...merged.values()]
}

function sumDirection(
  contexts: readonly SharedContext[],
  direction: SharedBalanceDirection,
): CurrencyAmount[] {
  const totals = new Map<string, number>()
  for (const context of contexts) {
    for (const line of context.lines) {
      if (line.direction !== direction) continue
      totals.set(line.currency, addMinor(totals.get(line.currency) ?? 0, line.amountMinor))
    }
  }
  return [...totals.entries()]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

function tripPhase(trip: HomeSpaceRef, today: string): 'active' | 'ended' {
  if (trip.status !== 'active') return 'ended'
  if (trip.endDate && trip.endDate < today) return 'ended'
  return 'active'
}

function tripRecency(trip: HomeSpaceRef): string {
  return trip.startDate ?? trip.updatedAt
}

function fundingRank(funding: HomeFunding): number {
  if (funding.status === 'posted') return 3
  if (funding.status === 'pending') return 2
  return 1
}

function cashLeg(
  expense: CanonicalExpense,
  paidMinor: number,
  funding: HomeFunding | undefined,
  accounts: ReadonlyMap<string, HomeAccount>,
): {
  amountMinor: number
  currency: string
  accountId: string | null
  walletName: string | null
  fundingPending: boolean
} {
  if (funding?.status === 'pending') {
    return {
      amountMinor: paidMinor,
      currency: expense.currency.toUpperCase(),
      accountId: funding.accountId,
      walletName: null,
      fundingPending: true,
    }
  }
  if (
    funding?.status === 'posted'
    && funding.accountAmountMinor != null
    && funding.accountCurrency
  ) {
    const account = funding.accountId ? accounts.get(funding.accountId) : undefined
    return {
      amountMinor: funding.accountAmountMinor,
      currency: funding.accountCurrency.toUpperCase(),
      accountId: funding.accountId,
      walletName: account?.name ?? null,
      fundingPending: false,
    }
  }
  return {
    amountMinor: paidMinor,
    currency: expense.currency.toUpperCase(),
    accountId: null,
    walletName: null,
    fundingPending: false,
  }
}

function contextChip(
  expense: CanonicalExpense,
  ownerParticipantId: string,
  people: readonly HomePerson[],
  spaces: ReadonlyMap<string, HomeSpaceRef>,
  affiliations: readonly HomeAffiliation[],
): HomeContextChip {
  const affiliation = affiliations.find((item) => item.expenseId === expense.id)
  if (expense.scope === 'personal') {
    return affiliation
      ? { kind: 'personal-trip', tripLabel: affiliation.label }
      : { kind: 'personal' }
  }
  if (expense.scope === 'space') {
    return { kind: 'space', spaceName: spaces.get(expense.spaceId ?? '')?.name ?? expense.description ?? expense.category }
  }
  const other = expense.participations.find((participation) =>
    participation.participantId !== ownerParticipantId,
  )
  const person = other
    ? people.find((candidate) => candidate.participantIds.includes(other.participantId))
    : undefined
  const personName = person?.displayName ?? other?.nameSnapshot ?? null
  return { kind: 'direct', personName }
}
