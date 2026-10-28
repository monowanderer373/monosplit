import { parseMajorAmount, equalMinorShares } from './money'

export function tripItemMinorShares(total: number, currency: string, consumers: readonly string[], items: readonly {amount:string;participantIds:string[]}[]) {
  if (!items.length || !consumers.length) throw new Error('invalid_items')
  const result = new Map(consumers.map(id => [id, 0]))
  let sum = 0
  for (const item of items) {
    if (!item.participantIds.length || new Set(item.participantIds).size !== item.participantIds.length || item.participantIds.some(id => !result.has(id))) throw new Error('invalid_items')
    const amount = parseMajorAmount(item.amount, currency)
    for (const [id, minor] of equalMinorShares(amount, item.participantIds)) result.set(id, result.get(id)! + minor)
    sum += amount
  }
  if (sum !== total) throw new Error('item_total_mismatch')
  return result
}

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
