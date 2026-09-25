import { generateId } from './id'
import { supabase } from './supabase'

export type CashAccountType = 'cash' | 'bank' | 'ewallet'

export type CreatePersonalAccountInput = {
  name: string
  accountType: CashAccountType
  currency: string
  openingBalanceMinor: number | null
  balanceAsOf: string | null
  requestId?: string
}

export async function createPersonalAccount(
  input: CreatePersonalAccountInput,
): Promise<{ accountId: string }> {
  if (!supabase) throw new Error('not_configured')
  const requestId = input.requestId ?? generateId()
  const { data, error } = await supabase.rpc('create_personal_account', {
    request_id: requestId,
    account_name: input.name,
    account_type: input.accountType,
    currency_code: input.currency,
    opening_balance_minor: input.openingBalanceMinor,
    balance_as_of: input.balanceAsOf,
    make_default: false,
  })
  const accountId = data && typeof data === 'object'
    ? (data as { account_id?: unknown }).account_id
    : null
  if (error || typeof accountId !== 'string') {
    throw error ?? new Error('create_personal_account_failed')
  }
  return { accountId }
}
