import type { CanonicalExpense } from '../types'
import type { SettlementPayment } from './settlementRepository'
import { deriveRelationalDebtLines, type RelationalDebtLine } from './relationalBalance'
import {visibleSharedExpense} from './sharedRestart'

/** Authorized Trip records, including bills where the viewer paid/consumed nothing. */
export function tripVisibleExpenses(expenses: readonly CanonicalExpense[], spaceId: string) {
  return expenses.filter(e => e.scope === 'space' && e.spaceId === spaceId && e.status === 'active' && visibleSharedExpense(e))
    .sort((a,b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
}

/** Same exclusion used by SettlementPanel; only display aggregation is new. */
export function tripCurrentPayments(payments: readonly SettlementPayment[], spaceId: string) {
  return payments.filter(p => p.scope === 'space' && p.spaceId === spaceId)
    .map(p => ({ ...p, allocations: p.allocations.filter(a => !a.sharedRestartCleared) }))
    .filter(p => p.allocations.length > 0)
}
/** The outbox's pending: rows are local recovery previews, never server debt facts. */
export function tripAuthoritativeExpenses(expenses:readonly CanonicalExpense[]){return expenses.filter(expense=>!expense.id.startsWith('pending:'))}
export function tripDebtLines(expenses: readonly CanonicalExpense[], payments: readonly SettlementPayment[], spaceId: string) {
  return deriveRelationalDebtLines(tripAuthoritativeExpenses(expenses), tripCurrentPayments(payments, spaceId), { scope: 'space', spaceId })
}
export function tripDirectionalTotals(lines: readonly RelationalDebtLine[], participant: string) {
  const totals = new Map<string, { currency: string; collectMinor: number; payMinor: number }>()
  for (const line of lines) {
    if (!Number.isSafeInteger(line.remainingMinor) || line.remainingMinor < 0) throw new Error('invalid_minor_amount')
    if (line.remainingMinor === 0 || line.creditorParticipantId !== participant && line.debtorParticipantId !== participant) continue
    const row = totals.get(line.currency) ?? { currency: line.currency, collectMinor: 0, payMinor: 0 }
    if (line.creditorParticipantId === participant) row.collectMinor += line.remainingMinor
    if (line.debtorParticipantId === participant) row.payMinor += line.remainingMinor
    if (!Number.isSafeInteger(row.collectMinor) || !Number.isSafeInteger(row.payMinor)) throw new Error('minor_amount_overflow')
    totals.set(line.currency, row)
  }
  return [...totals.values()].sort((a,b) => a.currency.localeCompare(b.currency))
}
export type TripLedgerTab = 'expenses' | 'balances'
export function tripLedgerView(params: URLSearchParams) {
  const section=params.get('section'), view=params.get('view')
  return { tab: (params.get('tab') === 'balances' || section === 'balances' ? 'balances' : 'expenses') as TripLedgerTab,
    view: view === 'history' || section === 'history' || section === 'activity' ? 'history' as const : view === 'summary' || section === 'recap' ? 'summary' as const : 'main' as const,
    history: params.get('history') === 'payments' ? 'payments' as const : params.get('history') === 'activity' || section === 'activity' ? 'activity' as const : 'expenses' as const }
}
