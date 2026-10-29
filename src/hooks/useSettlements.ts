import { useCallback, useEffect, useRef, useState } from 'react'
import {
  settlementRepository,
  type ProposeSettlementInput,
  type SettlementPayment,
} from '../lib/settlementRepository'
import { generateId } from '../lib/id'
import { supabase } from '../lib/supabase'

export function useSettlements(enabled: boolean, identityKey = '') {
  const [settlements, setSettlements] = useState<SettlementPayment[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const [loadedKey,setLoadedKey]=useState<string|null>(null)
  const activeKey=useRef(identityKey),generation=useRef(0),alive=useRef(false)
  activeKey.current=identityKey

  const refresh = useCallback(async () => {
    const token=++generation.current, key=identityKey
    if (!enabled) {
      setSettlements([])
      setLoading(false)
      return
    }
    try {
      const rows=await settlementRepository.listSettlements()
      if(!alive.current||token!==generation.current||activeKey.current!==key)return
      setLoadedKey(key)
      setSettlements(rows)
      setError('')
    } catch (cause) {
      if(!alive.current||token!==generation.current||activeKey.current!==key)return
      setLoadedKey(key)
      setError(cause instanceof Error ? cause.message : 'Could not load settlements.')
    } finally {
      if(alive.current&&token===generation.current&&activeKey.current===key)setLoading(false)
    }
  }, [enabled, identityKey])

  useEffect(() => {
    alive.current=true
    void refresh()
    const sharedChanged=()=>void refresh()
    window.addEventListener('tt:shared-restart-changed',sharedChanged)
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleAuthoritativeRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => void refresh(), 80)
    }
    const channel = enabled && supabase
      ? supabase
        .channel(`relational-settlements:${Date.now()}:${Math.random()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settlement_payments' }, scheduleAuthoritativeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settlement_allocations' }, scheduleAuthoritativeRefresh)
        .subscribe()
      : null
    return () => {
      alive.current=false
      // Async request generation, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
      window.removeEventListener('tt:shared-restart-changed',sharedChanged)
      if (refreshTimer) clearTimeout(refreshTimer)
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [enabled, refresh])

  const propose = useCallback(async (input: ProposeSettlementInput) => {
    const id = await settlementRepository.proposeSettlement(input)
    await refresh()
    return id
  }, [refresh])

  const respond = useCallback(async (
    allocationId: string,
    response: 'accepted' | 'declined',
  ) => {
    const payment = settlements.find((candidate) => (
      candidate.allocations.some((allocation) => allocation.id === allocationId)
    ))
    if (!payment) throw new Error('settlement_not_found')
    await settlementRepository.respondToAllocation(
      allocationId,
      response,
      payment.version,
    )
    await refresh()
  }, [refresh, settlements])

  const reverse = useCallback(async (allocationId: string, requestId = generateId()) => {
    const payment = settlements.find((candidate) => (
      candidate.allocations.some((allocation) => allocation.id === allocationId)
    ))
    if (!payment) throw new Error('settlement_not_found')
    await settlementRepository.reverseAllocation(
      requestId,
      allocationId,
      payment.version,
    )
    await refresh()
  }, [refresh, settlements])

  const cancelPending = useCallback(async (allocationId: string) => {
    const payment = settlements.find((candidate) => (
      candidate.allocations.some((allocation) => allocation.id === allocationId)
    ))
    if (!payment) throw new Error('settlement_not_found')
    await settlementRepository.cancelPendingAllocation(allocationId, payment.version)
    await refresh()
  }, [refresh, settlements])

  return {
    settlements: loadedKey===identityKey?settlements:[],
    loading: enabled&&(loadedKey!==identityKey||loading),
    error: loadedKey===identityKey?error:'',
    refresh,
    propose,
    respond,
    reverse,
    cancelPending,
  }
}
