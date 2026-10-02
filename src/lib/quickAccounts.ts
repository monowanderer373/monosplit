import { supabase } from './supabase'
export type QuickAccount = { id: string; name: string; currency: string; account_type: 'cash'|'bank'|'ewallet'; is_default: boolean }
export async function loadQuickAccounts(): Promise<QuickAccount[]> {
 if(!supabase) throw new Error('not_configured')
 const {data,error}=await supabase.from('personal_accounts').select('id,name,currency,account_type,is_default').is('archived_at',null).in('account_type',['cash','bank','ewallet']).order('is_default',{ascending:false}).order('name')
 if(error) throw error
 return data || []
}
