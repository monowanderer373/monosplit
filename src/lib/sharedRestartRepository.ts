import {supabase} from './supabase'
export async function sharedRestartRpc(name:'request_shared_split_retag'|'respond_shared_split_retag'|'dismiss_shared_restart_bill',args:Record<string,unknown>,identity:string){
 if(!supabase)throw new Error('not_configured')
 const {data:auth,error:authError}=await supabase.auth.getSession()
 if(authError||!auth.session||auth.session.user.id!==identity)throw new Error('identity_changed')
 const {data,error}=await supabase.rpc(name,args).setHeader('Authorization',`Bearer ${auth.session.access_token}`)
 if(error)throw error
 window.dispatchEvent(new Event('tt:shared-restart-changed'))
 return data
}
