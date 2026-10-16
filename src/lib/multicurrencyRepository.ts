import { supabase } from './supabase'
import { parseCurrencyAccounts, type BalanceAnchor, type FundingBundle } from './multicurrency'

export async function loadCurrencyAccounts() {
  if (!supabase) throw new Error('not_configured')
  const {data,error} = await supabase.rpc('get_personal_multicurrency_accounts')
  if (error) throw error
  return parseCurrencyAccounts(data)
}
async function ownedRows<T>(table:string,columns:string):Promise<T[]> {
  if (!supabase) throw new Error('not_configured')
  const rows:T[]=[]
  for(let from=0;;from+=1000){
    const {data,error}=await supabase.from(table).select(columns).order('id').range(from,from+999)
    if(error)throw error
    rows.push(...(data??[]) as unknown as T[])
    if((data?.length??0)<1000)return rows
  }
}
export async function loadFundingMetadata() {
  const [bundles,anchors]=await Promise.all([
    // This table's primary key is funding_intent_id, not id.
    (async()=>{
      if(!supabase)throw new Error('not_configured')
      const rows:FundingBundle[]=[]
      for(let from=0;;from+=1000){
        const {data,error}=await supabase.from('personal_funding_bundles').select('funding_intent_id,primary_account_id,confirmed_operation_id').order('funding_intent_id').range(from,from+999)
        if(error)throw error
        rows.push(...(data??[]))
        if((data?.length??0)<1000)return rows
      }
    })(),
    ownedRows<BalanceAnchor>('personal_account_balance_anchors','id,account_id,anchor_sequence,observed_at,pending_intent_ids,captured_entry_ids'),
  ])
  return {bundles,anchors}
}
