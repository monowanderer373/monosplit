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
    ownedRows<BalanceAnchor>('personal_account_balance_anchors','id,account_id,anchor_sequence,observed_at,observed_balance_minor,pending_intent_ids,captured_entry_ids'),
  ])
  return {bundles,anchors}
}
export type MoneyMovement = {
  id:string;version:number;kind:string;source_account_id:string;destination_account_id:string
  source_total_minor:number|string;destination_net_minor:number|string;source_currency:string;destination_currency:string
  occurred_on:string;memo:string|null;reversed_operation_id:string|null;transfer_transaction_id:string
}
export type MovementFee = {id:string;movement_id:string;mode:string;account_id:string;amount_minor:number|string;currency:string;expense_id:string;transaction_id:string|null}
export async function loadMovementHistory(){
 const [movements,fees]=await Promise.all([
  ownedRows<MoneyMovement>('personal_money_movements','id,version,kind,source_account_id,destination_account_id,source_total_minor,destination_net_minor,source_currency,destination_currency,occurred_on,memo,reversed_operation_id,transfer_transaction_id'),
  ownedRows<MovementFee>('personal_money_movement_fees','id,movement_id,mode,account_id,amount_minor,currency,expense_id,transaction_id'),
 ])
 return {movements,fees}
}
