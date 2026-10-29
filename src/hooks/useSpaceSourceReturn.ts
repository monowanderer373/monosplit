import {readMembersOrigin} from '../lib/tripMembersNavigation'
import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { readSpaceReturn } from '../lib/spaceNavigation'
/** Runs after authoritative data/layout is ready; complements existing route-scroll hooks. */
export function useSpaceSourceReturn(ready: boolean, actor: string, trip='') {
  const location = useLocation(), restored = useRef('')
  useLayoutEffect(() => { restored.current = '' }, [location.key])
  useLayoutEffect(() => {
    if (!ready || !actor || restored.current === location.key) return
    let origin: {scroll:number;focus:string}|null = readSpaceReturn(location.state, actor, location.pathname + location.search)
    if(!origin&&trip){const member=readMembersOrigin({tripMembersOrigin:location.state?.membersReturn},actor,trip);if(member?.path===location.pathname+location.search&&['trip-members','trip-member-count','trip-menu'].includes(member.focus??''))origin={scroll:member.scroll??0,focus:member.focus!}}
    if (!origin) return
    const restoredOrigin=origin
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: restoredOrigin.scroll, behavior: 'instant' })
      if (restoredOrigin.focus) (document.querySelector<HTMLElement>('[data-space-focus="' + CSS.escape(restoredOrigin.focus) + '"]')??document.querySelector<HTMLElement>('.ttsa-tab[aria-selected=true]'))?.focus({ preventScroll: true })
      restored.current = location.key
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, actor, trip,location.key, location.pathname, location.search, location.state])
}
