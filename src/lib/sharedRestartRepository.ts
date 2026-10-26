import {supabase} from './supabase'
export async function sharedRestartRpc(name:'request_shared_split_retag'|'respond_shared_split_retag'|'dismiss_shared_restart_bill',args:Record<string,unknown>){
 if(!supabase)throw new Error('not_configured')
 const {data,error}=await supabase.rpc(name,args);if(error)throw error
 window.dispatchEvent(new Event('tt:shared-restart-changed'))
 return data
}
