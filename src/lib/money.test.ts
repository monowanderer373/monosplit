import { describe, expect, it } from 'vitest'
import {
  MoneyError,
  currencyExponent,
  equalMinorShares,
  formatMinorAmount,
  parseMajorAmount,
  reconcileMinorAmounts,
} from './money'

describe('money', () => {
  it('parses two-decimal and zero-decimal currencies without floating point arithmetic', () => {
    expect(parseMajorAmount('100.25', 'MYR')).toBe(10_025)
    expect(parseMajorAmount('1,200', 'JPY')).toBe(1_200)
    expect(currencyExponent('KRW')).toBe(0)
  })

  it('rejects unknown currencies, excess precision, zero, and unsafe values', () => {
    expect(() => parseMajorAmount('10', 'BTC')).toThrowError(MoneyError)
    expect(() => parseMajorAmount('1.001', 'MYR')).toThrowError(
      expect.objectContaining({ code: 'too_many_fraction_digits' }),
    )
    expect(() => parseMajorAmount('0', 'MYR')).toThrowError(
      expect.objectContaining({ code: 'invalid_amount' }),
    )
    expect(() => parseMajorAmount('90071992547410', 'MYR')).toThrowError(
      expect.objectContaining({ code: 'amount_overflow' }),
    )
  })

  it('allocates the remainder by fixed participant order', () => {
    expect(Object.fromEntries(equalMinorShares(10_000, ['dav', 'lan', 'mei']))).toEqual({
      dav: 3334,
      lan: 3333,
      mei: 3333,
    })
  })

  it('strictly reconciles exact amounts', () => {
    expect(() => reconcileMinorAmounts({ dav: 7000, lan: 3000 }, 10_000)).not.toThrow()
    expect(() => reconcileMinorAmounts({ dav: 6999, lan: 3000 }, 10_000)).toThrowError(
      expect.objectContaining({ code: 'invalid_amount' }),
    )
  })

  it('formats minor units with the currency exponent', () => {
    expect(formatMinorAmount(12_345, 'MYR', 'en-MY')).toContain('123.45')
    expect(formatMinorAmount(123, 'JPY', 'ja-JP')).toContain('123')
  })
})
