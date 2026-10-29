import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { readSpaceReturn } from '../lib/spaceNavigation'
/** Runs after authoritative data/layout is ready; complements existing route-scroll hooks. */
export function useSpaceSourceReturn(ready: boolean, actor: string) {
  const location = useLocation(), restored = useRef('')
  useLayoutEffect(() => { restored.current = '' }, [location.key])
  useLayoutEffect(() => {
    if (!ready || !actor || restored.current === location.key) return
    const origin = readSpaceReturn(location.state, actor, location.pathname + location.search)
    if (!origin) return
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: origin.scroll, behavior: 'instant' })
      if (origin.focus) (document.querySelector<HTMLElement>('[data-space-focus="' + CSS.escape(origin.focus) + '"]')??document.querySelector<HTMLElement>('.ttsa-tab[aria-selected=true]'))?.focus({ preventScroll: true })
      restored.current = location.key
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, actor, location.key, location.pathname, location.search, location.state])
}
