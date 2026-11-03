import { addFraction, decimalFraction, fraction, roundFraction, type Fraction, type FxSnapshot } from './fx'
import { currencyExponent } from './money'

export type MoneyLine = { currency: string; amountMinor: number }
export type Coverage = {
  direction: 'you_owe' | 'they_owe'
  currency: string
  coveredMinor: bigint
  remainingMinor: bigint
  rateNumerator: string
  rateDenominator: string
}

const positive = (value: Fraction) => value.n > 0n && value.d > 0n

export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('invalid_rate')
  const negative = numerator < 0n
  const n = negative ? -numerator : numerator
  const q = n / denominator
  const r = n % denominator
  const rounded = q + (r * 2n >= denominator ? 1n : 0n)
  return negative ? -rounded : rounded
}

/** 1 target major = foreignPerTarget foreign majors. Same currency is 1/1. */
export function convertMinor(minor: bigint, currency: string, target: string, foreignPerTarget: Fraction): bigint {
  if (!positive(foreignPerTarget)) throw new Error('invalid_rate')
  if (currency === target) return minor
  const num = minor * 10n ** BigInt(currencyExponent(target)) * foreignPerTarget.d
  const den = foreignPerTarget.n * 10n ** BigInt(currencyExponent(currency))
  return roundDiv(num, den)
}

export function systemForeignPerTarget(currency: string, target: string, fx: FxSnapshot): Fraction | null {
  if (currency === target) return fraction(1n)
  const perMyr = (code: string) => {
    const rate = fx.rates[code]
    if (!rate) return null
    const foreign = decimalFraction(rate.denominator)
    const one = decimalFraction(rate.numerator)
    if (!positive(foreign) || !positive(one)) return null
    return fraction(foreign.n * one.d, foreign.d * one.n)
  }
  if (target === 'MYR') return perMyr(currency)
  const foreign = perMyr(currency)
  const quote = perMyr(target)
  if (!foreign || !quote) return null
  return fraction(foreign.n * quote.d, foreign.d * quote.n)
}

export function customForeignPerTarget(raw: string): Fraction {
  const rate = decimalFraction(raw.trim())
  if (!positive(rate)) throw new Error('invalid_rate')
  return rate
}

export function valueLines(lines: readonly MoneyLine[], target: string, rateFor: (currency: string) => Fraction | null) {
  const missing: string[] = []
  let total = fraction(0n)
  for (const line of lines) {
    const rate = rateFor(line.currency)
    if (!rate) { missing.push(line.currency); continue }
    total = addFraction(total, fraction(convertMinor(BigInt(line.amountMinor), line.currency, target, rate)))
  }
  return { missing: [...new Set(missing)].sort(), totalMinor: missing.length ? null : roundFraction(total) }
}

export function coverMinor(remaining: bigint, cash: bigint, full: bigint): bigint {
  if (remaining <= 0n || cash < 0n || full < 0n) throw new Error('invalid_amount')
  if (full === 0n) return cash === 0n ? remaining : 0n
  if (cash === full) return remaining
  if (cash === 0n) return 0n
  const covered = roundDiv(remaining * cash, full)
  return covered > remaining ? remaining : covered
}

function groupLines(lines: readonly MoneyLine[]): MoneyLine[] {
  const totals = new Map<string, number>()
  for (const line of lines) totals.set(line.currency, (totals.get(line.currency) ?? 0) + line.amountMinor)
  return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }))
}

export function settlementRequestId(current: { fingerprint: string; id: string } | null, fingerprint: string, nextId: string) {
  return current?.fingerprint === fingerprint ? current : { fingerprint, id: nextId }
}

export function quotePair(input: {
  youOwe: readonly MoneyLine[]
  theyOwe: readonly MoneyLine[]
  target: string
  rateFor: (currency: string) => Fraction | null
  intent: 'full' | 'partial' | 'offset'
  cashMinor?: bigint
}) {
  const youOwe = groupLines(input.youOwe)
  const theyOwe = groupLines(input.theyOwe)
  const currencies = [...new Set([...youOwe, ...theyOwe].map(line => line.currency))].sort()
  const rateFor = (currency: string) => input.rateFor(currency)
  const you = valueLines(youOwe, input.target, rateFor)
  const they = valueLines(theyOwe, input.target, rateFor)
  const missing = [...new Set([...you.missing, ...they.missing])].sort()
  if (missing.length || you.totalMinor == null || they.totalMinor == null) return { ok: false as const, missing, currencies }
  const net = you.totalMinor - they.totalMinor
  const direction = net > 0n ? 'pay' as const : net < 0n ? 'collect' as const : 'offset' as const
  const full = net < 0n ? -net : net
  if (input.intent === 'offset' && full !== 0n) throw new Error('invalid_amount')
  if (direction === 'collect' && input.intent !== 'offset') return { ok: true as const, direction, fullMinor: full, cashMinor: 0n, coverages: [] as Coverage[], currencies, missing }
  const cash = input.intent === 'full' || input.intent === 'offset' ? full : input.cashMinor ?? -1n
  if (input.intent === 'partial' && (cash <= 0n || cash >= full)) throw new Error('invalid_amount')
  const cover = (lines: readonly MoneyLine[], directionName: Coverage['direction']) => groupLines(lines).filter(line => line.amountMinor > 0).map(line => {
    const rate = rateFor(line.currency)!
    const remaining = BigInt(line.amountMinor)
    const covered = coverMinor(remaining, cash, full)
    return { direction: directionName, currency: line.currency, coveredMinor: covered, remainingMinor: remaining - covered, rateNumerator: rate.n.toString(), rateDenominator: rate.d.toString() }
  })
  const coverages = [...cover(input.youOwe, 'you_owe'), ...cover(input.theyOwe, 'they_owe')]
  if (cash > 0n && coverages.every(row => row.coveredMinor === 0n)) throw new Error('amount_too_small')
  return { ok: true as const, direction, fullMinor: full, cashMinor: cash, coverages, currencies, missing }
}
