import { useEffect, useState } from 'react'
import { spaceRepository } from '../lib/spaceRepository'

export type TravelMembers = Awaited<ReturnType<typeof spaceRepository.listMembers>>
/** Key every result by identity and trip; late responses cannot cross either boundary. */
export function useTravelMembers(participantId: string | null, tripId: string | null, refreshKey: string) {
  const key = `${participantId ?? ''}:${tripId ?? ''}`
  const [result, setResult] = useState<{ key: string; status: 'ready' | 'error'; data: TravelMembers } | null>(null)
  useEffect(() => {
    if (!participantId || !tripId || tripId.startsWith('affiliation:')) return
    let cancelled = false
    void spaceRepository.listMembers(tripId).then(data => {
      if (!cancelled) setResult({ key, status: 'ready', data })
    }).catch(() => { if (!cancelled) setResult({ key, status: 'error', data: [] }) })
    return () => { cancelled = true }
  }, [key, participantId, tripId, refreshKey])
  if (tripId?.startsWith('affiliation:')) return { status: 'ready' as const, data: [] }
  return result?.key === key ? result : { status: 'loading' as const, data: [] }
}
