import { useEffect, useState } from 'react'
import { spaceRepository } from '../lib/spaceRepository'
import {sortTripMembers} from '../lib/tripMembers'
import {supabase} from '../lib/supabase'
export type TravelMembers = Awaited<ReturnType<typeof spaceRepository.listMembers>>
/** Identity/Trip keyed snapshots; membership changes invalidate both page and preview. */
export function useTravelMembers(participantId: string | null, tripId: string | null, refreshKey: string) {
  const key = `${participantId ?? ''}:${tripId ?? ''}`
  const [result, setResult] = useState<{ key: string; status: 'ready' | 'error' | 'loading'; data: TravelMembers } | null>(null)
  useEffect(() => {
    if (!participantId || !tripId || tripId.startsWith('affiliation:')) return
    let cancelled = false, generation = 0, timer:ReturnType<typeof setTimeout>|undefined
    const load = async()=>{
      const request=++generation
      setResult({key,status:'loading',data:[]})
      try{
        const data=await spaceRepository.listMembers(tripId)
        if(cancelled||request!==generation)return
        const active=sortTripMembers(data,participantId)
        setResult(active.some(row=>row.participant.id===participantId)?{key,status:'ready',data:active}:{key,status:'error',data:[]})
      }catch{if(!cancelled&&request===generation)setResult({key,status:'error',data:[]})}
    }
    const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void load(),80)}
    const changed=(event:Event)=>{if((event as CustomEvent).detail?.spaceId===tripId)schedule()}
    const visible=()=>{if(document.visibilityState==='visible')schedule()}
    queueMicrotask(()=>{if(!cancelled)void load()});window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',visible);window.addEventListener('tt:space-members-changed',changed)
    const channel=supabase?supabase.channel('travel-members:'+participantId+':'+tripId).on('postgres_changes',{event:'*',schema:'public',table:'space_members',filter:'space_id=eq.'+tripId},schedule).subscribe():null
    return () => {cancelled=true;generation++;if(timer)clearTimeout(timer);window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',visible);window.removeEventListener('tt:space-members-changed',changed);if(channel&&supabase)void supabase.removeChannel(channel)}
  }, [key, participantId, tripId, refreshKey])
  if (tripId?.startsWith('affiliation:')) return { status: 'ready' as const, data: [] }
  return result?.key === key ? result : { status: 'loading' as const, data: [] }
}
