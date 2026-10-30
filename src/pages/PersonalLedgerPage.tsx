import {openSpaceNavigation,backSpaceNavigation,prepareSpaceBack} from '../lib/spaceNavigation'
import {useSpaceSourceReturn} from '../hooks/useSpaceSourceReturn'
import NotificationTarget from '../components/home/NotificationTarget'
import AccountBalance from '../components/accounts/AccountBalance'
import AccountActions from '../components/accounts/AccountActions'
import MovementRecordAction from '../components/accounts/MovementRecordAction'
import type { CurrencyAccount } from '../lib/multicurrency'
import {useHomeNotifications} from '../hooks/useHomeNotifications'
import {noticePath,parseNotice} from '../lib/homeNotifications'
import { useOpenHomeNotice } from '../hooks/useOpenHomeNotice'
import {parseNoticeLocation,simpleNotice} from '../lib/notificationPresentation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ExpenseActionSheet from '../components/ExpenseActionSheet'
import ExpenseRecoveryNotices from '../components/ExpenseRecoveryNotices'
import PendingExpenseRecoveryActions from '../components/PendingExpenseRecoveryActions'
import HomeScreen, { RecentRecordList, type HomeScreenProps } from '../components/home/HomeScreen'
import TripDetails from '../components/travel/TripDetails'
import TripOverviewRecords from '../components/travel/TripOverviewRecords'
import {tripVisibleExpenses} from '../lib/tripLedger'
import { useTravelMembers } from '../hooks/useTravelMembers'
import { useUniversalQuickAdd } from '../hooks/useUniversalQuickAdd'
import {openTripMembers} from '../lib/tripMembersNavigation'
import {openTripDates,pendingTripDatesReturn} from '../lib/tripDatesNavigation'
import {useTripDatesReturn} from '../hooks/useTripDatesReturn'
import { isSpaceExpenseEligible } from '../lib/moneyContext'
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
  const { setPageTarget } = useUniversalQuickAdd()
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
  const noticeTarget=useMemo(()=>parseNoticeLocation(location.pathname,location.search),[location.pathname,location.search])
  const previousNotice=useRef(noticeTarget)
  useEffect(()=>{
    const closed=previousNotice.current&&!noticeTarget
    previousNotice.current=noticeTarget
    if(!closed)return
    // Run after the old dialog's inert/focus cleanup and the router commit.
    const frame=requestAnimationFrame(()=>{if(!document.querySelector('[data-testid="home-notice-popover"]'))document.querySelector<HTMLButtonElement>('[data-testid="home-account-notice"]')?.focus({preventScroll:true})})
    return()=>cancelAnimationFrame(frame)
  },[noticeTarget])
  const notifications=useHomeNotifications(authUser?.id??null,ledger.participantId,ledger.outbox,homeRefreshKey)
  const openNotice=useOpenHomeNotice(ledger.participantId,authUser?.id??null,location.key)
  const refreshNotices=notifications.refresh
  const refreshLedger=ledger.refresh
  const refreshAfterTask=useCallback(async()=>{
    window.dispatchEvent(new Event('tt:accounts-changed'))
    await Promise.all([refreshLedger(),refreshNotices()])
  },[refreshLedger,refreshNotices])
  const closeNotice=()=>{
    if(location.state?.noticeBack)navigate(-1)
    else if(location.pathname.startsWith('/notifications/'))navigate('/',{replace:true})
    else {const next=new URLSearchParams(searchParams);next.delete('notice');next.delete('target');setSearchParams(next,{replace:true})}
  }
  const reportStatus=ledger.periodStatus==='error'?'error':ledger.periodStatus==='loading'?'loading':ledger.expensesStatus
  const model = useHomeModel({
    periodState:ledger.periodState,
    participantId: ledger.participantId,
    timezone: authUser?.timezone ?? 'Asia/Kuala_Lumpur',
    expenses: ledger.expenses,
    expensesStatus: ledger.expensesStatus,
    personalReportingStatus: reportStatus,
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
  const sharedTrip=!!tripId&&!!detailTrip&&!detailTrip.trip.id.startsWith('affiliation:')
  const tripExpenses=useMemo(()=>sharedTrip?tripVisibleExpenses(ledger.expenses,tripId!):[],[sharedTrip,ledger.expenses,tripId])
  const tripRecordStatus=ledger.expensesStatus==='error'||members.status==='error'?'error':ledger.expensesStatus==='ready'&&members.status==='ready'?'ready':'loading'
  const overviewRecordsReady=!sharedTrip||tripRecordStatus==='ready'
  const tripRole=members.data.find(m=>m.participant.id===ledger.participantId)?.member.role??'view'
  const tripNames=useMemo(()=>new Map(members.data.map(m=>[m.participant.id,m.participant.displayName])),[members.data])
  const refreshTripRecords=useCallback(async()=>{setAccountReload(n=>n+1);await refreshLedger()},[refreshLedger])
  const canWrite = Boolean(detailTrip && (!detailTrip.trip.id.startsWith('affiliation:') && isSpaceExpenseEligible(detailTrip.trip, detailTrip.trip.role ?? 'view')))
  const retryTravel = () => { setAccountReload(n => n + 1); void ledger.refresh() }
  const displayedTripId = detailTrip?.trip.id
  useEffect(() => {
    setPageTarget({ pathname: location.pathname, ready: model.travelStatus === 'ready', target: displayedTripId
      ? { kind: 'space-candidate', spaceId: displayedTripId } : { kind: 'personal' } })
    return () => setPageTarget(null)
  }, [setPageTarget, location.pathname, model.travelStatus, displayedTripId])
  const dateReturnReady=!pendingTripDatesReturn(location.state)||!home.refreshing
  useRouteScroll((tripId || homeUi.mode === 'travel' ? model.travelStatus === 'ready' : model.sharedStatus === 'ready') && ledger.expensesStatus === 'ready' && dateReturnReady && overviewRecordsReady, ledger.participantId ?? '')

  useSpaceSourceReturn(!home.refreshing && model.travelStatus==='ready' && ledger.expensesStatus==='ready' && overviewRecordsReady,authUser?.id??'',tripId??'')
  useEffect(()=>{if(tripId&&location.pathname==='/travel/trip/'+encodeURIComponent(tripId)&&detailTrip&&model.travelStatus==='ready'&&!home.refreshing&&authUser?.id&&!authUser.isAnonymous)prepareSpaceBack(navigate,location,authUser.id,'/')},[tripId,detailTrip,model.travelStatus,home.refreshing,authUser,navigate,location])

  useTripDatesReturn(!!tripId && model.travelStatus === 'ready' && ledger.expensesStatus === 'ready' && dateReturnReady && overviewRecordsReady, authUser?.id ?? '', tripId ?? '')

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
          <button className="ms-btn-primary mt-6 w-full" onClick={() => navigate(`/login?redirect=${encodeURIComponent(location.pathname+location.search)}`)}>
            {t('common.signIn')}
          </button>
          <button className="ms-btn-ghost mt-2 w-full" onClick={() => navigate('/shared')}>
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
          <button className="ms-btn-ghost mt-5 w-full" onClick={() => navigate('/shared')}>
            {t('ledger.openSpacesAnyway')}
          </button>
        </section>
      </main>
    )
  }

  const recordActions = Object.fromEntries(
    model.flatRecords.flatMap((record) => {
      if(record.movementId)return [[record.id,<MovementRecordAction key={record.id} id={record.movementId}/>]]
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
    notificationIdentity:authUser.id, notificationTargetOpen:!!noticeTarget||(searchParams.get('accountPanel')==='manage'&&!!searchParams.get('returnNotice')),
    notifications: notifications.notices, notificationsStatus: notifications.status, unreadNotifications: notifications.unread,
    onRetryNotifications: notifications.refresh, onViewNotifications: notifications.markViewed,
    onDismissNotifications: openNotice.cancel,
    onOpenNotification: notice=>{void openNotice.open(notice)},
    localToday: model.localToday,
    timezone: authUser.timezone ?? 'Asia/Kuala_Lumpur',
    initialAccountPanel: searchParams.get('accountPanel') === 'manage' ? 'manage' : undefined,
    onCloseAccountPanel: () => { if(searchParams.has('accountPanel')){const ref=parseNotice('?'+new URLSearchParams({notice:searchParams.get('returnNotice')??'',target:searchParams.get('returnTarget')??''}));if(ref)navigate(noticePath(ref),{replace:true,state:{noticeBack:true}});else setSearchParams({}, {replace:true})} },
    mode: tripId ? 'travel' : homeUi.mode,
    onModeChange: mode => setHomeUi({ mode }), density: homeUi.density,
    onDensityChange: density => setHomeUi({ density }), balanceHidden: homeUi.balanceHidden,
    onToggleBalanceHidden: () => setHomeUi({ balanceHidden: !homeUi.balanceHidden }),
    selectedAccountId: model.selectedAccountId, onSelectAccount: selectedAccountId => setHomeUi({ selectedAccountId }),
    accounts: model.accounts, accountsStatus: home.accounts.status,
    accountMore: <AccountActions accountId={model.selectedAccountId} accountName={model.accounts.find(a=>a.id===model.selectedAccountId)?.name ?? t(model.selectedAccountId==='all'?'home.allAccounts':'mc.state.unavailable')}/>,
    accountBalance: home.accounts.status==='ready'&&model.accounts.some(a=>a.parentAccountId)?<AccountBalance
      identity={authUser.id} includeArchived={model.accounts.find(a=>a.id===model.selectedAccountId)?.archived??false}
      accounts={model.accounts.filter(a=>model.selectedAccountId==='all'?!a.archived&&a.accountClass==='asset':a.parentAccountId===model.selectedAccountId) as CurrencyAccount[]}/>:undefined,
    accountsRefreshing: home.refreshing && home.accounts.status === 'ready', defaultCurrency: authUser.defaultCurrency ?? 'MYR',
    onCreateAccount: async input => { await createPersonalAccount(input); setAccountReload(n => n + 1) },
    balances: model.balances, monthlySpending: model.monthlySpending, receivables: model.receivables,
    tileLayout: model.tileLayout, accountTasks: model.accountTasks, sharedContexts: model.sharedContexts,
    sharedPreviews: model.sharedPreviews, sharedStatus: model.sharedStatus,
    recordGroups: tripId && !detailTrip ? [] : model.recordGroups, recordsStatus: reportStatus,
    onRetryRecords: () => void ledger.refresh(), affiliationsStatus: home.affiliations.status,
    recordActions, recordStatuses,
    travelPaginationKey: `${ledger.participantId}:${location.key}:${model.trip?.trip.id ?? ''}`,
    recordsViewKey: `${ledger.participantId}:${tripId ?? homeUi.mode}:${model.selectedAccountId}:${model.trip?.trip.id ?? ''}`,
    trip: detailTrip, trips: model.trips, travelStatus: model.travelStatus, tripSpending: detailTrip ? model.tripSpending : [],
    tripSpendingStatus: model.tripSpendingStatus,
    onSelectTrip: selectedTripId => setTravelTrip(authUser.id, selectedTripId),
    onCreateTrip: () => openSpaceNavigation(navigate,location,authUser.id,'/shared?tab=trips&create=1&return=travel','travel-switch'),
    onManageTrips: () => openSpaceNavigation(navigate,location,authUser.id,'/shared?tab=trips','travel-switch'),
    onViewTrip: id => { setTravelTrip(authUser.id, id); openSpaceNavigation(navigate,location,authUser.id,`/travel/trip/${encodeURIComponent(id)}`,'travel-view') },
    onRetryTravel: retryTravel,
    onOpenCollectPay: direction => navigate(`/collect-pay/${direction}`, { state: { cpBack: true } }),
    onOpenSharedContext: context => {
      if (context.personId) navigate(`/person/${context.personId}`)
      else if (context.spaceId) navigate(`/space/${context.spaceId}`)
      else navigate('/shared')
    }, emptyRecordsLabel: model.emptyRecordsLabel,
  }
  if (tripId) return <>
    <TripDetails props={props} participantId={ledger.participantId} members={members.data} membersStatus={members.status}
      sharedRecords={sharedTrip?{count:tripExpenses.length,currencies:tripExpenses.map(e=>e.currency),status:tripRecordStatus}:undefined}
      canWrite={canWrite} onBack={() => {
        setHomeUi({ mode: 'travel' })
        if (detailTrip) setTravelTrip(authUser.id, detailTrip.trip.id)
        backSpaceNavigation(navigate,location.state,authUser.id,location.pathname,'/')
      }}
      onInfo={focus => openSpaceNavigation(navigate,location,authUser.id,detailTrip?.trip.id.startsWith('affiliation:')?'/shared?tab=trips':`/space/${tripId}?section=info`,focus??'trip-info')}
      onDates={() => {if(authUser?.id&&tripId)openTripDates(navigate,location,authUser.id,tripId)}}
      onMembers={focus => {if(authUser?.id&&tripId)openTripMembers(navigate,location,authUser.id,tripId,focus)}} onManage={() => openSpaceNavigation(navigate,location,authUser.id,'/shared?tab=trips','trip-menu')}
      records={sharedTrip?<TripOverviewRecords viewKey={authUser.id+':'+tripId} key={authUser.id+':'+tripId} expenses={tripExpenses} status={tripRecordStatus} self={ledger.participantId} role={tripRole} names={tripNames} ledger={ledger} today={model.localToday} refresh={refreshTripRecords} canWrite={canWrite}/>:<RecentRecordList key={props.recordsViewKey} props={props} paginationKey={props.travelPaginationKey} />} />
    <ExpenseRecoveryNotices />
  </>
  if(location.pathname.startsWith('/notifications/')&&!noticeTarget)return <main className="notification-a-page"><h1>{t('noticeA.state.unavailable')}</h1><p>{t('notice.unavailable')}</p><button type="button" className="notification-a-back" onClick={()=>navigate('/',{replace:true})}>{t('noticeA.common.backNotifications')}</button></main>
  const targetElement=noticeTarget&&ledger.participantId?<NotificationTarget key={`${authUser.id}:${noticeTarget.kind}:${noticeTarget.id}`} details={searchParams.get('details')==='1'} reviewVersion={/^[1-9][0-9]{0,8}$/.test(searchParams.get('review')??'')?Number(searchParams.get('review')):undefined} timezone={authUser.timezone} sourceVersion={`${notifications.status}:${notifications.contextRevision}:${notifications.notices.find(n=>n.ref.kind===noticeTarget.kind&&n.ref.id===noticeTarget.id)?.version??'missing'}`} owner={ledger.participantId} identity={authUser.id} target={noticeTarget} ledger={ledger} onClose={closeNotice} onViewed={notifications.markRead} onChange={refreshAfterTask}/>:null
  if(noticeTarget&&(!simpleNotice(noticeTarget)||searchParams.get('details')==='1'))return targetElement
  return <main className="ms-page home-shell" data-home-mode={homeUi.mode}>
    <HomeScreen key={props.initialAccountPanel??'home'} {...props} /><ExpenseRecoveryNotices />
    {targetElement}
  </main>
}
