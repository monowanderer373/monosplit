import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { getCurrencySymbol } from '../lib/currency'
import { formatMoney, formatDateRange } from '../lib/format'
import { getSettlements } from '../lib/settlement'
import type { Group } from '../types'

function formatDateLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export default function EmbedPage() {
  const { groupId } = useParams()
  const [group, setGroup] = useState<Group | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch group from Supabase
  useEffect(() => {
    if (!groupId || !supabase || !supabaseEnabled) {
      setError('Supabase not configured or missing group ID.')
      return
    }

    let cancelled = false

    const fetchGroup = async () => {
      const { data, error: fetchErr } = await supabase!
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle()

      if (cancelled) return
      if (fetchErr) {
        setError(fetchErr.message)
        return
      }
      if (data?.data) {
        setGroup(data.data as unknown as Group)
      } else {
        setError('Group not found.')
      }
    }

    void fetchGroup()

    // Subscribe to Realtime
    const channel = supabase!
      .channel(`embed-${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
        (payload) => {
          const incoming = payload.new as { data: unknown } | undefined
          if (incoming?.data) {
            setGroup(incoming.data as unknown as Group)
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase!.removeChannel(channel)
    }
  }, [groupId])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return <EmbedContent group={group} groupId={groupId!} />
}

function EmbedContent({ group, groupId }: { group: Group; groupId: string }) {
  const personName = (id: string) => group.people.find((p) => p.id === id)?.name ?? 'Unknown'

  // Expense summary grouped by day
  const groupedDays = useMemo(() => {
    const map = new Map<string, typeof group.expenses>()
    for (const e of group.expenses) {
      const key = e.date || 'No date'
      const arr = map.get(key) || []
      arr.push(e)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [group.expenses])

  // Settlement summary
  const settlements = useMemo(() => getSettlements(group.expenses), [group.expenses])

  // Grand total per currency
  const grandTotals = useMemo(() => {
    const map: Record<string, number> = {}
    group.expenses.forEach((e) => {
      map[e.paidCurrency] = (map[e.paidCurrency] || 0) + e.amount
    })
    return Object.entries(map)
  }, [group.expenses])

  return (
    <div className="min-h-screen bg-white p-4 font-sans text-gray-800" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="mb-4 border-b border-gray-200 pb-3">
        <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
        <p className="text-xs text-gray-500">{formatDateRange(group.startDate, group.endDate)}</p>
        <p className="text-xs text-gray-500">
          {group.people.length} people · {group.expenses.length} expenses
        </p>
        {grandTotals.length > 0 && (
          <div className="mt-1 flex gap-3">
            {grandTotals.map(([cur, total]) => (
              <span key={cur} className="text-sm font-semibold text-gray-800">
                {getCurrencySymbol(cur)}{formatMoney(total)} {cur}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expense Summary */}
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-600">Expense Summary</h2>
      {groupedDays.length === 0 ? (
        <p className="text-xs text-gray-400">No expenses yet.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {groupedDays.map(([date, expenses]) => {
            const dayTotal: Record<string, number> = {}
            expenses.forEach((e) => {
              dayTotal[e.paidCurrency] = (dayTotal[e.paidCurrency] || 0) + e.amount
            })
            return (
              <div key={date} className="rounded border border-gray-200">
                <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5">
                  <span className="text-xs font-semibold text-gray-700">
                    {date === 'No date' ? date : formatDateLabel(date)} ({expenses.length})
                  </span>
                  <span className="text-xs font-bold text-gray-800">
                    {Object.entries(dayTotal)
                      .map(([cur, total]) => `${getCurrencySymbol(cur)}${formatMoney(total)}`)
                      .join(' / ')}
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {expenses
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((e) => (
                      <div key={e.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <div>
                          <span className="font-medium text-gray-800">{e.description}</span>
                          <span className="ml-2 text-gray-400">by {(e.payerIds ?? []).map((pid) => personName(pid)).join(', ') || 'Unknown'}</span>
                        </div>
                        <span className="font-semibold text-gray-700">
                          {getCurrencySymbol(e.paidCurrency)}{formatMoney(e.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Settlement Summary */}
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-600">Settlement Summary</h2>
      {settlements.length === 0 ? (
        <p className="text-xs text-gray-400">No outstanding balances.</p>
      ) : (
        <div className="space-y-1">
          {settlements.map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
              <div>
                <span className="font-semibold text-red-600">{personName(s.debtorId)}</span>
                <span className="mx-1 text-gray-400">owes</span>
                <span className="font-semibold text-green-700">{personName(s.creditorId)}</span>
              </div>
              <span className="font-bold text-gray-800">
                {getCurrencySymbol(s.currency)}{formatMoney(s.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
        Powered by{' '}
        <a
          href={`${window.location.origin}/group/${groupId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-gray-600 underline"
        >
          MonoSplit
        </a>
      </div>
    </div>
  )
}
