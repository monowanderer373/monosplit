import { parseMajorAmount } from './money'

/** Consumers are independent of the principals required to preserve payments/history. */
export function tripFinancialParticipantIds(input: {
  consumers: readonly string[]
  payerAmounts: Record<string, string>
  currency: string
  recorder?: string
  originalIds?: readonly string[]
}): string[] {
  const payers = Object.entries(input.payerAmounts).filter(([, raw]) => {
    if (!raw.trim() || /^0+(\.0*)?$/.test(raw.trim())) return false
    return parseMajorAmount(raw, input.currency) > 0
  }).map(([id]) => id)
  return [...new Set([
    ...(input.originalIds ?? []),
    ...(input.recorder ? [input.recorder] : []),
    ...input.consumers,
    ...payers,
  ])]
}
