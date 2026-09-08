import { assertMinorAmount, parseMajorAmount } from './money'

export type SettlementIntent = 'full' | 'partial'

export function resolveSettlementAmount(input: {
  intent: SettlementIntent | null
  partialAmount: string
  outstandingMinor: number
  currency: string
}): number {
  assertMinorAmount(input.outstandingMinor)
  if (input.intent == null) throw new Error('settlement_intent_required')
  if (input.intent === 'full') return input.outstandingMinor
  if (input.partialAmount.trim() === '') throw new Error('partial_amount_required')

  const amountMinor = parseMajorAmount(input.partialAmount, input.currency)
  if (amountMinor > input.outstandingMinor) {
    throw new Error('amount_exceeds_outstanding_balance')
  }
  return amountMinor
}
