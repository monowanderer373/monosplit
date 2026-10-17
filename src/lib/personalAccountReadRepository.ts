import {
  addMinor,
  type HomeAccount,
  type HomeFunding,
  type HomeJournalEntry,
  type HomeJournalKind,
} from './homeView'
import { supabase } from './supabase'
import { loadCurrencyAccounts, loadMovementHistory } from './multicurrencyRepository'

export type PersonalAccountHomeSnapshot = {
  movementFees?: Array<{expenseId:string;movementId:string;accountId:string;amountMinor:number;currency:string;includedInExistingDebit:boolean}>
  accounts: HomeAccount[]
  funding: HomeFunding[]
  journals: HomeJournalEntry[]
  pendingFundingIds: string[]
  recurring: Array<{ id: string; status: string }>
  installments: Array<{ id: string; status: string }>
  pendingPrincipalPlanIds: string[]
}

const JOURNAL_KINDS = new Set<HomeJournalKind>([
  'income',
  'refund',
  'settlement_in',
  'settlement_out',
  'gift_in',
  'gift_out',
  'transfer',
  'liability_repayment',
  'reversal',
  'reconciliation',
  'expense_funding',
  'opening',
  'other',
])

const ACTIVITY_KINDS = [
  'income',
  'refund',
  'settlement_in',
  'settlement_out',
  'gift_in',
  'gift_out',
  'transfer',
  'liability_repayment',
  'reversal',
  'reconciliation',
] as const

const PAGE_SIZE = 1000

export function addStoredMinor(left: number, right: number): number {
  return addMinor(left, right)
}

export async function readAllPages<T>(
  readPage: (from: number, to: number) => Promise<readonly T[]>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const page = await readPage(from, from + pageSize - 1)
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

function minor(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(parsed)) throw new Error('amount_overflow')
  return parsed
}

function requiredMinor(value: number | string | null | undefined): number {
  const parsed = minor(value)
  if (parsed == null) throw new Error('amount_overflow')
  return parsed
}

export async function loadPersonalAccountHome(input: {
  includeAllActivity?: boolean
} = {}): Promise<PersonalAccountHomeSnapshot> {
  if (!supabase) throw new Error('not_configured')
  const client = supabase

  const accountsRead = loadCurrencyAccounts()
  const movementRead= loadMovementHistory()

  const fundingRead = readAllPages(async (from, to) => {
    const fundingResult = await client
      .from('personal_funding_intents')
      .select('id, expense_id, status, account_id, account_amount_minor, account_currency')
      .in('status', ['pending', 'posted', 'reversed'])
      .order('id')
      .range(from, to)
    if (fundingResult.error) throw fundingResult.error
    return fundingResult.data ?? []
  })
  const legsRead= readAllPages(async(from,to)=>{
    const result=await client.from('personal_funding_bundle_legs').select('id,funding_intent_id,account_id,amount_minor,currency').order('id').range(from,to)
    if(result.error)throw result.error
    return result.data??[]
  })
  const bundlesRead= readAllPages(async(from,to)=>{
    const result=await client.from('personal_funding_bundles').select('funding_intent_id,primary_account_id').order('funding_intent_id').range(from,to)
    if(result.error)throw result.error
    return result.data??[]
  })
  const readActivityPage = async (from: number, to: number) => {
    const transactionsResult = await client
      .from('personal_account_transactions')
      .select('id, kind, occurred_on, memo, expense_id, created_at')
      .in('kind', [...ACTIVITY_KINDS])
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (transactionsResult.error) throw transactionsResult.error
    return transactionsResult.data ?? []
  }
  // Entries depend only on transaction IDs, not on account/balance metadata.
  // Start this two-stage chain while all other independent reads are running.
  const activityRead = (async () => {
    const transactions = input.includeAllActivity
      ? await readAllPages(readActivityPage)
      : await readActivityPage(0, 39)
    const transactionIds = transactions.map(row => row.id as string)
    const journalEntries = []
    for (let index = 0; index < transactionIds.length; index += 100) {
      const chunk = transactionIds.slice(index, index + 100)
      journalEntries.push(...await readAllPages(async (from, to) => {
        const journalResult = await client
          .from('personal_account_entries')
          .select('transaction_id, account_id, amount_minor, currency')
          .in('transaction_id', chunk)
          .order('id')
          .range(from, to)
        if (journalResult.error) throw journalResult.error
        return journalResult.data ?? []
      }))
    }
    return { transactions, journalEntries }
  })()

  const recurringRead = readAllPages(async (from, to) => {
    const recurringResult = await client
      .from('personal_recurring_occurrences')
      .select('id, status')
      .in('status', ['failed', 'pending_review'])
      .order('id')
      .range(from, to)
    if (recurringResult.error) throw recurringResult.error
    return recurringResult.data ?? []
  })

  const installmentsRead = readAllPages(async (from, to) => {
    const installmentResult = await client
      .from('personal_installments')
      .select('id, status')
      .eq('status', 'failed')
      .order('id')
      .range(from, to)
    if (installmentResult.error) throw installmentResult.error
    return installmentResult.data ?? []
  })

  const plansRead = readAllPages(async (from, to) => {
    const plansResult = await client
      .from('personal_installment_plans')
      .select('id')
      .eq('status', 'pending_principal')
      .order('id')
      .range(from, to)
    if (plansResult.error) throw plansResult.error
    return plansResult.data ?? []
  })

  // Return one complete financial snapshot; errors still reject the entire
  // account slice rather than showing partial balances as verified.
  const [accounts, movementHistory, fundingRows, legRows, bundleRows, activity,
    recurringRows, installmentRows, planRows] = await Promise.all([
    accountsRead, movementRead, fundingRead, legsRead, bundlesRead, activityRead,
    recurringRead, installmentsRead, plansRead,
  ])
  const funding: HomeFunding[] = fundingRows.map((row) => ({
    expenseId: row.expense_id as string,
    status: row.status as HomeFunding['status'],
    accountId: row.status==='pending'?(bundleRows.find(b=>b.funding_intent_id===row.id)?.primary_account_id??row.account_id):row.account_id,
    accountAmountMinor: minor(row.account_amount_minor as number | string | null),
    accountCurrency: row.account_currency ? String(row.account_currency).toUpperCase() : null,
    legs:legRows.filter(leg=>leg.funding_intent_id===row.id).map(leg=>({accountId:leg.account_id,amountMinor:requiredMinor(leg.amount_minor),currency:leg.currency})),
  }))

  const { transactions, journalEntries } = activity
  const journals: HomeJournalEntry[] = []
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]))
  for (const entry of journalEntries) {
    const transaction = transactions.find((row) => row.id === entry.transaction_id)
    if (!transaction) continue
    const kind = JOURNAL_KINDS.has(transaction.kind as HomeJournalKind)
      ? transaction.kind as HomeJournalKind
      : 'other'
    journals.push({
      movementId:movementHistory.movements.find(m=>m.transfer_transaction_id===transaction.id)?.id,
      id: transaction.id as string,
      kind,
      occurredOn: transaction.occurred_on as string,
      createdAt: transaction.created_at as string,
      amountMinor: requiredMinor(entry.amount_minor as number | string),
      currency: String(entry.currency).toUpperCase(),
      accountId: entry.account_id as string,
      accountName: accountNames.get(entry.account_id as string) ?? '',
      expenseId: (transaction.expense_id as string | null) ?? null,
      memo: (transaction.memo as string | null) ?? null,
    })
  }

  return {
    movementFees:movementHistory.fees.map(fee=>({expenseId:fee.expense_id,movementId:fee.movement_id,accountId:fee.account_id,
      amountMinor:requiredMinor(fee.amount_minor),currency:fee.currency,includedInExistingDebit:fee.transaction_id==null})),
    accounts,
    funding,
    journals,
    pendingFundingIds: fundingRows
      .filter((row) => row.status === 'pending')
      .map((row) => row.id as string),
    recurring: recurringRows.map((row) => ({
      id: row.id as string,
      status: row.status as string,
    })),
    installments: installmentRows.map((row) => ({
      id: row.id as string,
      status: row.status as string,
    })),
    pendingPrincipalPlanIds: planRows.map((row) => row.id as string),
  }
}
