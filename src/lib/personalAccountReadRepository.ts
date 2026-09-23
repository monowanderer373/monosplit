import {
  addMinor,
  type HomeAccount,
  type HomeAccountType,
  type HomeFunding,
  type HomeJournalEntry,
  type HomeJournalKind,
} from './homeView'
import { supabase } from './supabase'

export type PersonalAccountHomeSnapshot = {
  accounts: HomeAccount[]
  funding: HomeFunding[]
  journals: HomeJournalEntry[]
  pendingFundingIds: string[]
  recurring: Array<{ id: string; status: string }>
  installments: Array<{ id: string; status: string }>
  pendingPrincipalPlanIds: string[]
}

const ACCOUNT_TYPES = new Set<HomeAccountType>([
  'cash',
  'bank',
  'ewallet',
  'credit_card',
  'paylater',
  'loan',
])

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

  const accountsResult = await client
    .from('personal_accounts')
    .select('id, name, account_class, account_type, currency, archived_at, opening_status')
  if (accountsResult.error) throw accountsResult.error

  const accountRows = accountsResult.data ?? []
  const accountIds = accountRows.map((row) => row.id as string)
  const sums = new Map<string, number>()
  if (accountIds.length > 0) {
    const entryRows = await readAllPages(async (from, to) => {
      const entriesResult = await client
        .from('personal_account_entries')
        .select('account_id, amount_minor')
        .in('account_id', accountIds)
        .order('id')
        .range(from, to)
      if (entriesResult.error) throw entriesResult.error
      return entriesResult.data ?? []
    })
    for (const entry of entryRows) {
      const accountId = entry.account_id as string
      sums.set(
        accountId,
        addStoredMinor(sums.get(accountId) ?? 0, requiredMinor(entry.amount_minor as number | string)),
      )
    }
  }

  const accounts: HomeAccount[] = accountRows.flatMap((row) => {
    const accountType = row.account_type as string
    const accountClass = row.account_class as string
    if (!ACCOUNT_TYPES.has(accountType as HomeAccountType)) return []
    if (accountClass !== 'asset' && accountClass !== 'liability') return []
    return [{
      id: row.id as string,
      name: row.name as string,
      accountClass,
      accountType: accountType as HomeAccountType,
      currency: String(row.currency).toUpperCase(),
      archived: row.archived_at != null,
      openingStatus: row.opening_status === 'posted' ? 'posted' as const : 'unknown' as const,
      entrySumMinor: sums.get(row.id as string) ?? 0,
    }]
  })

  const fundingRows = await readAllPages(async (from, to) => {
    const fundingResult = await client
      .from('personal_funding_intents')
      .select('id, expense_id, status, account_id, account_amount_minor, account_currency')
      .in('status', ['pending', 'posted', 'reversed'])
      .order('id')
      .range(from, to)
    if (fundingResult.error) throw fundingResult.error
    return fundingResult.data ?? []
  })
  const funding: HomeFunding[] = fundingRows.map((row) => ({
    expenseId: row.expense_id as string,
    status: row.status as HomeFunding['status'],
    accountId: (row.account_id as string | null) ?? null,
    accountAmountMinor: minor(row.account_amount_minor as number | string | null),
    accountCurrency: row.account_currency ? String(row.account_currency).toUpperCase() : null,
  }))

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
  const transactions = input.includeAllActivity
    ? await readAllPages(readActivityPage)
    : await readActivityPage(0, 39)
  const transactionIds = transactions.map((row) => row.id as string)
  const journals: HomeJournalEntry[] = []
  if (transactionIds.length > 0) {
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
    const accountNames = new Map(accounts.map((account) => [account.id, account.name]))
    for (const entry of journalEntries) {
      const transaction = transactions.find((row) => row.id === entry.transaction_id)
      if (!transaction) continue
      const kind = JOURNAL_KINDS.has(transaction.kind as HomeJournalKind)
        ? transaction.kind as HomeJournalKind
        : 'other'
      journals.push({
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
  }

  const recurringRows = await readAllPages(async (from, to) => {
    const recurringResult = await client
      .from('personal_recurring_occurrences')
      .select('id, status')
      .in('status', ['failed', 'pending_review'])
      .order('id')
      .range(from, to)
    if (recurringResult.error) throw recurringResult.error
    return recurringResult.data ?? []
  })

  const installmentRows = await readAllPages(async (from, to) => {
    const installmentResult = await client
      .from('personal_installments')
      .select('id, status')
      .eq('status', 'failed')
      .order('id')
      .range(from, to)
    if (installmentResult.error) throw installmentResult.error
    return installmentResult.data ?? []
  })

  const planRows = await readAllPages(async (from, to) => {
    const plansResult = await client
      .from('personal_installment_plans')
      .select('id')
      .eq('status', 'pending_principal')
      .order('id')
      .range(from, to)
    if (plansResult.error) throw plansResult.error
    return plansResult.data ?? []
  })

  return {
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
