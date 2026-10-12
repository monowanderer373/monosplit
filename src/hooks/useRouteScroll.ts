import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

const positions = new Map<string, number>()
/** Restore only this route entry and authenticated identity, after its data renders. */
export function useRouteScroll(ready: boolean, identity: string) {
  const location = useLocation()
  const key = `${identity}:${location.key}`
  const fallback = typeof location.state?.restoreScroll === 'number' && Number.isFinite(location.state.restoreScroll) ? Math.max(0, location.state.restoreScroll) : 0
  useLayoutEffect(() => {
    if (!ready || !identity) return
    const frame = requestAnimationFrame(() => window.scrollTo({ top: positions.get(key) ?? fallback, behavior: 'instant' }))
    const record = () => { positions.set(key, window.scrollY); if (positions.size > 80) positions.delete(positions.keys().next().value!) }
    window.addEventListener('scroll', record, { passive: true })
    return () => { cancelAnimationFrame(frame); record(); window.removeEventListener('scroll', record) }
  }, [key, ready, identity, fallback])
}
