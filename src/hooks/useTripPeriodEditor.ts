import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { spaceRepository, type SpaceWithRole } from '../lib/spaceRepository'
import { friendlyErrorKey, type TranslationKey } from '../lib/i18n'
import { periodFromDates, persistedPeriod, sameTripPeriod } from '../lib/tripCalendar'
import { validTripPeriod, type TripPeriod } from '../lib/tripPeriod'
import { notifyTripDatesChanged } from '../lib/tripDatesEvents'
import { supabase } from '../lib/supabase'

type Model = { key: string; status: 'loading' | 'ready' | 'error' | 'unavailable'; entry: SpaceWithRole | null; period: TripPeriod; error: TranslationKey | ''; conflict: boolean; uncertain: boolean; revision: number }
type Pending = { entry: SpaceWithRole; period: TripPeriod }
const editable = (entry: SpaceWithRole | null): entry is SpaceWithRole => !!entry && entry.space.type === 'trip' && entry.space.status !== 'voided' && ['owner', 'full_access'].includes(entry.role)
const initialPeriod = { startDate: '', endDate: '', datesLater: true }
// A transport/proxy failure can occur after PostgreSQL committed. Only a definite
// database rejection permits retrying the reviewed command without readback.
function definiteRejection(cause: unknown) {
  const code = (cause as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) && !/^(08|57P)/.test(code)
}
export function useTripPeriodEditor(spaceId: string, onSaved: () => void) {
  const { authUser } = useAuth()
  const identity = authUser?.id ?? '', participant = authUser?.participantId ?? '', key = `${identity}:${participant}:${spaceId}`
  const [model, setModel] = useState<Model>({ key: '', status: 'loading', entry: null, period: initialPeriod, error: '', conflict: false, uncertain: false, revision: 0 })
  const [saving, setSaving] = useState(false)
  const generation = useRef(0), alive = useRef(false), busy = useRef(false), pending = useRef<Pending | null>(null)
  const modelRef = useRef(model)
  modelRef.current = model
  const current = useCallback((token: number) => alive.current && generation.current === token, [])
  const loadLatest = useCallback(async () => {
    const token = ++generation.current
    busy.current = false; pending.current = null; setSaving(false)
    setModel(old => ({ ...old, key, status: 'loading', error: '', conflict: false, uncertain: false }))
    try {
      const entry = identity ? await spaceRepository.get(spaceId) : null
      if (!current(token)) return
      if (!editable(entry) || entry.space.id !== spaceId) {
        setModel(old => ({ ...old, key, entry: null, status: 'unavailable', error: 'tripDates.noAccess' })); return
      }
      setModel(old => ({ key, entry, period: periodFromDates(entry.space.startDate, entry.space.endDate), status: 'ready', error: '', conflict: false, uncertain: false, revision: old.revision + 1 }))
    } catch (cause) {
      if (current(token)) setModel(old => ({ ...old, key, status: 'error', error: friendlyErrorKey(cause) }))
    }
  }, [key, identity, spaceId, current])

  useEffect(() => {
    alive.current = true; let active = true
    queueMicrotask(() => { if (active && alive.current) void loadLatest() })
    return () => { active = false; alive.current = false;
      // This is an async request counter, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++; busy.current = false }
  }, [loadLatest])

  const verify = useCallback(async () => {
    const before = modelRef.current, token = generation.current
    if (busy.current || before.key !== key || before.status !== 'ready' || before.uncertain) return
    try {
      const fresh = await spaceRepository.get(spaceId)
      if (!current(token) || busy.current) return
      if (!editable(fresh)) setModel(old => ({ ...old, status: 'unavailable', error: 'tripDates.noAccess' }))
      else if (fresh.space.version !== before.entry?.space.version) setModel(old => ({ ...old, conflict: true, error: 'tripDates.conflict' }))
    } catch (cause) { if (current(token) && !busy.current) setModel(old => ({ ...old, error: friendlyErrorKey(cause) })) }
  }, [key, spaceId, current])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void verify(), 80) }
    const visible = () => { if (document.visibilityState === 'visible') schedule() }
    window.addEventListener('focus', schedule); window.addEventListener('online', schedule); document.addEventListener('visibilitychange', visible)
    const channel = supabase && identity ? supabase.channel('trip-dates:' + key)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'spaces', filter: 'id=eq.' + spaceId }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_members', filter: 'space_id=eq.' + spaceId }, schedule).subscribe() : null
    return () => { if (timer) clearTimeout(timer); window.removeEventListener('focus', schedule); window.removeEventListener('online', schedule); document.removeEventListener('visibilitychange', visible); if (channel && supabase) void supabase.removeChannel(channel) }
  }, [key, identity, spaceId, verify])

  const finish = (token: number) => {
    // Invalidate only this actor/Trip after a genuine commit, even if its editor was left.
    notifyTripDatesChanged(identity, participant, spaceId)
    if (current(token)) onSaved()
  }
  const reconcile = async (command: Pending, token: number) => {
    const fresh = await spaceRepository.get(spaceId)
    if (!current(token)) return
    if (!editable(fresh)) { setModel(old => ({ ...old, status: 'unavailable', error: 'tripDates.noAccess' })); return }
    const desired = persistedPeriod(command.period)
    if (fresh.space.version > command.entry.space.version && fresh.space.startDate === desired.startDate && fresh.space.endDate === desired.endDate && fresh.space.name === command.entry.space.name && fresh.space.defaultCurrency === command.entry.space.defaultCurrency) {
      pending.current = null; finish(token); return
    }
    if (fresh.space.version !== command.entry.space.version) setModel(old => ({ ...old, conflict: true, uncertain: false, error: 'tripDates.conflict' }))
    else setModel(old => ({ ...old, uncertain: true, error: 'tripDates.uncertain' }))
  }
  const save = async () => {
    const snapshot = modelRef.current
    if (busy.current || snapshot.key !== key || snapshot.status !== 'ready' || !snapshot.entry || snapshot.conflict || snapshot.uncertain || !validTripPeriod(snapshot.period) || sameTripPeriod(snapshot.period, periodFromDates(snapshot.entry.space.startDate, snapshot.entry.space.endDate))) return
    busy.current = true; setSaving(true); setModel(old => ({ ...old, error: '' }))
    const token = generation.current, command = { entry: snapshot.entry, period: { ...snapshot.period } }
    let issued = false
    try {
      const fresh = await spaceRepository.get(spaceId)
      if (!current(token)) return
      if (!editable(fresh)) { setModel(old => ({ ...old, status: 'unavailable', error: 'tripDates.noAccess' })); return }
      if (fresh.space.version !== command.entry.space.version || fresh.space.name !== command.entry.space.name || fresh.space.defaultCurrency !== command.entry.space.defaultCurrency) {
        setModel(old => ({ ...old, conflict: true, error: 'tripDates.conflict' })); return
      }
      issued = true; pending.current = command
      await spaceRepository.update({ spaceId, name: command.entry.space.name, defaultCurrency: command.entry.space.defaultCurrency, expectedVersion: command.entry.space.version, ...persistedPeriod(command.period) })
      if (current(token)) pending.current = null
      finish(token)
    } catch (cause) {
      if (!current(token)) return
      const error = friendlyErrorKey(cause)
      if (error === 'friendlyError.versionConflict') setModel(old => ({ ...old, conflict: true, error: 'tripDates.conflict' }))
      else if (error === 'friendlyError.accessDenied' || error === 'friendlyError.notAuthenticated') setModel(old => ({ ...old, status: 'unavailable', error }))
      else if (issued && !definiteRejection(cause)) {
        setModel(old => ({ ...old, uncertain: true, error: 'tripDates.uncertain' }))
        try { await reconcile(command, token) } catch { /* Unknown outcomes remain blocked until an authoritative read. */ }
      } else setModel(old => ({ ...old, error }))
    } finally { if (current(token)) { busy.current = false; setSaving(false) } }
  }
  const checkSave = async () => {
    if (busy.current || !pending.current) return
    busy.current = true; setSaving(true); const token = generation.current
    try { await reconcile(pending.current, token) } catch { if (current(token)) setModel(old => ({ ...old, error: 'tripDates.uncertain' })) }
    finally { if (current(token)) { busy.current = false; setSaving(false) } }
  }
  const ready = model.key === key && model.status === 'ready'
  return { ...model, status: model.key === key ? model.status : 'loading' as const, entry: ready ? model.entry : null, saving,
    dirty: ready && !!model.entry && !sameTripPeriod(model.period, periodFromDates(model.entry.space.startDate, model.entry.space.endDate)),
    canSave: ready && !saving && !model.conflict && !model.uncertain && validTripPeriod(model.period) && !!model.entry && !sameTripPeriod(model.period, periodFromDates(model.entry.space.startDate, model.entry.space.endDate)),
    updatePeriod: (period: TripPeriod) => { if (!busy.current) setModel(old => ({ ...old, period, error: old.conflict ? 'tripDates.conflict' : old.uncertain ? 'tripDates.uncertain' : '' })) },
    save, loadLatest, checkSave }
}
