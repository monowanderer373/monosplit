import { friendlyErrorKey, machineCode, type TranslationKey } from './i18n'

export function collectPayErrorKey(error: unknown): TranslationKey {
  const code = machineCode(error)
  if (code === 'balance_changed' || code === 'version_conflict') return 'cp.changed'
  if (code === 'settlement_cash_account_invalid') return 'cp.accountError'
  if (code === 'payer_cash_authorization_required') return 'cp.payerRequired'
  if (code.includes('cash_amount_mismatch') || code.includes('cash_currency_mismatch') || code === 'gift_cash_must_match_settlement_currency') return 'cp.currencyError'
  if (code.startsWith('overpay_')) return 'cp.overpayError'
  if (code === 'permission_denied' || code === 'account_creditor_required') return 'cp.unsupported'
  if (code === 'invalid_payment_date') return 'cp.dateError'
  if (code === 'invalid_amount' || code === 'invalid_minor_amount' || code === 'invalid_decimal_places' || code === 'amount_overflow') return 'cp.amountError'
  if (code === 'request_exceeds_outstanding_balance') return 'friendlyError.balanceExceeded'
  return friendlyErrorKey(error)
}
