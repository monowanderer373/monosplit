import {supabase} from './supabase'
export type TripFriendState = {participantId:string;state:'available'|'sent'|'incoming'|'friend'|'unavailable';requestId:string|null;version:number|null}
export type TripFriendRequest = {id:string;sender_id:string;target_id:string;source_name:string;sender_name:string;target_name:string;status:string;version:number;expires_at:string}
const pendingCommands=new Map<string,string>()
export const friendRequestsChanged=()=>window.dispatchEvent(new Event('tt:friend-requests-changed'))
function client(){if(!supabase)throw new Error('not_configured');return supabase}
export const tripFriendRequests={
 async states(trip:string):Promise<TripFriendState[]>{const{data,error}=await client().rpc('get_trip_friend_states',{source_trip_id:trip});if(error)throw error;return data},
 async list():Promise<TripFriendRequest[]>{const{data,error}=await client().from('trip_friend_requests').select('id,sender_id,target_id,source_name,sender_name,target_name,status,version,expires_at').eq('status','pending').gt('expires_at',new Date().toISOString());if(error)throw error;return data??[]},
 async send(identity:string,trip:string,participant:string){
  const key='tt:trip-friend-command:'+identity+':'+trip+':'+participant
  let id=pendingCommands.get(key)
  try{id??=localStorage.getItem(key)??undefined}catch{/* Memory still prevents duplicate dispatch in this session. */}
  id??=crypto.randomUUID();pendingCommands.set(key,id)
  try{localStorage.setItem(key,id)}catch{/* A request retry uses the in-memory key. */}
  const{data,error}=await client().rpc('send_trip_friend_request',{command_id:id,source_trip_id:trip,target_participant_id:participant})
  if(error)throw error
  // Keep the command until authoritative state was observed, including after an unknown response.
  return data as string
 },
 clearCommand(identity:string,trip:string,participant:string){const key='tt:trip-friend-command:'+identity+':'+trip+':'+participant;pendingCommands.delete(key);try{localStorage.removeItem(key)}catch{/* Best effort local cleanup. */}},
 async respond(id:string,response:'accepted'|'declined'|'cancelled',version:number){const{error}=await client().rpc('respond_trip_friend_request',{target_request_id:id,response,expected_version:version});if(error)throw error},
}
