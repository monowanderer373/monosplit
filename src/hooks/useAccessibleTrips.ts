import {useCallback,useEffect,useRef,useState} from 'react'
import {spaceRepository,type SpaceWithRole} from '../lib/spaceRepository'
import {accessibleWorkspaceTrips} from '../lib/tripWorkspace'
import {supabase} from '../lib/supabase'
export function useAccessibleTrips(identity:string,self:string) {
  const key=identity+':'+self,alive=useRef(false),generation=useRef(0)
  const [result,setResult]=useState<{key:string;status:'loading'|'ready'|'error';data:SpaceWithRole[]}>({key:'',status:'loading',data:[]})
  const refresh=useCallback(async()=>{const request=++generation.current;if(!identity||!self)return
    try{const data=accessibleWorkspaceTrips(await spaceRepository.list());if(alive.current&&request===generation.current)setResult({key,status:'ready',data})}
    catch{if(alive.current&&request===generation.current)setResult({key,status:'error',data:[]})}
  },[identity,self,key])
  useEffect(()=>{alive.current=true;queueMicrotask(()=>{if(alive.current)void refresh()});let timer:ReturnType<typeof setTimeout>|undefined
    const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void refresh(),80)},visible=()=>{if(document.visibilityState==='visible')schedule()}
    const events=['focus','online','tt:spaces-changed','tt:space-members-changed','tt:trip-dates-changed'];events.forEach(e=>window.addEventListener(e,schedule));document.addEventListener('visibilitychange',visible)
    const channel=identity&&self&&supabase?supabase.channel('workspace-trips:'+key).on('postgres_changes',{event:'*',schema:'public',table:'space_members',filter:'participant_id=eq.'+self},schedule).on('postgres_changes',{event:'UPDATE',schema:'public',table:'spaces'},schedule).subscribe():null
    return()=>{alive.current=false;
      // Request generation, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;if(timer)clearTimeout(timer);events.forEach(e=>window.removeEventListener(e,schedule));document.removeEventListener('visibilitychange',visible);if(channel&&supabase)void supabase.removeChannel(channel)}
  },[identity,self,key,refresh])
  return {...(result.key===key?result:{key,status:'loading' as const,data:[]}),refresh}
}
