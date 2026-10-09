import { useMemo } from 'react'
import type { usePersonalLedger } from './usePersonalLedger'
import type { useHomeData } from './useHomeData'
import type { useStore } from '../store/useStore'
import { personPrincipalIds } from '../lib/personMoney'
import type { ConfirmedSettlement } from '../lib/relationalBalance'
import {
  accountAttentionSources,
  addMinor,
  availableMoney,
  buildHomeRecords,
  deriveOutstandingSharedContexts,
  deriveSharedPreviewContexts,
  groupHomeRecords,
  homeRecordAccountFilter,
  isAvailableMoneyAccount,
  isBookedHomeExpense,
  listActionableAccountTasks,
  localCalendarDate,
  monthlyPersonalSpending,
  presentHomeRecords,
  receivableTotals,
  selectHomeTrip,
  summaryTileLayout,
  travelReadableExpenseIds,
  tripsFromAffiliations,
  type HomeSpaceRef,
} from '../lib/homeView'

export default function useHomeModel(input: {
  participantId: string | null
  timezone: string
  expensesStatus: 'loading' | 'error' | 'ready'
  expenses: ReturnType<typeof usePersonalLedger>['expenses']
  rows: ReturnType<typeof usePersonalLedger>['rows']
  home: ReturnType<typeof useHomeData>
  homeUi: ReturnType<typeof useStore.getState>['homeUi']
}) {
  return useMemo(() => {
    const accounts = input.home.accounts.data?.accounts ?? []
    const chosen = accounts.find((account) => account.id === input.homeUi.selectedAccountId)
    const selectedAccountId = input.home.accounts.status === 'ready'
      && chosen
      && isAvailableMoneyAccount(chosen)
      ? chosen.id
      : 'all'
    const balances = input.home.accounts.status === 'ready'
      ? availableMoney(accounts, selectedAccountId)
      : []
    const spaces: HomeSpaceRef[] = (input.home.spaces.data ?? (input.homeUi.mode === 'travel' ? input.home.spaces.previous : null) ?? []).map(({ space, role }) => ({
      id: space.id,
      type: space.type,
      name: space.name,
      status: space.status,
      startDate: space.startDate,
      endDate: space.endDate,
      updatedAt: space.updatedAt,
      defaultCurrency: space.defaultCurrency,
      role,
    }))
    const knownSpaceIds = new Set(spaces.map((space) => space.id))
    for (const expense of input.expenses) {
      if (expense.scope !== 'space' || !expense.spaceId || knownSpaceIds.has(expense.spaceId)) continue
      knownSpaceIds.add(expense.spaceId)
      spaces.push({
        id: expense.spaceId,
        type: 'group',
        name: '',
        status: 'active',
        startDate: null,
        endDate: null,
        updatedAt: expense.updatedAt,
      })
    }
    const people = (input.home.people.data ?? []).map((person) => ({
      id: person.id,
      displayName: person.displayName,
      participantIds: personPrincipalIds(person),
    }))
    const settlements: ConfirmedSettlement[] = (input.home.settlements.data ?? []).map((payment) => ({
      id: payment.id,
      scope: payment.scope,
      spaceId: payment.spaceId,
      debtorParticipantId: payment.debtorParticipantId,
      currency: payment.currency,
      status: payment.status,
      paymentDate: payment.paymentDate,
      createdAt: payment.createdAt,
      allocations: payment.allocations.map((allocation) => ({
        id: allocation.id,
        creditorParticipantId: allocation.creditorParticipantId,
        amountMinor: allocation.amountMinor,
        state: allocation.state,
        reversalMinor: allocation.reversalMinor,
      })),
    }))
    const affiliations = (input.home.affiliations.data ?? (input.homeUi.mode === 'travel' ? input.home.affiliations.previous : null) ?? []).map((affiliation) => ({
      expenseId: affiliation.expenseId,
      label: affiliation.label,
      archived: affiliation.archivedAt != null,
    }))
    const sharedStatus = combineStatus(
      input.expensesStatus,      input.home.people.status,
      input.home.settlements.status,
      input.home.spaces.status,
    )
    const travelStatus = combineStatus(input.home.spaces.status, input.home.affiliations.status)
    const sharedContexts = sharedStatus === 'ready' && input.participantId
      ? deriveOutstandingSharedContexts({
        ownerParticipantId: input.participantId,
        expenses: input.expenses,
        settlements,
        people,
        spaces,
      })
      : []
    const sharedPreviews = sharedStatus === 'ready' && input.participantId
      ? deriveSharedPreviewContexts({ ownerParticipantId: input.participantId, expenses: input.expenses, people })
      : []
    const accountTasks = input.home.accounts.status === 'ready' && input.home.accounts.data
      ? listActionableAccountTasks(accountAttentionSources({
        pendingFundingIds: input.home.accounts.data.pendingFundingIds,
        recurring: input.home.accounts.data.recurring,
        installments: input.home.accounts.data.installments,
        pendingPrincipalPlanIds: input.home.accounts.data.pendingPrincipalPlanIds,
      }), accounts)
      : []
    const accountCount = input.home.accounts.status === 'ready' ? accountTasks.length : 0
    const sharedCount = sharedStatus === 'ready' ? sharedContexts.length : 0
    const today = localCalendarDate(new Date(), input.timezone)
    const trips = [
      ...spaces.filter((space) => space.type === 'trip' && space.status !== 'voided'),
      ...(input.home.affiliations.status === 'ready'
        ? tripsFromAffiliations(affiliations, spaces)
        : []),
    ]
    const trip = (input.home.spaces.status === 'ready' || (input.homeUi.mode === 'travel' && input.home.spaces.previous))
      ? selectHomeTrip(trips, today, input.homeUi.selectedTripId)
      : null
    const travelIds = trip
      ? new Set(travelReadableExpenseIds({
        readableExpenseIds: input.expenses.map((expense) => expense.id),
        affiliations,
        trip: trip.trip,
        expenses: input.expenses,
      }))
      : new Set<string>()
    const records = input.participantId
      ? buildHomeRecords({
        ownerParticipantId: input.participantId,
        expenses: input.expenses,
        funding: input.home.accounts.data?.funding ?? [],
        accounts,
        people,
        spaces,
        affiliations,
        journals: input.home.accounts.data?.journals ?? [],
        selectedAccountId: homeRecordAccountFilter(input.homeUi.mode, selectedAccountId),
        limit: null,
        fundingKnown: input.home.accounts.status === 'ready',
      })
      : []
    const filtered = input.homeUi.mode === 'travel'
      ? records.filter((record) => record.expenseId != null && travelIds.has(record.expenseId))
      : records
    const bookedRows = input.participantId
      ? input.rows.filter((row) => isBookedHomeExpense(row.expense, input.participantId!))
      : []
    const tripRows = bookedRows.filter((row) => travelIds.has(row.expense.id))
    const tripSpending = sumSpending(tripRows)
    return {
      accounts,
      selectedAccountId,
      balances,
      monthlySpending: monthlyPersonalSpending(bookedRows, today.slice(0, 7)),
      receivables: sharedStatus === 'ready' ? receivableTotals(sharedContexts) : [],
      tileLayout: summaryTileLayout(accountCount, sharedCount),
      accountTasks,
      sharedContexts,
      sharedPreviews,
      sharedStatus,
      recordGroups: groupHomeRecords(presentHomeRecords(filtered, input.homeUi.density), today),
      flatRecords: filtered,
      trip,
      trips,
      travelStatus,
      tripSpending,
      tripSpendingStatus: combineStatus(input.expensesStatus, travelStatus, input.home.affiliations.status),
      emptyRecordsLabel: selectedAccountId === 'all'
        ? undefined
        : 'home.emptyRecordsFiltered' as const,
    }
  }, [input])
}

function combineStatus(
  ...statuses: Array<'loading' | 'error' | 'ready'>
): 'loading' | 'error' | 'ready' {
  if (statuses.some((status) => status === 'error')) return 'error'
  if (statuses.some((status) => status === 'loading')) return 'loading'
  return 'ready'
}

function sumSpending(rows: ReturnType<typeof usePersonalLedger>['rows']) {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const currency = row.expense.currency.toUpperCase()
    totals.set(currency, addMinor(totals.get(currency) ?? 0, row.personalSpendingMinor))
  }
  return [...totals.entries()]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}
