import { assertMinorAmount, parseMajorAmount } from './money'

export type SettlementIntent = 'full' | 'partial'
export type OverpayDisposition = 'gift' | 'carry'

export type SettlementProposalAmounts = {
  sharedAmountMinor: number
  cashAmountMinor: number
  overpayDisposition: OverpayDisposition | null
}

export function resolveSettlementProposal(input: {
  intent: SettlementIntent | null
  partialAmount: string
  outstandingMinor: number
  currency: string
  overpayDisposition?: OverpayDisposition | null
}): SettlementProposalAmounts {
  assertMinorAmount(input.outstandingMinor)
  if (input.intent == null) throw new Error('settlement_intent_required')
  if (input.intent === 'full') {
    return {
      sharedAmountMinor: input.outstandingMinor,
      cashAmountMinor: input.outstandingMinor,
      overpayDisposition: null,
    }
  }
  if (input.partialAmount.trim() === '') throw new Error('partial_amount_required')

  const cashAmountMinor = parseMajorAmount(input.partialAmount, input.currency)
  if (cashAmountMinor <= input.outstandingMinor) {
    if (input.overpayDisposition != null) {
      throw new Error('overpay_disposition_requires_overpayment')
    }
    return {
      sharedAmountMinor: cashAmountMinor,
      cashAmountMinor,
      overpayDisposition: null,
    }
  }
  if (input.overpayDisposition == null) {
    throw new Error('amount_exceeds_outstanding_balance')
  }
  return {
    sharedAmountMinor: input.overpayDisposition === 'gift'
      ? input.outstandingMinor
      : cashAmountMinor,
    cashAmountMinor,
    overpayDisposition: input.overpayDisposition,
  }
}

export function resolveSettlementAmount(input: {
  intent: SettlementIntent | null
  partialAmount: string
  outstandingMinor: number
  currency: string
  overpayDisposition?: OverpayDisposition | null
}): number {
  return resolveSettlementProposal(input).sharedAmountMinor
}
