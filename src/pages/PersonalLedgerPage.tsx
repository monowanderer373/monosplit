import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ExpenseActionSheet from '../components/ExpenseActionSheet'
import ExpenseRecoveryNotices from '../components/ExpenseRecoveryNotices'
import HomeScreen from '../components/home/HomeScreen'
import '../components/home/home.css'
import { useAuth } from '../hooks/useAuth'
import { useExpenseChanges } from '../hooks/useExpenseChanges'
import { useHomeData } from '../hooks/useHomeData'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import {
  HOME_RECENT_LIMIT,
  accountAttentionSources,
  addMinor,
  availableMoney,
  buildHomeRecords,
  deriveOutstandingSharedContexts,
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
import { useT } from '../lib/i18n'
import { personPrincipalIds } from '../lib/personMoney'
import type { ConfirmedSettlement } from '../lib/relationalBalance'
import { useStore } from '../store/useStore'

export default function PersonalLedgerPage() {
  const t = useT()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { authUser, loading } = useAuth()
  const ledger = usePersonalLedger()
  const changeState = useExpenseChanges(Boolean(ledger.participantId), ledger.refresh)
  const homeUi = useStore((state) => state.homeUi)
  const setHomeUi = useStore((state) => state.setHomeUi)
  const showAllRecords = params.get('records') === 'all'
  const homeRefreshKey = ledger.expenses.map((expense) => `${expense.id}:${expense.updatedAt}`).join('|')
  const home = useHomeData(ledger.participantId, homeRefreshKey, showAllRecords)
  const model = useHomeModel({
    participantId: ledger.participantId,
    timezone: authUser?.timezone ?? 'Asia/Kuala_Lumpur',
    expenses: ledger.expenses,
    rows: ledger.rows,
    home,
    homeUi,
    showAllRecords,
  })

  if (loading) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <p className="text-sm text-[var(--ms-text-secondary)]">{t('ledger.opening')}</p>
      </main>
    )
  }

  if (!authUser) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md text-center">
          <p className="ms-label">{t('ledger.privateLabel')}</p>
          <h1 className="mt-2 text-3xl font-extrabold">{t('ledger.privateTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ms-text-secondary)]">
            {t('ledger.privateHelp')}
          </p>
          <button className="ms-btn-primary mt-6 w-full" onClick={() => navigate('/login')}>
            {t('common.signIn')}
          </button>
          <button className="ms-btn-ghost mt-2 w-full" onClick={() => navigate('/spaces')}>
            {t('ledger.openSpaces')}
          </button>
        </section>
      </main>
    )
  }

  if (!ledger.participantId) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md">
          <p className="ms-label">{t('ledger.schemaLabel')}</p>
          <h1 className="mt-2 text-2xl font-extrabold">{t('ledger.schemaTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ms-text-secondary)]">
            {t('ledger.schemaHelp')}
          </p>
          <button className="ms-btn-ghost mt-5 w-full" onClick={() => navigate('/spaces')}>
            {t('ledger.openSpacesAnyway')}
          </button>
        </section>
      </main>
    )
  }

  const recordActions = Object.fromEntries(
    model.flatRecords.flatMap((record) => {
      if (!record.expenseId || !ledger.participantId) return []
      const expense = ledger.expenses.find((item) => item.id === record.expenseId)
      if (!expense || changeState.loading || changeState.error) return []
      const pending = ledger.outbox.find((item) => item.command.requestId === expense.clientRequestId)
      if (pending) return []
      return [[record.id, (
        <ExpenseActionSheet
          key={expense.id}
          expense={expense}
          currentParticipantId={ledger.participantId}
          pendingRequest={changeState.requests.find((request) => (
            request.targetExpenseId === expense.id && request.state === 'pending'
          ))}
          onCancelExpense={ledger.voidExpense}
          onRefresh={changeState.refreshAuthoritative}
        />
      )]]
    }),
  )
  const recordStatuses = Object.fromEntries(
    model.flatRecords.flatMap((record) => {
      if (!record.expenseId) return []
      const expense = ledger.expenses.find((item) => item.id === record.expenseId)
      const pending = expense
        ? ledger.outbox.find((item) => item.command.requestId === expense.clientRequestId)
        : undefined
      if (!pending) return []
      return [[record.id, pending.status === 'rejected' ? t('ledger.needsAttention') : t('ledger.pendingSync')]]
    }),
  )

  return (
    <main className="ms-page home-shell">
      <HomeScreen
        mode={homeUi.mode}
        onModeChange={(mode) => setHomeUi({ mode })}
        density={homeUi.density}
        onDensityChange={(density) => setHomeUi({ density })}
        balanceHidden={homeUi.balanceHidden}
        onToggleBalanceHidden={() => setHomeUi({ balanceHidden: !homeUi.balanceHidden })}
        selectedAccountId={model.selectedAccountId}
        onSelectAccount={(selectedAccountId) => setHomeUi({ selectedAccountId })}
        accounts={model.accounts}
        accountsStatus={home.accounts.status}
        balances={model.balances}
        monthlySpending={model.monthlySpending}
        receivables={model.receivables}
        tileLayout={model.tileLayout}
        accountTasks={model.accountTasks}
        sharedContexts={model.sharedContexts}
        sharedStatus={model.sharedStatus}
        recordGroups={model.recordGroups}
        recordActions={recordActions}
        recordStatuses={recordStatuses}
        onShowAllRecords={() => {
          const next = new URLSearchParams(params)
          next.set('records', 'all')
          setParams(next)
        }}
        showingAllRecords={showAllRecords}
        trip={model.trip}
        trips={model.trips}
        travelStatus={model.travelStatus}
        tripSpending={model.tripSpending}
        onSelectTrip={(selectedTripId) => setHomeUi({ selectedTripId })}
        onCreateTrip={() => navigate('/spaces')}
        onOpenSharedContext={(context) => {
          if (context.personId) navigate(`/person/${context.personId}`)
          else if (context.spaceId) navigate(`/space/${context.spaceId}`)
        }}
        emptyRecordsLabel={model.emptyRecordsLabel}
      />

      <ExpenseRecoveryNotices />
    </main>
  )
}

function useHomeModel(input: {
  participantId: string | null
  timezone: string
  expenses: ReturnType<typeof usePersonalLedger>['expenses']
  rows: ReturnType<typeof usePersonalLedger>['rows']
  home: ReturnType<typeof useHomeData>
  homeUi: ReturnType<typeof useStore.getState>['homeUi']
  showAllRecords: boolean
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
    const spaces: HomeSpaceRef[] = (input.home.spaces.data ?? []).map(({ space }) => ({
      id: space.id,
      type: space.type,
      name: space.name,
      status: space.status,
      startDate: space.startDate,
      endDate: space.endDate,
      updatedAt: space.updatedAt,
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
    const affiliations = (input.home.affiliations.data ?? []).map((affiliation) => ({
      expenseId: affiliation.expenseId,
      label: affiliation.label,
      archived: affiliation.archivedAt != null,
    }))
    const sharedStatus = combineStatus(
      input.home.people.status,
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
      ...tripsFromAffiliations(affiliations, spaces),
    ]
    const trip = travelStatus === 'ready'
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
    const limited = input.showAllRecords ? filtered : filtered.slice(0, HOME_RECENT_LIMIT)
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
      sharedStatus,
      recordGroups: groupHomeRecords(presentHomeRecords(limited, input.homeUi.density), today),
      flatRecords: limited,
      trip,
      trips,
      travelStatus,
      tripSpending,
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
