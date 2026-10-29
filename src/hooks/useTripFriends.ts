import {useCallback,useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {tripFriendRequests,friendRequestsChanged,type TripFriendState,type TripFriendRequest} from '../lib/tripFriendRequests'
/** A single identity-scoped request set backs Review; Members additionally reads private pair states. */
export function useTripFriends(identity:string,trip=''){
 const key=identity+':'+trip,generation=useRef(0),lock=useRef(false),alive=useRef(false)
 const currentKey=useRef(key);currentKey.current=key
 const [result,setResult]=useState<{key:string;states:TripFriendState[];requests:TripFriendRequest[];error:boolean;ready:boolean}>({key:'',states:[],requests:[],error:false,ready:false})
 const [busy,setBusy]=useState('')
 const refresh=useCallback(async()=>{
  const token=++generation.current
  if(!identity)return
  try{
   const[requests,states]=await Promise.all([tripFriendRequests.list(),trip?tripFriendRequests.states(trip):Promise.resolve([])])
   if(alive.current&&token===generation.current){for(const state of states)if(['sent','incoming','friend'].includes(state.state))tripFriendRequests.clearCommand(identity,trip,state.participantId);setResult({key,requests,states,error:false,ready:true})}
  }catch{if(alive.current&&token===generation.current)setResult({key,requests:[],states:[],error:true,ready:false})}
 },[identity,trip,key])
 useEffect(()=>{
  alive.current=true;queueMicrotask(()=>{if(alive.current)void refresh()})
  const changed=()=>void refresh(),visible=()=>{if(document.visibilityState==='visible')changed()}
  window.addEventListener('focus',changed);window.addEventListener('tt:friend-requests-changed',changed);document.addEventListener('visibilitychange',visible)
  const channel=identity&&supabase?supabase.channel('trip-friends:'+key).on('postgres_changes',{schema:'public',table:'trip_friend_requests',event:'*'},changed).on('postgres_changes',{schema:'public',table:'friendships',event:'*'},changed).subscribe():null
  return()=>{alive.current=false;generation.current+=1;window.removeEventListener('focus',changed);window.removeEventListener('tt:friend-requests-changed',changed);document.removeEventListener('visibilitychange',visible);if(channel&&supabase)void supabase.removeChannel(channel)}
 },[identity,key,refresh])
 const perform=async(id:string,action:()=>Promise<unknown>)=>{
  if(lock.current||!identity)return
  lock.current=true;setBusy(id)
  try{
   const auth=await supabase?.auth.getUser();if(!alive.current||currentKey.current!==key||auth?.data.user?.id!==identity)return
   await action();if(alive.current&&currentKey.current===key){friendRequestsChanged();await refresh()}
  }catch{if(alive.current){await refresh();setResult(r=>({...r,key,error:true}))}}
  finally{lock.current=false;if(alive.current)setBusy('')}
 }
 return {...(result.key===key?result:{key,requests:[],states:[],error:false,ready:false}),busy,refresh,
  send:(id:string)=>perform(id,async()=>{
   const states=await tripFriendRequests.states(trip),state=states.find(s=>s.participantId===id)
   if(!alive.current||currentKey.current!==key||!state||state.state!=='available')return
   await tripFriendRequests.send(identity,trip,id)
   tripFriendRequests.clearCommand(identity,trip,id)
  }),
  respond:(request:Pick<TripFriendRequest,'id'|'version'>,response:'accepted'|'declined'|'cancelled')=>perform(request.id,()=>tripFriendRequests.respond(request.id,response,request.version)),
 }
}
