import { useCallback, useEffect, useRef, useState } from 'react'
import {
  expenseChangeRepository,
  type DirectExpenseChangeRequest,
} from '../lib/expenseChangeRepository'
import { supabase } from '../lib/supabase'

export function useExpenseChanges(
  enabled: boolean,
  refreshFinancialState?: () => Promise<unknown>,
) {
  const [requests, setRequests] = useState<DirectExpenseChangeRequest[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')
  const refreshFinancialStateRef = useRef(refreshFinancialState)
  refreshFinancialStateRef.current = refreshFinancialState

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRequests([])
      setLoading(false)
      return
    }
    try {
      setRequests(await expenseChangeRepository.listDirectChanges())
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'expense_changes_unavailable')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  const refreshAuthoritative = useCallback(async () => {
    await Promise.all([
      refresh(),
      refreshFinancialStateRef.current?.(),
    ])
  }, [refresh])

  useEffect(() => {
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
      if (timer) clearTimeout(timer)
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [enabled, refresh, refreshAuthoritative])

  return {
    requests,
    loading,
    error,
    refresh,
    refreshAuthoritative,
  }
}
