import { useCallback, useEffect, useState } from 'react'
import {
  settlementRepository,
  type ProposeSettlementInput,
  type SettlementPayment,
} from '../lib/settlementRepository'
import { generateId } from '../lib/id'
import { supabase } from '../lib/supabase'

export function useSettlements(enabled: boolean) {
  const [settlements, setSettlements] = useState<SettlementPayment[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSettlements([])
      setLoading(false)
      return
    }
    try {
      setSettlements(await settlementRepository.listSettlements())
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load settlements.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
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

  const reverse = useCallback(async (allocationId: string) => {
    const payment = settlements.find((candidate) => (
      candidate.allocations.some((allocation) => allocation.id === allocationId)
    ))
    if (!payment) throw new Error('settlement_not_found')
    await settlementRepository.reverseAllocation(
      generateId(),
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
    settlements,
    loading,
    error,
    refresh,
    propose,
    respond,
    reverse,
    cancelPending,
  }
}
