import { useCallback, useEffect, useRef, useState } from 'react'
import {
  expenseChangeRepository,
  type DirectExpenseChangeRequest,
} from '../lib/expenseChangeRepository'
import { supabase } from '../lib/supabase'

export function useExpenseChanges(
  enabled: boolean,
  refreshFinancialState?: () => Promise<unknown>,
  identityKey = '',
) {
  const generation = useRef(0)
  const invalidateRead = useCallback(() => { generation.current += 1 }, [])
  const [requests, setRequests] = useState<DirectExpenseChangeRequest[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const refreshFinancialStateRef = useRef(refreshFinancialState)
  refreshFinancialStateRef.current = refreshFinancialState

  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current
    if (!enabled) {
      setRequests([])
      setError('')
      setLoading(false)
      return
    }
    try {
      const next = await expenseChangeRepository.listDirectChanges()
      if (requestGeneration !== generation.current) return
      setRequests(next)
      setError('')
    } catch (cause) {
      if (requestGeneration !== generation.current) return
      setError(cause instanceof Error ? cause.message : 'expense_changes_unavailable')
    } finally {
      if (requestGeneration === generation.current) setLoading(false)
    }
  }, [enabled])

  const refreshAuthoritative = useCallback(async () => {
    await Promise.all([
      refresh(),
      refreshFinancialStateRef.current?.(),
    ])
  }, [refresh])

  useEffect(() => {
    setRequests([])
    setLoading(enabled)
    void refresh()
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void refreshAuthoritative(), 80)
    }
    const channel = enabled && supabase
      ? supabase
        .channel(`expense-changes:${Date.now()}:${Math.random()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'direct_expense_change_requests',
        }, scheduleRefresh)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'direct_expense_change_approvals',
        }, scheduleRefresh)
        .subscribe()
      : null
    return () => {
      invalidateRead()
      if (timer) clearTimeout(timer)
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [enabled, refresh, refreshAuthoritative, identityKey, invalidateRead])

  return {
    requests,
    loading,
    error,
    refresh,
    refreshAuthoritative,
  }
}
