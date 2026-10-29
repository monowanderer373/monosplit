import {supabase} from '../../lib/supabase'
import { useEffect, useRef, useState } from 'react'
import {invalidateHomeSpaces} from '../../hooks/useHomeData'
import { useAuth } from '../../hooks/useAuth'
import { spaceRepository } from '../../lib/spaceRepository'
import { friendlyErrorKey, useT, type TranslationKey } from '../../lib/i18n'
import { validTripPeriod, type TripPeriod } from '../../lib/tripPeriod'
import { TripPeriodFields } from '../travel/TripPeriodEditor'
import type { SpaceType } from '../../types'

const pendingCreates=new Set<string>()

/** Same create_space service and date/currency rules; no list or alternate ledger. */
export default function SpaceCreateForm({ type, onCreated, onCancel }: { type: SpaceType; onCreated: (id: string) => void; onCancel: () => void }) {
  const t = useT(), { authUser } = useAuth(), alive = useRef(false), busy = useRef(false)
  const [name, setName] = useState(''), [currency, setCurrency] = useState(authUser?.defaultCurrency ?? 'MYR')
  const [period, setPeriod] = useState<TripPeriod>({ startDate: '', endDate: '', datesLater: false })
  const operationKey=(authUser?.id??'')+':'+type
  const [creating, setCreating] = useState(false), [uncertain, setUncertain] = useState(pendingCreates.has(operationKey)), [error, setError] = useState<TranslationKey | ''>(pendingCreates.has(operationKey)?'spaceNav.createUnknown':'')
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const periodValid = type !== 'trip' || validTripPeriod(period)
  const create = async () => {
    if (!authUser?.participantId || authUser.isAnonymous || !name.trim() || !periodValid || busy.current || uncertain) return
    if(pendingCreates.has(operationKey)){setUncertain(true);setError('spaceNav.createUnknown');return}
    pendingCreates.add(operationKey);busy.current = true; setCreating(true); setError('')
    const input = { type, name: name.trim(), defaultCurrency: currency, startDate: type === 'trip' && !period.datesLater ? period.startDate : null, endDate: type === 'trip' && !period.datesLater ? period.endDate : null }
    let before: Set<string> | null = null
    const finish = async (id: string) => { const session=await supabase?.auth.getSession();if (session?.data.session?.user.id===authUser.id) { invalidateHomeSpaces(authUser.participantId!); window.dispatchEvent(new CustomEvent('tt:spaces-changed',{detail:{identity:authUser.id,participantId:authUser.participantId}})); if(alive.current)onCreated(id) } }
    try {
      // create_space has no request UUID. Capture a baseline so an unknown response
      // is reconciled, never blindly retried as a second Space.
      before = new Set((await spaceRepository.list()).map(e => e.space.id))
      if (!alive.current) return
      await finish(await spaceRepository.create(input))
    } catch (cause) {
      if (!alive.current) return
      const code = (cause as { code?: unknown } | null)?.code
      const definite = typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) && !/^(08|57P)/.test(code)
      if (before && !definite) {
        try {
          const candidates = (await spaceRepository.list()).filter(e => !before!.has(e.space.id) && e.role === 'owner' && e.space.ownerParticipantId === authUser.participantId && e.space.type === type && e.space.name === input.name && e.space.defaultCurrency === currency && e.space.startDate === input.startDate && e.space.endDate === input.endDate)
          if (candidates.length === 1) { await finish(candidates[0].space.id); return }
        } catch { /* Unknown remains unknown, not permission or successful creation. */ }
        if (alive.current) { setUncertain(true); setError('spaceNav.createUnknown') }
      } else setError(friendlyErrorKey(cause))
    } finally { pendingCreates.delete(operationKey);if (alive.current) setCreating(false); busy.current = false }
  }
  return <section className="ttsa-paper" aria-label={t(type === 'trip' ? 'sharedA.addTrip' : 'sharedA.addGroup')} style={{ padding: 16, marginTop: 16 }}>
    <label className="ttsa-field">{t('spaces.name')}<input value={name} disabled={creating || uncertain} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void create() }} placeholder={t(type === 'trip' ? 'spaces.tripPlaceholder' : 'spaces.groupPlaceholder')} /></label>
    <label className="ttsa-field">{t('spaces.currency')}<input className="uppercase" maxLength={3} value={currency} disabled={creating || uncertain} onChange={e => setCurrency(e.target.value.toUpperCase())} /></label>
    {type === 'trip' ? <div className="mt-4"><TripPeriodFields value={period} onChange={setPeriod} disabled={creating || uncertain} /></div> : null}
    {error ? <p className="ttsa-meta" role="alert">{t(error)}</p> : null}
    <div className="ttsa-actions"><button type="button" className="ttsa-action" disabled={creating || uncertain || !name.trim() || !periodValid} onClick={() => void create()}><span className="ttsa-action-face">{t(creating ? 'common.creating' : 'spaces.create')}</span></button><button type="button" className="ttsa-action" disabled={creating} onClick={onCancel}><span className="ttsa-action-face">{t('common.cancel')}</span></button></div>
  </section>
}
