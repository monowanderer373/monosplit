import { loadCurrencyAccounts } from './multicurrencyRepository'
import type { CurrencyAccount } from './multicurrency'
export type QuickAccount = CurrencyAccount & { account_type: 'cash'|'bank'|'ewallet'; is_default:boolean }
export async function loadQuickAccounts(): Promise<QuickAccount[]> {
 const accounts=await loadCurrencyAccounts()
 return accounts.filter(a=>!a.archived&&['cash','bank','ewallet'].includes(a.accountType)).map(a=>({...a,account_type:a.accountType as QuickAccount['account_type'],is_default:a.isDefault}))
}
