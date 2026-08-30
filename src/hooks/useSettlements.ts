import { useCallback, useEffect, useState } from 'react'
import {
  settlementRepository,
  type ProposeSettlementInput,
  type SettlementPayment,
} from '../lib/settlementRepository'
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
    const channel = enabled && supabase
      ? supabase
        .channel('relational-settlements')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settlement_payments' }, () => void refresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settlement_allocations' }, () => void refresh())
        .subscribe()
      : null
    return () => {
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
    await settlementRepository.respondToAllocation(allocationId, response)
    await refresh()
  }, [refresh])

  const reverse = useCallback(async (allocationId: string) => {
    await settlementRepository.reverseAllocation(allocationId)
    await refresh()
  }, [refresh])

  return {
    settlements,
    loading,
    error,
    refresh,
    propose,
    respond,
    reverse,
  }
}
