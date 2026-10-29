import { formatTripRange } from '../../lib/tripCalendar'
import { useT } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import './trip-dates.css'
export default function TripDateEntry({ trip, canEdit, onOpen }: { trip: { id: string; startDate: string | null; endDate: string | null }; canEdit: boolean; onOpen: () => void }) {
  const t = useT(), lang = useStore(s => s.lang), range = formatTripRange(trip.startDate, trip.endDate, lang)
  const content = <><svg className="tt-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18"/></svg><span>{range || t(canEdit ? 'travel.setPeriod' : 'travel.datesNotSet')}</span>{canEdit ? <span aria-hidden="true">›</span> : null}</>
  return canEdit ? <button type="button" className="td-entry" data-trip-date-trigger={trip.id} aria-label={range ? t('travel.editPeriod') + ': ' + range : t('travel.setPeriod')} onClick={onOpen}>{content}</button> : <span className="td-entry td-entry-static">{content}</span>
}
