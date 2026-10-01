import { describe, expect, it } from 'vitest'
import { summarizeSpending } from './insightsModel'
describe('spending summaries', () => {
  it('reconciles category and day totals in integer minor units', () => {
    const result = summarizeSpending([{category:'Food',date:'2026-10-01',amountMinor:101},{category:'Food',date:'2026-10-02',amountMinor:202},{category:'Travel',date:'2026-10-01',amountMinor:99}])
    expect(result).toEqual({totalMinor:402,categories:[['Food',303],['Travel',99]],days:[['2026-10-01',200],['2026-10-02',202]]})
  })
  it('rejects invalid or overflowing amounts', () => {
    expect(() => summarizeSpending([{category:'Food',date:'2026-10-01',amountMinor:-1}])).toThrow()
    expect(() => summarizeSpending([{category:'Food',date:'2026-10-01',amountMinor:Number.MAX_SAFE_INTEGER},{category:'Food',date:'2026-10-01',amountMinor:1}])).toThrow()
    expect(summarizeSpending([]).totalMinor).toBe(0)
  })
})
