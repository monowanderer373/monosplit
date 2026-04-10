import type { ItemizedInputMode, Split } from '../types'

type BaseSplitInput = {
  personId: string
  repaid?: boolean
  repaidAt?: string | null
  repaidDate?: string | null
}

function round4(value: number): number {
  return Number(value.toFixed(4))
}

function round2(value: number): number {
  return Number(value.toFixed(2))
}

export function calcEqualSplits(args: {
  peopleIds: string[]
  totalAmount: number
  repayCurrency: string
  rate: number | null
  rateSource: string | null
  rateDate: string | null
}): Split[] {
  const { peopleIds, totalAmount, repayCurrency, rate, rateSource, rateDate } = args
  const perPerson = totalAmount / peopleIds.length

  return peopleIds.map((personId) => {
    const amount = round4(perPerson)
    return {
      personId,
      amount,
      baseAmount: null,
      taxAmount: null,
      repayCurrency,
      convertedAmount: rate ? round2(amount * rate) : null,
      rate,
      rateSource,
      rateDate,
      repaid: false,
      repaidAt: null,
      repaidDate: null,
    }
  })
}

export function calcItemizedSplits(args: {
  peopleIds: string[]
  itemizedInput: Record<string, string>
  itemizedInputMode: ItemizedInputMode
  serviceTaxPct: number
  salesTaxPct: number
  tipsPct: number
  repayCurrency: string
  rate: number | null
  rateSource: string | null
  rateDate: string | null
}): Split[] {
  const {
    peopleIds,
    itemizedInput,
    itemizedInputMode,
    serviceTaxPct,
    salesTaxPct,
    tipsPct,
    repayCurrency,
    rate,
    rateSource,
    rateDate,
  } = args

  const totalTaxPct = serviceTaxPct + salesTaxPct + tipsPct
  const taxFactor = totalTaxPct / 100

  return peopleIds.map((personId) => {
    const rawValue = itemizedInput[personId]
    const parsed = rawValue === '' || rawValue == null ? null : Number(rawValue)
    const valid = parsed != null && Number.isFinite(parsed) && parsed >= 0

    let baseAmount: number | null = null
    if (valid) {
      baseAmount = itemizedInputMode === 'total' ? round4(parsed / (1 + taxFactor)) : parsed
    }

    const taxAmount = baseAmount != null ? round4(baseAmount * taxFactor) : null
    const amount = baseAmount != null ? round4(baseAmount + (taxAmount ?? 0)) : null

    return {
      personId,
      amount,
      baseAmount,
      taxAmount,
      repayCurrency,
      convertedAmount: rate && amount != null ? round2(amount * rate) : null,
      rate,
      rateSource,
      rateDate,
      repaid: false,
      repaidAt: null,
      repaidDate: null,
    }
  })
}

export function calcPercentageSplits(args: {
  peopleIds: string[]
  percentageInput: Record<string, string>
  totalAmount: number
  repayCurrency: string
  rate: number | null
  rateSource: string | null
  rateDate: string | null
}): Split[] {
  const { peopleIds, percentageInput, totalAmount, repayCurrency, rate, rateSource, rateDate } = args
  return peopleIds.map((personId) => {
    const pct = Number(percentageInput[personId] || 0)
    const amount = Number.isFinite(pct) && pct >= 0 ? round4(totalAmount * pct / 100) : 0
    return {
      personId, amount, baseAmount: null, taxAmount: null,
      repayCurrency, convertedAmount: rate ? round2(amount * rate) : null,
      rate, rateSource, rateDate, repaid: false, repaidAt: null, repaidDate: null,
    }
  })
}

export function calcSharesSplits(args: {
  peopleIds: string[]
  sharesInput: Record<string, string>
  totalAmount: number
  repayCurrency: string
  rate: number | null
  rateSource: string | null
  rateDate: string | null
}): Split[] {
  const { peopleIds, sharesInput, totalAmount, repayCurrency, rate, rateSource, rateDate } = args
  const totalShares = peopleIds.reduce((sum, pid) => {
    const s = Number(sharesInput[pid] || 0)
    return sum + (Number.isFinite(s) && s > 0 ? s : 0)
  }, 0)
  return peopleIds.map((personId) => {
    const myShares = Number(sharesInput[personId] || 0)
    const validShares = Number.isFinite(myShares) && myShares > 0 ? myShares : 0
    const amount = totalShares > 0 ? round4(totalAmount * validShares / totalShares) : 0
    return {
      personId, amount, baseAmount: null, taxAmount: null,
      repayCurrency, convertedAmount: rate ? round2(amount * rate) : null,
      rate, rateSource, rateDate, repaid: false, repaidAt: null, repaidDate: null,
    }
  })
}

export function calcAdjustmentSplits(args: {
  peopleIds: string[]
  adjustmentInput: Record<string, string>
  totalAmount: number
  repayCurrency: string
  rate: number | null
  rateSource: string | null
  rateDate: string | null
}): Split[] {
  const { peopleIds, adjustmentInput, totalAmount, repayCurrency, rate, rateSource, rateDate } = args
  const n = peopleIds.length
  if (n === 0) return []
  const totalAdjustments = peopleIds.reduce((sum, pid) => {
    const adj = Number(adjustmentInput[pid] || 0)
    return sum + (Number.isFinite(adj) ? adj : 0)
  }, 0)
  const remainder = totalAmount - totalAdjustments
  const baseEach = round4(remainder / n)
  return peopleIds.map((personId) => {
    const adj = Number(adjustmentInput[personId] || 0)
    const amount = round4(baseEach + (Number.isFinite(adj) ? adj : 0))
    return {
      personId, amount, baseAmount: null, taxAmount: null,
      repayCurrency, convertedAmount: rate ? round2(amount * rate) : null,
      rate, rateSource, rateDate, repaid: false, repaidAt: null, repaidDate: null,
    }
  })
}

export function mergeRepaidState(nextSplits: Split[], previousSplits: Split[]): Split[] {
  const repaidByPerson = new Map(
    previousSplits.filter((split) => split.repaid).map((split) => [split.personId, split]),
  )
  return nextSplits.map((split) => {
    const old = repaidByPerson.get(split.personId)
    if (!old) return split
    return {
      ...split,
      repaid: true,
      repaidAt: old.repaidAt,
      repaidDate: old.repaidDate,
    }
  })
}

export function assertPayerHasItemizedValue(payerId: string, itemizedInput: Record<string, string>): boolean {
  const raw = itemizedInput[payerId]
  if (raw == null || raw === '') return false
  const num = Number(raw)
  return Number.isFinite(num) && num >= 0
}

export function preserveSplitMeta(next: Split, old: BaseSplitInput): Split {
  if (!old.repaid) return next
  return {
    ...next,
    repaid: true,
    repaidAt: old.repaidAt ?? null,
    repaidDate: old.repaidDate ?? null,
  }
}
