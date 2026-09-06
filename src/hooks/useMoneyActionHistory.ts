import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { MoneyContextRef } from '../lib/moneyContext'

export type MoneyActionState =
  | Readonly<{ step: 'resolve-space'; spaceId: string; startedAtMs: number }>
  | Readonly<{
    step: 'resolve-context'
    context: MoneyContextRef
    startedAtMs: number
    mode: 'entry' | 'switch'
  }>
  | Readonly<{ step: 'gate'; excludedSpaceId?: string; startedAtMs: number }>
  | Readonly<{ step: 'switch-picker'; startedAtMs: number }>
  | Readonly<{
    step: 'capture'
    context: MoneyContextRef
    startedAtMs: number
    directDeepLink?: boolean
  }>

type RouteState = {
  moneyAction?: MoneyActionState
  routeOverlay?: string
}

function routeState(value: unknown): RouteState {
  return value != null && typeof value === 'object' ? value as RouteState : {}
}

export function useMoneyActionHistory() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = routeState(location.state)
  const currentUrl = `${location.pathname}${location.search}${location.hash}`

  const push = useCallback((moneyAction: MoneyActionState) => {
    navigate(currentUrl, {
      state: { ...routeState(location.state), moneyAction },
    })
  }, [currentUrl, location.state, navigate])

  const replace = useCallback((moneyAction: MoneyActionState) => {
    navigate(currentUrl, {
      replace: true,
      state: { ...routeState(location.state), moneyAction },
    })
  }, [currentUrl, location.state, navigate])

  const close = useCallback(() => {
    if (state.moneyAction?.step === 'capture' && state.moneyAction.directDeepLink) {
      navigate('/', { replace: true })
      return
    }
    navigate(-1)
  }, [navigate, state.moneyAction])

  const collapseSwitchToCapture = useCallback((
    captureAction: Extract<MoneyActionState, { step: 'capture' }>,
  ) => {
    const handlePopState = () => {
      navigate(currentUrl, {
        state: { moneyAction: captureAction },
      })
    }
    window.addEventListener('popstate', handlePopState, { once: true })
    window.history.go(-2)
  }, [currentUrl, navigate])

  return {
    action: state.moneyAction ?? null,
    push,
    replace,
    close,
    collapseSwitchToCapture,
  }
}

export function useRouteBackedOverlay<T>(overlayKey: string) {
  const location = useLocation()
  const navigate = useNavigate()
  const [payload, setPayload] = useState<T | null>(null)
  const state = routeState(location.state)
  const currentUrl = `${location.pathname}${location.search}${location.hash}`
  const active = state.routeOverlay === overlayKey ? payload : null

  const open = useCallback((nextPayload: T) => {
    setPayload(nextPayload)
    navigate(currentUrl, {
      state: { ...routeState(location.state), routeOverlay: overlayKey },
    })
  }, [currentUrl, location.state, navigate, overlayKey])

  const close = useCallback(() => {
    if (routeState(location.state).routeOverlay === overlayKey) {
      navigate(-1)
    } else {
      setPayload(null)
    }
  }, [location.state, navigate, overlayKey])

  return { value: active, open, close }
}
