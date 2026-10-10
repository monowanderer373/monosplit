import { useCallback, useSyncExternalStore } from 'react'
import { localCalendarDate } from '../lib/homeView'

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000)
  window.addEventListener('focus', onChange)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('focus', onChange)
    document.removeEventListener('visibilitychange', onChange)
  }
}
/** Recomputes calendar-dependent state across midnight and after background suspension. */
export function useLocalCalendarDate(timezone: string) {
  const snapshot = useCallback(() => localCalendarDate(new Date(), timezone), [timezone])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
