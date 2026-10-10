import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { friendlyErrorKey, useT, type TranslationKey } from '../../lib/i18n'
import { spaceRepository, type SpaceWithRole } from '../../lib/spaceRepository'
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

export default function TripPeriodEditor({ spaceId, onSaved, onCancel }: {
  spaceId: string; onSaved: () => void; onCancel: () => void
}) {
  const t = useT(), { authUser } = useAuth()
  const identityKey = `${authUser?.id ?? ''}:${spaceId}`
  const [loadedFor, setLoadedFor] = useState('')
  const [entry, setEntry] = useState<SpaceWithRole | null>(null)
  const [period, setPeriod] = useState<TripPeriod>({ startDate: '', endDate: '', datesLater: false })
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [error, setError] = useState<TranslationKey | ''>('')
  const [retry, setRetry] = useState(0)
  const generation = useRef(0), busy = useRef(false)
  useEffect(() => {
    let active = true; const token = ++generation.current
    void spaceRepository.get(spaceId).then(result => {
      if (!active || token !== generation.current) return
      setLoadedFor(identityKey); setSaving(false)
      if (!result || result.space.type !== 'trip' || !['owner', 'full_access'].includes(result.role)) {
        setError('friendlyError.accessDenied'); setEntry(null)
      } else {
        setEntry(result); setPeriod({ startDate: result.space.startDate ?? '', endDate: result.space.endDate ?? '', datesLater: false }); setError('')
      }
    }).catch(cause => { if (active && token === generation.current) { setEntry(null); setError(friendlyErrorKey(cause)) } })
      .finally(() => { if (active && token === generation.current) { setLoadedFor(identityKey); setLoading(false); setSaving(false) } })
    return () => { active = false; generation.current = token + 1 }
  }, [spaceId, retry, identityKey])
  const save = async () => {
    if (!entry || loadedFor !== identityKey || !validTripPeriod(period) || busy.current) return
    const token = generation.current
    busy.current = true; setSaving(true); setError('')
    try {
      await spaceRepository.update({ spaceId: entry.space.id, name: entry.space.name,
        startDate: period.datesLater ? null : period.startDate, endDate: period.datesLater ? null : period.endDate,
        defaultCurrency: entry.space.defaultCurrency, expectedVersion: entry.space.version })
      if (token === generation.current) onSaved()
    } catch (cause) { if (token === generation.current) setError(friendlyErrorKey(cause)) }
    finally { busy.current = false; if (token === generation.current) setSaving(false) }
  }
  return <section className="trip-period-editor ms-card" aria-label={t('travel.editPeriod')} aria-busy={loading || loadedFor !== identityKey || saving} onKeyDown={event => { if (event.key === 'Escape' && !saving) { event.preventDefault(); onCancel() } }}>
    {loading || loadedFor !== identityKey ? <p role="status">{t('common.loading')}</p> : entry ? <TripPeriodFields value={period} onChange={setPeriod} disabled={saving}/> : null}
    {error ? <p className="trip-period-error" role="alert">{t(error)}</p> : null}
    <div className="trip-period-actions">
      <button type="button" className="ms-btn-ghost" disabled={saving} onClick={onCancel}>{t('common.cancel')}</button>
      {!loading && loadedFor === identityKey && entry ? <button type="button" className="ms-btn-primary" disabled={saving || !validTripPeriod(period)} onClick={() => void save()}>{t(saving ? 'common.saving' : 'travel.savePeriod')}</button> : null}
      {error ? <button type="button" className="ms-btn-ghost" disabled={saving} onClick={() => { setLoading(true); setEntry(null); setError(''); setRetry(n => n + 1) }}>{t('common.refresh')}</button> : null}
    </div>
  </section>
}
