import {useTripFriends} from '../hooks/useTripFriends'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BackControl,
  CenteredDialog,
  ContextTabs,
  CurrencyControl,
  EmptyState,
  ErrorState,
  FilterControls,
  OfflineNotice,
  PersonList,
  PersonRow,
  PaperSurface,
  QuietAction,
  ReviewRow,
  ReviewSummary,
  SearchField,
  SharedHeader,
  SharedRoot,
  SkeletonList,
  SpaceRow,
  TextField,
} from '../components/shared/SharedComponents'
import { useAuth } from '../hooks/useAuth'
import { useHomeNotifications } from '../hooks/useHomeNotifications'
import { useLocalCalendarDate } from '../hooks/useLocalCalendarDate'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { useSettlements } from '../hooks/useSettlements'
import { friendRepository, type ParticipantLinkRequest } from '../lib/friendRepository'
import { friendlyErrorKey, useT, type TranslationKey } from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { noticeCalendarDate } from '../lib/homeNotifications'
import { personRepository } from '../lib/personRepository'
import {
  buildPersonListRow,
  sharedReviewTasks,
} from '../lib/sharedAListModel'
import {
  emptySharedOrigin,
  filterFromParam,
  readSharedOrigin,
  saveSharedOrigin,
  tabFromParam,
} from '../lib/sharedAOrigin'
import {
  filterBalances,
  searchNames,
  type AmountView,
  type SharedTab,
} from '../lib/sharedAPresentation'
import { spaceRepository, type SpaceWithRole } from '../lib/spaceRepository'
import { tripPeriodStatus, tripPeriodStatusKeys } from '../lib/tripPeriod'
import { useStore } from '../store/useStore'
import type { PersonRelationship } from '../types'
import SpacesPage from './SpacesPage'

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])
  return online
}

function localizeAmount(view: AmountView, t: (key: TranslationKey, params?: Record<string, string | number>) => string): AmountView {
  if (view.kind === 'amount') {
    return { ...view, direction: view.direction === 'owes you' ? t('sharedA.owesYou') : t('sharedA.youOwe') }
  }
  const status = view.status === 'Hidden' ? t('sharedA.hidden')
    : view.status === 'Only you record this' ? t('sharedA.manual')
    : view.status === 'Other currencies' ? t('sharedA.otherCurrencies')
    : view.status === 'Settled up' ? t('sharedA.settled')
    : view.status === 'Pending review' ? t('sharedA.pendingReview')
    : view.status === 'No records yet' ? t('sharedA.noRecords')
    : view.status
  return { ...view, status }
}

export default function SharedPage() {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const hidden = useStore((state) => state.homeUi.balanceHidden)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { authUser, loading: authLoading } = useAuth()
  const participantId = authUser?.participantId ?? null
  const identity = authUser?.id ?? ''
  const friendRequests=useTripFriends(authUser&&!authUser.isAnonymous?identity:'')
  const incomingFriends=friendRequests.requests.filter(r=>r.target_id===participantId)
  const profileCurrency = (authUser?.defaultCurrency ?? 'MYR').toUpperCase()
  const ledger = usePersonalLedger()
  const settlements = useSettlements(Boolean(participantId))
  const notices = useHomeNotifications(identity || null, participantId, ledger.outbox, identity)
  const online = useOnline()
  const today = useLocalCalendarDate(authUser?.timezone ?? 'Asia/Kuala_Lumpur')
  const origin = identity ? readSharedOrigin(identity, profileCurrency) : emptySharedOrigin('', profileCurrency)
  const tab = tabFromParam(params.get('tab'))
  const view = params.get('view') === 'review' ? 'review' : 'list'
  const searching = params.get('search') === '1'
  const query = params.get('q') ?? ''
  const filter = filterFromParam(params.get('filter'))
  const currency = (params.get('currency') ?? profileCurrency).toUpperCase()
  const [people, setPeople] = useState<PersonRelationship[]>([])
  const [spaces, setSpaces] = useState<SpaceWithRole[]>([])
  const [linkRequests, setLinkRequests] = useState<ParticipantLinkRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<TranslationKey | ''>('')
  const [dialog, setDialog] = useState<'add' | 'manual' | 'invite' | 'currency' | null>(null)
  const [manualName, setManualName] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [action, setAction] = useState('')
  const [linkFocus, setLinkFocus] = useState<ParticipantLinkRequest | null>(null)

  const persist = useCallback((patch: Partial<{ tab: SharedTab; view: 'list' | 'review'; query: string; filter: typeof filter; currency: string; searching: boolean }>) => {
    if (!identity) return
    const current = readSharedOrigin(identity, profileCurrency)
    const nextTab = patch.tab ?? tab
    current.tab = nextTab
    current.view = patch.view ?? view
    current.tabs[nextTab] = {
      ...current.tabs[nextTab],
      query: patch.query ?? (nextTab === tab ? query : current.tabs[nextTab].query),
      filter: patch.filter ?? (nextTab === tab ? filter : current.tabs[nextTab].filter),
      currency: patch.currency ?? (nextTab === tab ? currency : current.tabs[nextTab].currency),
      searching: patch.searching ?? (nextTab === tab ? searching : current.tabs[nextTab].searching),
      scrollTop: typeof window === 'undefined' ? 0 : window.scrollY,
    }
    saveSharedOrigin(identity, current)
  }, [currency, filter, identity, profileCurrency, query, searching, tab, view])

  const writeParams = useCallback((next: { tab?: SharedTab; view?: 'list' | 'review'; query?: string; filter?: typeof filter; currency?: string; searching?: boolean; create?: boolean }) => {
    const nextTab = next.tab ?? tab
    const memory = identity ? readSharedOrigin(identity, profileCurrency).tabs[nextTab] : origin.tabs[nextTab]
    const nextParams = new URLSearchParams()
    if (nextTab !== 'friends') nextParams.set('tab', nextTab)
    const nextView = next.view ?? (next.tab && next.tab !== tab ? 'list' : view)
    if (nextView === 'review') nextParams.set('view', 'review')
    const nextQuery = next.query ?? (next.tab && next.tab !== tab ? memory.query : query)
    const nextSearch = next.searching ?? (next.tab && next.tab !== tab ? memory.searching : searching)
    if (nextSearch) nextParams.set('search', '1')
    if (nextQuery) nextParams.set('q', nextQuery)
    const nextFilter = next.filter ?? (next.tab && next.tab !== tab ? memory.filter : filter)
    if (nextFilter === 'balances') nextParams.set('filter', 'balances')
    const nextCurrency = (next.currency ?? (next.tab && next.tab !== tab ? memory.currency : currency)).toUpperCase()
    if (nextCurrency && nextCurrency !== profileCurrency) nextParams.set('currency', nextCurrency)
    if (next.create || params.get('create') === '1' && !next.tab) nextParams.set('create', '1')
    persist({ tab: nextTab, view: nextView, query: nextQuery, filter: nextFilter, currency: nextCurrency, searching: nextSearch })
    setParams(nextParams, { replace: true })
  }, [currency, filter, identity, origin.tabs, params, persist, profileCurrency, query, searching, setParams, tab, view])

  const refresh = useCallback(async () => {
    if (!authUser?.participantId || authUser.isAnonymous) {
      setLoading(false)
      return
    }
    try {
      const [nextPeople, nextLinks, nextSpaces] = await Promise.all([
        personRepository.listPeople(),
        friendRepository.listLinkRequests(),
        spaceRepository.list(),
        ledger.refresh(),
      ])
      setPeople(nextPeople)
      setLinkRequests(nextLinks)
      setSpaces(nextSpaces)
      setError('')
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setLoading(false)
    }
  }, [authUser?.isAnonymous, authUser?.participantId, ledger])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(()=>{const changed=(event:Event)=>{const data=(event as CustomEvent).detail;if(data?.identity===authUser?.id)void refresh()};window.addEventListener('tt:trip-dates-changed',changed);return()=>window.removeEventListener('tt:trip-dates-changed',changed)},[refresh,authUser?.id])

  useEffect(() => personRepository.subscribeToPeople(() => void refresh()), [refresh])
  useEffect(() => {
    if (!identity) return
    const memory = readSharedOrigin(identity, profileCurrency)
    window.scrollTo?.({ top: memory.tabs[tab].scrollTop, behavior: 'instant' })
  }, [identity, profileCurrency, tab])

  const incomingLinks = linkRequests.filter((request) => request.targetParticipantId === participantId && request.status === 'pending')
  const reviewTasks = useMemo(() => sharedReviewTasks(notices.notices), [notices.notices])
  const reviewCount = reviewTasks.length + incomingLinks.length + new Set(incomingFriends.map(r=>r.id)).size

  const rows = useMemo(() => {
    if (!participantId) return []
    return people.map((person) => buildPersonListRow({
      person,
      ownerId: participantId,
      expenses: ledger.expenses,
      settlements: settlements.settlements,
      notices: notices.notices,
      selectedCurrency: currency,
      hidden,
    }))
  }, [currency, hidden, ledger.expenses, notices.notices, participantId, people, settlements.settlements])

  const visibleRows = useMemo(() => {
    const searched = searchNames(rows.map((row) => ({ ...row, name: row.name })), query)
    return filter === 'balances' ? [...filterBalances(searched, true)] : searched
  }, [filter, query, rows])

  const currencies = useMemo(() => {
    const set = new Set<string>([profileCurrency])
    for (const row of rows) for (const position of row.positions) set.add(position.currency)
    return [...set].sort()
  }, [profileCurrency, rows])

  const spaceRows = (preferred: 'group' | 'trip') => searchNames(
    spaces.filter(({ space }) => space.type === preferred).map(({ space, role }) => ({
      id: space.id,
      name: space.name,
      meta: space.type === 'trip'
        ? [space.startDate ? formatDate(space.startDate, lang) : t('spaces.noDates'), space.endDate ? formatDate(space.endDate, lang) : null].filter(Boolean).join(' – ')
        : t(role === 'owner' ? 'role.owner' : role === 'full_access' ? 'role.full_access' : 'role.view'),
      status: space.type === 'trip' ? t(tripPeriodStatusKeys[tripPeriodStatus(space, today)]) : '',
    })),
    query,
  )

  const openPerson = (id: string) => {
    persist({})
    const from = `${window.location.pathname}${window.location.search}`
    navigate(`/person/${id}?from=${encodeURIComponent(from)}`)
  }

  const createInvite = async () => {
    if (action) return
    setAction('invite')
    try {
      const token = await friendRepository.createInvite()
      const url = `${window.location.origin}/friend-invite/${token}`
      setInviteUrl(url)
      await navigator.clipboard?.writeText(url)
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const addManual = async () => {
    if (!manualName.trim() || action) return
    setAction('manual')
    try {
      await personRepository.createManualPerson(manualName.trim())
      setManualName('')
      setDialog(null)
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const respondLink = async (requestId: string, response: 'accepted' | 'declined') => {
    if (action) return
    setAction(`link:${requestId}`)
    try {
      await friendRepository.respondManualLink(requestId, response)
      setLinkFocus(null)
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  if (authLoading) {
    return <SharedRoot as="main"><SkeletonList label={t('sharedA.loading')} /></SharedRoot>
  }

  if (!authUser || authUser.isAnonymous || !participantId) {
    return (
      <SharedRoot as="main">
        <EmptyState
          title={t('friends.accountRequired')}
          help={t('friends.accountHelp')}
          action={<QuietAction icon="people" onClick={() => navigate(authUser ? '/profile' : '/login')}>{authUser ? t('friends.linkAccount') : t('common.signIn')}</QuietAction>}
        />
      </SharedRoot>
    )
  }

  const addLabel = tab === 'friends' ? t('sharedA.addPerson') : tab === 'groups' ? t('sharedA.addGroup') : t('sharedA.addTrip')
  const searchLabel = tab === 'friends' ? t('sharedA.searchFriends') : tab === 'groups' ? t('sharedA.searchGroups') : t('sharedA.searchTrips')

  return (
    <SharedRoot as="main">
      {view === 'review' ? (
        <header className="ttsa-header">
          <BackControl label={t('sharedA.back')} onBack={() => writeParams({ view: 'list' })} />
          <h1 className="ttsa-title">{t('sharedA.review')}</h1>
        </header>
      ) : searching ? (
        <SearchField
          query={query}
          onQuery={(value) => writeParams({ query: value, searching: true })}
          onCancel={() => writeParams({ searching: false })}
          label={searchLabel}
          cancelLabel={t('sharedA.cancel')}
          clearLabel={t('sharedA.clear')}
        />
      ) : (
        <SharedHeader
          title={t('sharedA.title')}
          addLabel={addLabel}
          searchLabel={searchLabel}
          onSearch={() => writeParams({ searching: true })}
          onAdd={() => {
            if (tab === 'friends') setDialog('add')
            else writeParams({ create: true })
          }}
        />
      )}
      {tab === 'friends' ? <h2 className="ttsa-sr-only">{t('friends.title')}</h2> : null}
      {view !== 'review' ? (
        <ContextTabs
          active={tab}
          label={t('sharedA.tabs')}
          tabs={[
            { id: 'friends', label: t('sharedA.friends') },
            { id: 'groups', label: t('sharedA.groups') },
            { id: 'trips', label: t('sharedA.trips') },
          ]}
          onChange={(next) => writeParams({ tab: next, searching: false, view: 'list' })}
        />
      ) : null}

      {!online ? <OfflineNotice label={t('sharedA.offline')} /> : null}
      {error ? <ErrorState title={t('sharedA.loadError')} help={t(error)} retryLabel={t('sharedA.retry')} onRetry={() => void refresh()} /> : null}

      {friendRequests.error?<p className="ttsa-friend-error" role="alert">{t('friendRequest.retryHelp')} <button type="button" onClick={()=>void friendRequests.refresh()}>{t('common.retry')}</button></p>:null}
      {view === 'review' ? (
        <PaperSurface>
          {incomingFriends.map(request=><section className="ttsa-friend-request" key={request.id} data-testid="friend-request-review"><h2>{request.sender_name}</h2><p>{t('friendRequest.fromTrip',{name:request.source_name})}</p><p>{t('friendRequest.wantsFriend')}</p><div><button type="button" disabled={!!friendRequests.busy} onClick={()=>void friendRequests.respond(request,'declined')}>{t('common.decline')}</button><button type="button" disabled={!!friendRequests.busy||request.canAccept!==true} onClick={()=>void friendRequests.respond(request,'accepted')}>{t('common.accept')}</button></div></section>)}
          {incomingLinks.map((request) => (
            <ReviewRow
              key={request.id}
              title={t('friends.linkRequestTitle')}
              meta={t('friends.historyRequest')}
              actionLabel={t('sharedA.reviewAction')}
              onOpen={() => setLinkFocus(request)}
            />
          ))}
          {reviewTasks.map((task) => (
            <ReviewRow
              key={`${task.kind}:${task.id}`}
              title={t(task.notice.title)}
              meta={[noticeCalendarDate(task.notice.date, authUser.timezone ?? 'Asia/Kuala_Lumpur'), task.notice.contextLabel].filter(Boolean).join(' · ')}
              actionLabel={t('sharedA.reviewAction')}
              onOpen={() => navigate(`/notifications/${task.kind}/${encodeURIComponent(task.id)}`)}
            />
          ))}
          {reviewCount === 0 ? <EmptyState title={t('sharedA.review')} help={t('sharedA.pendingHelp')} /> : null}
        </PaperSurface>
      ) : null}

      {view === 'list' && tab === 'friends' ? (
        <>
          <ReviewSummary count={reviewCount} label={t('sharedA.review')} onOpen={() => writeParams({ view: 'review' })} />
          <FilterControls
            value={filter}
            allLabel={t('sharedA.all')}
            balanceLabel={t('sharedA.withBalances')}
            onChange={(value) => writeParams({ filter: value })}
          >
            <CurrencyControl
              label={`${t('sharedA.between')} · ${currency}`}
              onOpen={() => setDialog('currency')}
            />
          </FilterControls>
          {loading && people.length === 0 ? <SkeletonList label={t('sharedA.loading')} /> : null}
          {!loading && rows.length === 0 ? (
            <EmptyState title={t('sharedA.empty')} help={t('sharedA.emptyHelp')} action={<QuietAction icon="plus" onClick={() => setDialog('add')}>{t('sharedA.addPerson')}</QuietAction>} />
          ) : null}
          {!loading && rows.length > 0 && visibleRows.length === 0 ? (
            <EmptyState title={t('sharedA.noMatches')} help={t('sharedA.clear')} action={<QuietAction icon="close" onClick={() => writeParams({ query: '' })}>{t('sharedA.clear')}</QuietAction>} />
          ) : null}
          {visibleRows.length > 0 ? (
            <PaperSurface>
              <PersonList>
                {visibleRows.map((row) => {
                  const amount = localizeAmount(row.amount, t)
                  const meta = row.amount.kind === 'hidden' ? ''
                    : row.pendingCount > 0 ? (row.pendingCount === 1 ? t('sharedA.reviewCountOne') : t('sharedA.reviewCount', { count: row.pendingCount }))
                    : row.linkPending ? t('sharedA.linkPending')
                    : row.manual ? t('sharedA.manual')
                    : row.lastShared ? t('sharedA.lastShared', { date: formatDate(row.lastShared, lang) })
                    : row.hasConfirmedHistory ? t('sharedA.settled')
                    : t('sharedA.noRecords')
                  const label = amount.kind === 'hidden'
                    ? `${row.name}. ${t('sharedA.hidden')}`
                    : `${row.name}. ${[meta, amount.amount, amount.direction || amount.status].filter(Boolean).join('. ')}`
                  return (
                    <PersonRow
                      key={row.id}
                      name={row.name}
                      meta={meta}
                      amount={amount}
                      label={label}
                      longLayout={amount.amount.length > 14}
                      onOpen={() => openPerson(row.id)}
                    />
                  )
                })}
              </PersonList>
            </PaperSurface>
          ) : null}
        </>
      ) : null}

      {view === 'list' && tab !== 'friends' ? (
        <>
          {searching && spaceRows(tab === 'groups' ? 'group' : 'trip').length === 0 && query ? (
            <EmptyState title={t('sharedA.noMatches')} help="" action={<QuietAction icon="close" onClick={() => writeParams({ query: '' })}>{t('sharedA.clear')}</QuietAction>} />
          ) : null}
          <PaperSurface>
            {spaceRows(tab === 'groups' ? 'group' : 'trip').map((row) => (
              <SpaceRow key={row.id} name={row.name} meta={row.meta} status={row.status} onOpen={() => navigate(`/space/${row.id}`)} />
            ))}
            {!loading && spaceRows(tab === 'groups' ? 'group' : 'trip').length === 0 && !query ? (
              <EmptyState
                title={tab === 'groups' ? t('sharedA.emptyGroups') : t('sharedA.emptyTrips')}
                help={t('spaces.emptyHelp')}
                action={<QuietAction icon="plus" onClick={() => writeParams({ create: true })}>{addLabel}</QuietAction>}
              />
            ) : null}
          </PaperSurface>
          {params.get('create') === '1' ? <SpacesPage preferredType={tab === 'groups' ? 'group' : 'trip'} embedded /> : null}
        </>
      ) : null}

      {linkFocus ? (
        <CenteredDialog open title={t('friends.historyRequest')} closeLabel={t('common.close')} onClose={() => setLinkFocus(null)}>
          <p className="ttsa-meta">{t('friends.linkRequestHelp')}</p>
          <div className="ttsa-actions">
            <QuietAction icon="close" onClick={() => void respondLink(linkFocus.id, 'declined')}>{t('common.decline')}</QuietAction>
            <QuietAction icon="people" onClick={() => void respondLink(linkFocus.id, 'accepted')}>{t('friends.acceptLink')}</QuietAction>
          </div>
        </CenteredDialog>
      ) : null}

      <CenteredDialog open={dialog === 'add'} title={t('sharedA.addPerson')} closeLabel={t('common.close')} onClose={() => setDialog(null)}>
        <div className="ttsa-actions">
          <QuietAction icon="people" onClick={() => { setDialog('invite'); setInviteUrl('') }}>{t('sharedA.invite')}</QuietAction>
          <QuietAction icon="plus" onClick={() => setDialog('manual')}>{t('sharedA.manualAdd')}</QuietAction>
        </div>
      </CenteredDialog>
      <CenteredDialog open={dialog === 'manual'} title={t('sharedA.manualAdd')} closeLabel={t('common.close')} onClose={() => setDialog(null)}>
        <TextField label={t('sharedA.name')} value={manualName} onChange={setManualName} />
        <QuietAction icon="plus" disabled={!manualName.trim() || action === 'manual'} onClick={() => void addManual()}>{t('sharedA.addPerson')}</QuietAction>
      </CenteredDialog>
      <CenteredDialog open={dialog === 'invite'} title={t('sharedA.invite')} closeLabel={t('common.close')} onClose={() => setDialog(null)}>
        <p className="ttsa-meta">{t('sharedA.inviteHelp')}</p>
        <QuietAction icon="people" disabled={action === 'invite'} onClick={() => void createInvite()}>{inviteUrl ? t('sharedA.copied') : t('sharedA.copyInvite')}</QuietAction>
      </CenteredDialog>
      <CenteredDialog open={dialog === 'currency'} title={t('sharedA.currency')} closeLabel={t('common.close')} onClose={() => setDialog(null)}>
        {currencies.map((code) => (
          <button key={code} type="button" className="ttsa-link-row" onClick={() => { writeParams({ currency: code }); setDialog(null) }}>{code}</button>
        ))}
      </CenteredDialog>

    </SharedRoot>
  )
}
