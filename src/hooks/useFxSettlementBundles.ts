import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { FxBundle } from '../lib/pairSettlement'
export function useFxSettlementBundles(self:string,trip:string|undefined,enabled:boolean,refreshKey:unknown){
  const key=self+':'+trip
  const [read,setRead]=useState<{key:string;rows:FxBundle[];status:'loading'|'ready'|'error'}|null>(null)
  const [retry,setRetry]=useState(0)
  useEffect(()=>{
    if(!enabled||!trip||!supabase)return
    let active=true
    queueMicrotask(()=>{if(active)setRead(old=>({key,rows:old?.key===key?old.rows:[],status:'loading'}))})
    void supabase.from('settlement_fx_bundles').select('id,version,status,payer_participant_id,counterparty_participant_id,cash_minor,full_net_minor,target_currency,rate_mode,created_at,quote').eq('space_id',trip).then(({data,error})=>{if(active)setRead({key,rows:((data??[])as FxBundle[]).filter(b=>b.payer_participant_id===self||b.counterparty_participant_id===self),status:error?'error':'ready'})},()=>{if(active)setRead(old=>({key,rows:old?.key===key?old.rows:[],status:'error'}))})
    return()=>{active=false}
  },[self,trip,enabled,key,refreshKey,retry])
  return {rows:enabled&&read?.key===key?read.rows:[],status:!enabled?'ready' as const:read?.key===key?read.status:'loading' as const,retry:()=>setRetry(n=>n+1)}
}
