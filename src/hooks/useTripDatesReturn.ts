import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { pendingTripDatesReturn, readTripDatesOrigin } from '../lib/tripDatesNavigation'
export function useTripDatesReturn(ready: boolean, identity: string, trip: string) {
  const location = useLocation(), restored = useRef('')
  useLayoutEffect(() => {
    if (!ready || !identity || restored.current === location.key) return
    const origin = readTripDatesOrigin(location.state, identity, trip, true)
    if (!origin || origin.path !== location.pathname + location.search || !pendingTripDatesReturn(location.state)) return
    const frame = requestAnimationFrame(() => {
      const trigger = document.querySelector<HTMLButtonElement>(`[data-trip-date-trigger="${CSS.escape(trip)}"]`)
      if (trigger && pendingTripDatesReturn(location.state, true)) { trigger.focus({ preventScroll: true }); restored.current = location.key }
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, identity, trip, location.key, location.pathname, location.search, location.state])
}
