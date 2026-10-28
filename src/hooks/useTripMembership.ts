import {useCallback,useEffect,useRef,useState} from 'react'
import {readTripMembership,validTripId} from '../lib/tripMembers'
import {supabase} from '../lib/supabase'
import {friendlyErrorKey,type TranslationKey} from '../lib/i18n'
type Snapshot = Awaited<ReturnType<typeof readTripMembership>>
type Result = {key:string;status:'ready'|'loading'|'error'|'unavailable';data:Snapshot;error:TranslationKey|''}
export function useTripMembership(identity:string,self:string,trip:string) {
  const key=identity+':'+self+':'+trip, generation=useRef(0),alive=useRef(false)
  const [result,setResult]=useState<Result>({key:'',status:'loading',data:null,error:''})
  const refresh=useCallback(async()=>{
    const token=++generation.current
    if(!identity||!self||!validTripId(trip)){if(alive.current)setResult({key,status:'unavailable',data:null,error:''});return null}
    setResult({key,status:'loading',data:null,error:''})
    try{
      const data=await readTripMembership(trip,self)
      if(alive.current&&token===generation.current)setResult({key,status:data?'ready':'unavailable',data,error:''})
      return data
    }catch(cause){
      const error=cause instanceof Error&&cause.message==='empty_membership_snapshot'?'members.empty':friendlyErrorKey(cause)
      if(alive.current&&token===generation.current)setResult({key,status:error==='friendlyError.accessDenied'||error==='friendlyError.notAuthenticated'?'unavailable':'error',data:null,error})
      return null
    }
  },[identity,self,trip,key])
  useEffect(()=>{
    alive.current=true;queueMicrotask(()=>{if(alive.current)void refresh()})
    let timer:ReturnType<typeof setTimeout>|undefined
    const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void refresh(),80)}
    const visible=()=>{if(document.visibilityState==='visible')schedule()}
    const changed=(event:Event)=>{if((event as CustomEvent).detail?.spaceId===trip)schedule()}
    window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',visible);window.addEventListener('tt:space-members-changed',changed)
    const channel=identity&&validTripId(trip)&&supabase?supabase.channel('trip-members:'+identity+':'+trip).on('postgres_changes',{event:'*',schema:'public',table:'space_members',filter:'space_id=eq.'+trip},schedule).on('postgres_changes',{event:'UPDATE',schema:'public',table:'spaces',filter:'id=eq.'+trip},schedule).subscribe():null
    return()=>{alive.current=false;
      // This is a request generation counter, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;if(timer)clearTimeout(timer);window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',visible);window.removeEventListener('tt:space-members-changed',changed);if(channel&&supabase)void supabase.removeChannel(channel)}
  },[identity,trip,refresh])
  return {...(result.key===key?result:{key,status:'loading' as const,data:null,error:'' as const}),refresh}
}
