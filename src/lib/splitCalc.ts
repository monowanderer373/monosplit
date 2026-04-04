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
