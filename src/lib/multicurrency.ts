import type { HomeAccount, HomeAccountType } from './homeView'
import { currencyExponent, parseMajorAmount } from './money'
import { addFraction, estimateMinor, fraction, roundFraction, type FxSnapshot } from './fx'

export type CurrencyAccount = HomeAccount & {
  parentAccountId: string
  version: number
  parentVersion: number
  displayOrder: number
  isDefault: boolean
  openingBalanceAsOf: string | null
}
export type FundingLeg = {
  account_id: string; version: number; parent_version: number; amount_minor: number
  anchor_id: string | null; included_in_anchor: boolean | null
}
export type FundingPlan = {
  mode: 'deferred' | 'actual'; primary_account_id: string | null
  legs: FundingLeg[]; covers_owner_payment: boolean
}
export type BalanceAnchor = {
  id: string; account_id: string; anchor_sequence: number | string
  observed_at: string; pending_intent_ids: string[]; captured_entry_ids: string[]
  observed_balance_minor?: number|string
}
export type FundingBundle = { funding_intent_id: string; primary_account_id: string | null; confirmed_operation_id: string | null }
export type SourceDraft = { key: string; accountId: string; amount: string; coverage: '' | 'included' | 'excluded'; coverageAnchorId?:string|null }
const accountTypes = new Set(['cash', 'bank', 'ewallet', 'credit_card', 'paylater', 'loan'])
function safeInteger(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('invalid_account_snapshot')
  const n = Number(value)
  if (!Number.isSafeInteger(n)) throw new Error('amount_overflow')
  return n
}
function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('invalid_account_snapshot')
  return value
}
/** No legacy fallback: a missing capability must never turn a real debit into an estimate. */
export function parseCurrencyAccounts(input: unknown): CurrencyAccount[] {
  const raw = input as {schema_version?: unknown; accounts?: unknown[]}|null
  if (raw?.schema_version !== 1 || !Array.isArray(raw.accounts)) throw new Error('multicurrency_unavailable')
  const accounts = raw.accounts.map(value => {
    const r = value as Record<string, unknown>
    if (!r || !accountTypes.has(String(r.account_type)) || !['asset', 'liability'].includes(String(r.account_class))
      || !['unknown', 'posted'].includes(String(r.opening_status))) throw new Error('invalid_account_snapshot')
    const currency = requiredString(r.currency)
    currencyExponent(currency)
    const account: CurrencyAccount = {
      id: requiredString(r.id), parentAccountId: requiredString(r.parent_account_id), name: requiredString(r.name),
      accountType: r.account_type as HomeAccountType, accountClass: r.account_class as 'asset'|'liability',
      currency, archived: r.archived_at != null, openingStatus: r.opening_status as 'unknown'|'posted',
      entrySumMinor: safeInteger(r.entry_sum_minor), attentionRevision: String(r.entry_count),
      version: safeInteger(r.version), parentVersion: safeInteger(r.parent_version),
      displayOrder: safeInteger(r.display_order), isDefault: r.is_default === true,
      openingBalanceAsOf: typeof r.opening_balance_as_of === 'string' ? r.opening_balance_as_of : null,
    }
    if (account.version < 1 || account.parentVersion < 1) throw new Error('invalid_account_snapshot')
    return account
  })
  const ids = new Set(accounts.map(a => a.id))
  if (ids.size !== accounts.length || accounts.some(a => !ids.has(a.parentAccountId))) throw new Error('invalid_account_snapshot')
  return accounts
}
export function currencyGroups(accounts: readonly CurrencyAccount[]) {
  return accounts.filter(a => a.id === a.parentAccountId).map(parent => ({
    parent, units: accounts.filter(a => a.parentAccountId === parent.id).sort((a,b) => a.displayOrder-b.displayOrder || a.id.localeCompare(b.id)),
  }))
}
export function latestAnchor(anchors: readonly BalanceAnchor[], accountId: string) {
  return anchors.filter(a => a.account_id === accountId).reduce<BalanceAnchor|null>((latest,a) =>
    !latest || BigInt(a.anchor_sequence) > BigInt(latest.anchor_sequence) ? a : latest, null)
}
export function parseObservedBalance(input:string,currency:string) {
  const text=input.trim().replaceAll(',',''),negative=text.startsWith('-'),unsigned=negative?text.slice(1):text
  if(!/^\d+(?:\.\d*)?$/.test(unsigned)||(unsigned.split('.')[1]?.length??0)>currencyExponent(currency))throw new Error('invalid_amount')
  if(/^0+(?:\.0*)?$/.test(unsigned))return 0
  return parseMajorAmount(unsigned,currency)*(negative?-1:1)
}
export function compileFundingSources(drafts: readonly SourceDraft[], accounts: readonly CurrencyAccount[], anchors: readonly BalanceAnchor[]): FundingLeg[] {
  if (!drafts.length || drafts.length > 20 || new Set(drafts.map(d => d.accountId)).size !== drafts.length) throw new Error('invalid_funding_bundle')
  return drafts.map(d => {
    const a = accounts.find(a => a.id === d.accountId && !a.archived)
    if (!a) throw new Error('personal_account_archived')
    const amount = parseMajorAmount(d.amount,a.currency), anchor = latestAnchor(anchors,a.id)
    if (amount <= 0 || anchor && (!d.coverage||d.coverageAnchorId!==anchor.id)) throw new Error('funding_coverage_required')
    return {account_id:a.id,version:a.version,parent_version:a.parentVersion,amount_minor:amount,
      anchor_id:anchor?.id??null,included_in_anchor:anchor ? d.coverage === 'included' : null}
  })
}
/** Display only. Unknown balances and unavailable rates are excluded and explicitly counted. */
export function accountValuation(accounts: readonly CurrencyAccount[], snapshot: FxSnapshot,includeArchived=false) {
  let total = fraction(0n), known = 0, unknown = 0, missingRates = 0
  for (const a of accounts) {
    if (a.archived&&!includeArchived) continue
    if (a.openingStatus !== 'posted') { unknown++; continue }
    if (a.currency === 'MYR') total = addFraction(total,fraction(BigInt(a.entrySumMinor)))
    else {
      const rate = snapshot.rates[a.currency]
      if (!rate) { missingRates++; continue }
      total = addFraction(total,estimateMinor(BigInt(a.entrySumMinor),currencyExponent(a.currency),rate))
    }
    known++
  }
  return { minor:known ? roundFraction(total) : null, unknown, missingRates, partial:unknown+missingRates>0 }
}
export function validateMovementAmounts(sourceMinor:number,destinationMinor:number,sourceCurrency:string,destinationCurrency:string,fee:{mode:string;amount_minor:number}|null){
  if(!Number.isSafeInteger(sourceMinor)||sourceMinor<=0||!Number.isSafeInteger(destinationMinor)||destinationMinor<=0)throw new Error('invalid_amount')
  if(fee&&(!Number.isSafeInteger(fee.amount_minor)||fee.amount_minor<=0
    ||fee.mode==='included_source'&&fee.amount_minor>=sourceMinor
    ||fee.mode==='included_destination'&&fee.amount_minor>=destinationMinor))throw new Error('invalid_fee')
  if(sourceCurrency===destinationCurrency){
    const included=fee&&fee.mode!=='separate'?BigInt(fee.amount_minor):0n
    if(BigInt(sourceMinor)!==BigInt(destinationMinor)+included)throw new Error('movement_same_currency_mismatch')
  }
}
