import { useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTripPeriodEditor } from '../hooks/useTripPeriodEditor'
import { useLocalCalendarDate } from '../hooks/useLocalCalendarDate'
import { useT } from '../lib/i18n'
import { validTripId } from '../lib/tripMembers'
import { armTripDatesReturn, backFromTripDates, prepareTripDatesBack, readTripDatesOrigin } from '../lib/tripDatesNavigation'
import TripRangeCalendar from '../components/travel/TripRangeCalendar'
import { TravelIcon } from '../components/travel/TravelUI'
import '../components/travel/trip-dates.css'

export default function TripDatesPage() {
  const { authUser, loading, sessionError, retrySession } = useAuth(), { tripId = '' } = useParams(), t = useT()
  if (loading || authUser && !authUser.participantId && !sessionError) return <main className="td-page"><p role="status">{t('common.loading')}</p></main>
  if (sessionError) return <main className="td-page"><p role="alert">{t('ledger.sessionUnavailable')}</p><button type="button" onClick={retrySession}>{t('common.retry')}</button></main>
  if (!authUser?.participantId) return <main className="td-page"><h1>{t('tripDates.title')}</h1><Link to={'/login?redirect=' + encodeURIComponent('/travel/trip/' + tripId + '/dates')}>{t('common.signIn')}</Link></main>
  if (!validTripId(tripId)) return <main className="td-page"><h1>{t('tripDates.unavailable')}</h1><Link to="/shared?tab=trips">{t('members.backTrips')}</Link></main>
  return <TripDatesContent key={`${authUser.id}:${authUser.participantId}:${tripId}`} identity={authUser.id} trip={tripId} timezone={authUser.timezone ?? 'Asia/Kuala_Lumpur'} />
}
function TripDatesContent({ identity, trip, timezone }: { identity: string; trip: string; timezone: string }) {
  const t = useT(), navigate = useNavigate(), location = useLocation(), today = useLocalCalendarDate(timezone)
  const back = (unavailable = false) => backFromTripDates(navigate, location.state, identity, trip, unavailable)
  const pageRef=useRef<HTMLElement>(null)
  useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const resize=()=>pageRef.current?.style.setProperty('--td-bottom-inset',Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop)+'px');resize();viewport.addEventListener('resize',resize);viewport.addEventListener('scroll',resize);return()=>{viewport.removeEventListener('resize',resize);viewport.removeEventListener('scroll',resize)}},[])
  const editor = useTripPeriodEditor(trip, () => back())
  const unavailable = editor.status === 'unavailable'
  const origin = readTripDatesOrigin(location.state, identity, trip)
  const prepared = !!origin && window.history.state?.idx === origin.index + 1 && (!unavailable || origin.unavailable)
  useLayoutEffect(() => { if (prepared) armTripDatesReturn(location.state) }, [prepared, location.state])
  useLayoutEffect(() => {
    if (editor.status === 'ready' || unavailable) prepareTripDatesBack(navigate, location.state, identity, trip, unavailable)
  }, [editor.status, unavailable, navigate, location.state, identity, trip])
  return <main ref={pageRef} className="td-page" data-testid="trip-dates-page" aria-busy={editor.saving || editor.status === 'loading'} onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); back(unavailable) } }}>
    <div className="td-page-body">
      <button type="button" className="td-back" onClick={() => back(unavailable)}><TravelIcon name="chevron-left" />{t(unavailable ? 'members.backTrips' : 'members.back')}</button>
      <header className="td-heading"><h1>{t('tripDates.title')}</h1>{editor.entry ? <p>{editor.entry.space.name}</p> : null}</header>
      {editor.status === 'loading' || editor.status === 'ready' && !prepared ? <p role="status">{t('common.loading')}</p> : editor.status === 'error' ? <section role="alert"><p>{t(editor.error || 'travel.unavailable')}</p><button type="button" className="td-link" onClick={() => void editor.loadLatest()}>{t('common.retry')}</button></section> : unavailable ? <section role="alert"><h2>{t('tripDates.unavailable')}</h2><p>{t('tripDates.noAccess')}</p></section> : <>
        <TripRangeCalendar key={editor.revision} value={editor.period} onChange={editor.updatePeriod} today={today} disabled={editor.saving || editor.uncertain} />
        {editor.error ? <div className="td-error" role="alert"><p>{t(editor.error)}</p>{editor.conflict ? <button type="button" className="td-link" disabled={editor.saving} onClick={() => void editor.loadLatest()}>{t('tripDates.loadLatest')}</button> : editor.uncertain ? <><button type="button" className="td-link" disabled={editor.saving} onClick={() => void editor.checkSave()}>{t('tripDates.check')}</button><button type="button" className="td-link" disabled={editor.saving} onClick={() => void editor.loadLatest()}>{t('tripDates.loadLatest')}</button></> : null}</div> : null}
        <footer className="td-save-bar"><button type="button" className="td-save" disabled={!editor.canSave || !prepared} onClick={() => void editor.save()}>{t(editor.saving ? 'common.saving' : 'travel.savePeriod')}</button></footer>
      </>}
    </div>
  </main>
}
