/** Display valuation only: never used for balances, debt, funding or settlement. */
export type Fraction = { n: bigint; d: bigint }
export type FxRate = { currency: string; quote: 'MYR'; numerator: string; denominator: string; direction: 'MYR-per-foreign'; rateDate: string; fetchedAt: string; provider: 'Frankfurter' }
export type FxSnapshot = { id: string | null; rates: Record<string, FxRate>; status: 'fresh' | 'cached' | 'unavailable'; fetchedAt: string | null; retryAfter?: string | null }
export const unavailableFx: FxSnapshot = { id: null, rates: {}, status: 'unavailable', fetchedAt: null }
export const fraction = (n: bigint, d = 1n): Fraction => {
  if (d <= 0n) throw new Error('Invalid denominator')
  let a = n < 0n ? -n : n, b = d
  while (b) { const t = a % b; a = b; b = t }
  const g = a || 1n
  return { n: n / g, d: d / g }
}
export const addFraction = (a: Fraction, b: Fraction) => fraction(a.n * b.d + b.n * a.d, a.d * b.d)
export function decimalFraction(value: string): Fraction {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value)
  if (!match || value.length > 100) throw new Error('Invalid decimal')
  const scale = (match[3]?.length ?? 0) - Number(match[4] ?? 0)
  if (!Number.isInteger(scale) || Math.abs(scale) > 40) throw new Error('Invalid scale')
  const n = BigInt(match[2] + (match[3] ?? '')) * (match[1] === '-' ? -1n : 1n)
  return fraction(scale < 0 ? n * 10n ** BigInt(-scale) : n, scale > 0 ? 10n ** BigInt(scale) : 1n)
}
export function roundFraction(a: Fraction) {
  const sign = a.n < 0n ? -1n : 1n, n = a.n * sign
  return sign * (n / a.d + (n % a.d * 2n >= a.d ? 1n : 0n))
}
export function estimateMinor(minor: bigint, digits: number, rate: Pick<FxRate, 'numerator' | 'denominator'>): Fraction {
  if (!Number.isInteger(digits) || digits < 0 || digits > 6) throw new Error('Invalid precision')
  const n = decimalFraction(rate.numerator), d = decimalFraction(rate.denominator)
  if (n.n <= 0n || d.n <= 0n) throw new Error('Invalid rate')
  return fraction(minor * n.n * d.d * 100n, n.d * d.n * 10n ** BigInt(digits))
}
/** Largest remainder at the DISPLAY boundary, so every grouping sums to total. */
export function reconcileEstimates<T>(entries: [T, Fraction][]): [T, bigint][] {
  const total = roundFraction(entries.reduce((s, [, f]) => addFraction(s, f), fraction(0n)))
  const values = entries.map(([key, f], index) => {
    const floor = f.n / f.d - (f.n < 0n && f.n % f.d ? 1n : 0n)
    return { key, index, value: floor, remainder: fraction(f.n - floor * f.d, f.d) }
  })
  let extra = total - values.reduce((s, v) => s + v.value, 0n)
  const ordered = [...values].sort((a,b) => {
    const delta = b.remainder.n * a.remainder.d - a.remainder.n * b.remainder.d
    return delta > 0n ? 1 : delta < 0n ? -1 : a.index - b.index
  })
  for (const v of ordered) { if (extra <= 0n) break; v.value++; extra-- }
  return values.map(v => [v.key, v.value])
}
export function validateFx(input: unknown): FxSnapshot {
  if (!input || typeof input !== 'object') throw new Error('Invalid snapshot')
  const raw = input as Record<string, unknown>
  if (raw.id !== null && (typeof raw.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw.id))) throw new Error('Invalid snapshot id')
  if (!raw.rates || typeof raw.rates !== 'object' || Array.isArray(raw.rates)) throw new Error('Invalid rates')
  const rates: Record<string,FxRate> = {}
  for (const [code, value] of Object.entries(raw.rates)) {
    try {
      const r = value as FxRate
      if (!/^[A-Z]{3}$/.test(code) || code !== r.currency || r.quote !== 'MYR' || r.direction !== 'MYR-per-foreign' || r.provider !== 'Frankfurter'
        || !/^\d{4}-\d{2}-\d{2}$/.test(r.rateDate) || !Number.isFinite(Date.parse(r.rateDate)) || !Number.isFinite(Date.parse(r.fetchedAt))) continue
      estimateMinor(1n, 2, r)
      rates[code] = r
    } catch { /* Invalid rates stay missing; no zero or identity fallback. */ }
  }
  return { id: raw.id as string | null, rates, status: raw.status === 'fresh' || raw.status === 'cached' ? raw.status : 'unavailable', fetchedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt : null, retryAfter: typeof raw.retryAfter === 'string' ? raw.retryAfter : null }
}
export function exactAmount(minor: string | bigint, digits: number, locale: string) {
  const n = BigInt(minor), abs = n < 0n ? -n : n, scale = 10n ** BigInt(digits)
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(p => p.type === 'decimal')?.value ?? '.'
  return (n < 0n ? '−' : '') + new Intl.NumberFormat(locale).format(abs / scale) + (digits ? separator + (abs % scale).toString().padStart(digits,'0') : '')
}
