import { describe, expect, it } from 'vitest'
import { calculateQuickAmount as calc } from './quickCalculator'
describe('Quick Add calculator', () => {
  it('uses arithmetic precedence and exact decimal amounts', () => {
    expect(calc('0.1+0.2','MYR')).toBe('0.30')
    expect(calc('12+3×4','MYR')).toBe('24.00')
    expect(calc('(12+3)÷4','MYR')).toBe('3.75')
    expect(calc('100×10%','MYR')).toBe('10.00')
  })
  it('rounds once for the selected currency', () => {
    expect(calc('10÷3','MYR')).toBe('3.33')
    expect(calc('1.005','MYR')).toBe('1.01')
    expect(calc('10÷3','JPY')).toBe('3')
  })
  it('rejects incomplete, negative, unsafe and executable expressions', () => {
    for(const input of ['1÷0','1+','1-2','alert(1)','99999999999999999','(1+2']) expect(()=>calc(input,'MYR')).toThrow()
  })
})
