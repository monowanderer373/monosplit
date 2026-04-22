import type { Expense, Settlement, SettlementPayment } from '../types'
import { createSettlementSnapshot } from './settlementLedger'

export function getSettlements(expenses: Expense[], settlementPayments: SettlementPayment[] = []): Settlement[] {
  return createSettlementSnapshot({ expenses, settlementPayments }).settlements
}
