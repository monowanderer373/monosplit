import { useT } from '../../lib/i18n'
import { validTripPeriod, type TripPeriod } from '../../lib/tripPeriod'
import './trip-period.css'

export function TripPeriodFields({ value, onChange, disabled = false }: {
  value: TripPeriod; onChange: (value: TripPeriod) => void; disabled?: boolean
}) {
  const t = useT()
  return <fieldset className="trip-period-fields" disabled={disabled}>
    <legend>{t('travel.period')}</legend>
    <div className="trip-period-dates">
      <label>{t('travel.startDate')}<input className="ms-input" type="date" min="0001-01-01" max="9999-12-31" required={!value.datesLater} disabled={value.datesLater}
        value={value.startDate} onChange={event => onChange({ ...value, startDate: event.target.value })}/></label>
      <label>{t('travel.endDate')}<input className="ms-input" type="date" min={value.startDate || '0001-01-01'} max="9999-12-31" required={!value.datesLater} disabled={value.datesLater}
        value={value.endDate} onChange={event => onChange({ ...value, endDate: event.target.value })}/></label>
    </div>
    <label className="trip-period-later"><input type="checkbox" checked={value.datesLater} onChange={event => onChange({ ...value, datesLater: event.target.checked })}/>{t('travel.datesLater')}</label>
    {!value.datesLater && (value.startDate || value.endDate) && !validTripPeriod(value)
      ? <p className="trip-period-error" role="alert">{t('travel.invalidPeriod')}</p> : null}
    <p className="trip-period-help">{t('travel.periodHelp')}</p>
  </fieldset>
}
