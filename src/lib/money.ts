const CURRENCY_EXPONENTS: Readonly<Record<string, number>> = {
  AUD: 2,
  CNY: 2,
  EUR: 2,
  GBP: 2,
  HKD: 2,
  JPY: 0,
  KRW: 0,
  MYR: 2,
  SGD: 2,
  THB: 2,
  TWD: 2,
  USD: 2,
}

export type Money = Readonly<{
  amountMinor: number
  currency: string
}>

export type MoneyErrorCode =
  | 'unknown_currency'
  | 'invalid_amount'
  | 'too_many_fraction_digits'
  | 'amount_overflow'

export class MoneyError extends Error {
  readonly code: MoneyErrorCode

  constructor(code: MoneyErrorCode) {
    super(code)
    this.name = 'MoneyError'
    this.code = code
  }
}

export function currencyExponent(currency: string): number {
  const exponent = CURRENCY_EXPONENTS[currency.toUpperCase()]
  if (exponent == null) throw new MoneyError('unknown_currency')
  return exponent
}

export function assertMinorAmount(value: number, options: { allowZero?: boolean } = {}): number {
  if (!Number.isSafeInteger(value)) throw new MoneyError('amount_overflow')
  if (value < 0 || (!options.allowZero && value === 0)) {
    throw new MoneyError('invalid_amount')
  }
  return value
}

export function parseMajorAmount(input: string, currency: string): number {
  const exponent = currencyExponent(currency)
  const normalized = input.trim().replaceAll(',', '')
  const match = /^(\d+)(?:\.(\d*))?$/.exec(normalized)
  if (!match) throw new MoneyError('invalid_amount')

  const whole = match[1]
  const fraction = match[2] ?? ''
  if (fraction.length > exponent) throw new MoneyError('too_many_fraction_digits')

  const factor = 10 ** exponent
  const wholeMinor = Number(whole) * factor
  const fractionMinor = exponent === 0 ? 0 : Number(fraction.padEnd(exponent, '0'))
  const result = wholeMinor + fractionMinor
  return assertMinorAmount(result)
}

export function formatMinorAmount(amountMinor: number, currency: string, locale?: string): string {
  assertMinorAmount(amountMinor, { allowZero: true })
  const exponent = currencyExponent(currency)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amountMinor / 10 ** exponent)
}

export function equalMinorShares(totalMinor: number, orderedParticipantIds: readonly string[]): Map<string, number> {
  assertMinorAmount(totalMinor)
  if (orderedParticipantIds.length === 0) throw new MoneyError('invalid_amount')
  if (new Set(orderedParticipantIds).size !== orderedParticipantIds.length) {
    throw new MoneyError('invalid_amount')
  }

  const base = Math.floor(totalMinor / orderedParticipantIds.length)
  let remainder = totalMinor % orderedParticipantIds.length
  const shares = new Map<string, number>()
  for (const participantId of orderedParticipantIds) {
    const amountMinor = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
    shares.set(participantId, amountMinor)
  }
  return shares
}

export function reconcileMinorAmounts(
  amounts: Readonly<Record<string, number>>,
  expectedTotalMinor: number,
): void {
  assertMinorAmount(expectedTotalMinor)
  const values = Object.values(amounts)
  if (values.length === 0) throw new MoneyError('invalid_amount')
  const total = values.reduce((sum, value) => sum + assertMinorAmount(value, { allowZero: true }), 0)
  if (!Number.isSafeInteger(total)) throw new MoneyError('amount_overflow')
  if (total !== expectedTotalMinor) throw new MoneyError('invalid_amount')
}
