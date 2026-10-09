import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ExpenseActionSheet from '../components/ExpenseActionSheet'
import ExpenseRecoveryNotices from '../components/ExpenseRecoveryNotices'
import PendingExpenseRecoveryActions from '../components/PendingExpenseRecoveryActions'
import HomeScreen, { RecentRecordList, type HomeScreenProps } from '../components/home/HomeScreen'
import TripDetails from '../components/travel/TripDetails'
import { useTravelMembers } from '../hooks/useTravelMembers'
import { useUniversalQuickAdd } from '../hooks/useUniversalQuickAdd'
import { isSpaceExpenseEligible } from '../lib/moneyContext'
import { travelQuickAddRequest } from '../lib/travelQuickAdd'
import '../components/home/home.css'
import { useRouteScroll } from '../hooks/useRouteScroll'
import { useAuth } from '../hooks/useAuth'
import { useExpenseChanges } from '../hooks/useExpenseChanges'
import { useHomeData } from '../hooks/useHomeData'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import useHomeModel from '../hooks/useHomeModel'
import { useT } from '../lib/i18n'
import { createPersonalAccount } from '../lib/personalAccountRepository'
import { useStore } from '../store/useStore'

export default function PersonalLedgerPage() {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const { tripId } = useParams()
  const quickAdd = useUniversalQuickAdd()
  const [searchParams, setSearchParams] = useSearchParams()
  const { authUser, loading, sessionError, retrySession } = useAuth()
  const ledger = usePersonalLedger()
  const changeState = useExpenseChanges(Boolean(ledger.participantId), ledger.refresh)
  const homeUi = useStore((state) => state.homeUi)
  const selectedTripId = useStore(state => state.travelTripByIdentity[authUser?.id ?? ''] ?? null)
  const setTravelTrip = useStore(state => state.setTravelTrip)
  const setHomeUi = useStore((state) => state.setHomeUi)
  const [accountReload, setAccountReload] = useState(0)
  const homeRefreshKey = `${ledger.expenses.map((expense) => `${expense.id}:${expense.updatedAt}`).join('|')}:${accountReload}`
  const home = useHomeData(ledger.participantId, homeRefreshKey, true)
  const model = useHomeModel({
    participantId: ledger.participantId,
    timezone: authUser?.timezone ?? 'Asia/Kuala_Lumpur',
    expenses: ledger.expenses,
    expensesStatus: ledger.expensesStatus,
    rows: ledger.rows,
    home,
    homeUi: { ...homeUi, ...(tripId ? { mode: 'travel' as const } : {}), selectedTripId: tripId ?? selectedTripId },
  })

  useEffect(() => {
    // A cached list can predate trip creation or permission changes. Wait for
    // the fresh list before replacing a stored choice, and persist the initial
    // fallback so adding another trip does not silently change the selection.
    if (tripId || !authUser?.id || model.travelStatus !== 'ready' || home.refreshing) return
    if (!model.trips.some(trip => trip.id === selectedTripId)) {
      const nextId = model.trip?.trip.id ?? null
      if (nextId !== selectedTripId) setTravelTrip(authUser.id, nextId)
    }
  }, [authUser?.id, tripId, model.travelStatus, model.trips, model.trip, home.refreshing, selectedTripId, setTravelTrip])
  const detailTrip = tripId && model.trip?.trip.id !== tripId ? null : model.trip
  const members = useTravelMembers(ledger.participantId, tripId ? detailTrip?.trip.id ?? null : null, homeRefreshKey)
  const canWrite = Boolean(detailTrip && (!detailTrip.trip.id.startsWith('affiliation:') && isSpaceExpenseEligible(detailTrip.trip, detailTrip.trip.role ?? 'view')))
  const retryTravel = () => { setAccountReload(n => n + 1); void ledger.refresh() }
  const addTripExpense = () => {
    if (!detailTrip || !canWrite) return
    quickAdd.open(travelQuickAddRequest(detailTrip.trip, authUser!.id))
  }
  useRouteScroll((tripId || homeUi.mode === 'travel' ? model.travelStatus === 'ready' : model.sharedStatus === 'ready') && ledger.expensesStatus === 'ready', ledger.participantId ?? '')

  if (loading) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <p className="text-sm text-[var(--ms-text-secondary)]">{t('ledger.opening')}</p>
      </main>
    )
  }

  if (sessionError) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md text-center" role="alert">
          <p>{t('ledger.sessionUnavailable')}</p>
          <button className="ms-btn-primary mt-6 w-full" onClick={retrySession}>
            {t('common.retry')}
          </button>
        </section>
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
      if (!expense) return []
      const pending = ledger.outbox.find((item) => item.command.requestId === expense.clientRequestId)
      if (pending) return [[record.id, (
        <PendingExpenseRecoveryActions
          key={pending.command.requestId}
          item={pending}
          onUndoAdd={ledger.discardLocalCreate}
          onRetry={ledger.retryCommand}
          onDiscardFailed={ledger.discardFailedCreate}
        />
      )]]
      if (changeState.loading || changeState.error) return []
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

  const props: HomeScreenProps = {
    timezone: authUser.timezone ?? 'Asia/Kuala_Lumpur',
    initialAccountPanel: searchParams.get('accountPanel') === 'manage' ? 'manage' : undefined,
    onCloseAccountPanel: () => { if (searchParams.has('accountPanel')) setSearchParams({}, { replace: true }) },
    mode: tripId ? 'travel' : homeUi.mode,
    onModeChange: mode => setHomeUi({ mode }), density: homeUi.density,
    onDensityChange: density => setHomeUi({ density }), balanceHidden: homeUi.balanceHidden,
    onToggleBalanceHidden: () => setHomeUi({ balanceHidden: !homeUi.balanceHidden }),
    selectedAccountId: model.selectedAccountId, onSelectAccount: selectedAccountId => setHomeUi({ selectedAccountId }),
    accounts: model.accounts, accountsStatus: home.accounts.status,
    accountsRefreshing: home.refreshing && home.accounts.status === 'ready', defaultCurrency: authUser.defaultCurrency ?? 'MYR',
    onCreateAccount: async input => { await createPersonalAccount(input); setAccountReload(n => n + 1) },
    balances: model.balances, monthlySpending: model.monthlySpending, receivables: model.receivables,
    tileLayout: model.tileLayout, accountTasks: model.accountTasks, sharedContexts: model.sharedContexts,
    sharedPreviews: model.sharedPreviews, sharedStatus: model.sharedStatus,
    recordGroups: tripId && !detailTrip ? [] : model.recordGroups, recordsStatus: ledger.expensesStatus,
    onRetryRecords: () => void ledger.refresh(), affiliationsStatus: home.affiliations.status,
    recordActions, recordStatuses,
    travelPaginationKey: `${ledger.participantId}:${location.key}:${model.trip?.trip.id ?? ''}`,
    recordsViewKey: `${ledger.participantId}:${tripId ?? homeUi.mode}:${model.selectedAccountId}:${model.trip?.trip.id ?? ''}`,
    trip: detailTrip, trips: model.trips, travelStatus: model.travelStatus, tripSpending: detailTrip ? model.tripSpending : [],
    tripSpendingStatus: model.tripSpendingStatus,
    onSelectTrip: selectedTripId => setTravelTrip(authUser.id, selectedTripId),
    onCreateTrip: () => navigate('/travel/manage?create=1&return=travel'),
    onManageTrips: () => navigate('/travel/manage'),
    onViewTrip: id => { setTravelTrip(authUser.id, id); navigate(`/travel/trip/${encodeURIComponent(id)}`, { state: { travelBack: true } }) },
    onAddTripExpense: canWrite ? addTripExpense : undefined, onRetryTravel: retryTravel,
    onOpenCollectPay: direction => navigate(`/collect-pay/${direction}`, { state: { cpBack: true } }),
    onOpenSharedContext: context => {
      if (context.personId) navigate(`/person/${context.personId}`)
      else if (context.spaceId) navigate(`/space/${context.spaceId}`)
      else navigate('/shared')
    }, emptyRecordsLabel: model.emptyRecordsLabel,
  }
  if (tripId) return <>
    <TripDetails props={props} participantId={ledger.participantId} members={members.data} membersStatus={members.status}
      canWrite={canWrite} onBack={() => {
        setHomeUi({ mode: 'travel' })
        if (detailTrip) setTravelTrip(authUser.id, detailTrip.trip.id)
        if (location.state?.travelBack) navigate(-1); else navigate('/', { replace: true })
      }}
      onInfo={() => navigate(detailTrip?.trip.id.startsWith('affiliation:') ? '/travel/manage' : `/space/${tripId}?section=info`)}
      onMembers={() => navigate(`/space/${tripId}?section=members`)} onManage={() => navigate('/travel/manage')}
      records={<RecentRecordList key={props.recordsViewKey} props={props} paginationKey={props.travelPaginationKey} />} />
    <ExpenseRecoveryNotices />
  </>
  return <main className="ms-page home-shell" data-home-mode={homeUi.mode}>
    <HomeScreen {...props} /><ExpenseRecoveryNotices />
  </main>
}
