import { describe, expect, it } from 'vitest'
import { decimalFraction, estimateMinor, exactAmount, exactCurrencyMoney, reconcileEstimates, roundFraction, unavailableFx, validateFx, type FxRate } from './fx'
import { spendingSnapshot } from './spendingView'
import { derivePersonalLedgerRows } from './ledgerSummary'
import { spendingExpense } from '../test/spendingFixtures'
const rate = (currency: string, denominator: string, numerator='1'): FxRate => ({currency,denominator,numerator,quote:'MYR',direction:'MYR-per-foreign',rateDate:'2026-10-13',fetchedAt:'2026-10-13T09:00:00Z',provider:'Frankfurter'})
const fx = { ...unavailableFx,id:'10000000-0000-4000-8000-000000000001',status:'fresh' as const,rates:{VND:rate('VND','6250'),USD:rate('USD','0.25')} }
const filter = {month:'2026-10',scope:'all' as const,currency:'MYR',tab:'category' as const}
describe('reference-only FX in the actual spending engine', () => {
  it('uses own share and all original currencies, reconciles every grouping', () => {
    const rows = derivePersonalLedgerRows([spendingExpense('myr',34600),spendingExpense('vnd',2500000,'direct',{currency:'VND'}),spendingExpense('usd',10000,'personal',{currency:'USD'})],'you')
    const s = spendingSnapshot(rows,'you',filter,'MYR',fx)
    expect(s.count).toBe(3);expect(s.totalMinor).toBe(94600)
    expect(s.totals).toEqual([{currency:'MYR',originalMinor:'34600',equivalentMinor:'34600'},{currency:'USD',originalMinor:'10000',equivalentMinor:'40000'},{currency:'VND',originalMinor:'1250000',equivalentMinor:'20000'}])
    expect(s.days.reduce((n,[,v])=>n+v,0)).toBe(s.totalMinor);expect(s.categories.reduce((n,[,v])=>n+v,0)).toBe(s.totalMinor)
    expect(s.fx.id).toBe(fx.id);expect(rows[1].expense.totalMinor).toBe(2500000)
  })
  it('retains originals/count when unavailable and never values missing as zero',()=>{
    const rows=derivePersonalLedgerRows([spendingExpense('vnd',1250000,'personal',{currency:'VND'})],'you')
    const s=spendingSnapshot(rows,'you',filter,'MYR')
    expect(s.count).toBe(1);expect(s.totals[0]).toEqual({currency:'VND',originalMinor:'1250000',equivalentMinor:null});expect(s.missingCurrencies).toEqual(['VND'])
  })
  it('supports 0/2/3 currency minor digits without changing supported ledger currencies',()=>{
    expect(roundFraction(estimateMinor(1250000n,0,rate('VND','6250')))).toBe(20000n)
    expect(roundFraction(estimateMinor(100n,2,rate('USD','0.25')))).toBe(400n)
    expect(roundFraction(estimateMinor(1005n,3,rate('BHD','1','10')))).toBe(1005n)
  })
  it('normalizes both directions exactly including scientific notation',()=>{
    expect(decimalFraction('1.6e-4')).toEqual({n:1n,d:6250n})
    expect(estimateMinor(1250000n,0,rate('VND','1','0.00016'))).toEqual(estimateMinor(1250000n,0,rate('VND','6250')))
  })
  it.each(['0','-1','NaN','Infinity','bad'])('rejects invalid denominator %s without identity fallback',d=>{
    expect(()=>estimateMinor(100n,2,rate('USD',d))).toThrow()
    expect(validateFx({...fx,rates:{USD:rate('USD',d)}}).rates).toEqual({})
  })
  it('rounds once and allocates residuals stably to keep groups consistent',()=>{
    expect(reconcileEstimates([['a',{n:3n,d:2n}],['b',{n:3n,d:2n}],['c',{n:3n,d:2n}]])).toEqual([['a',2n],['b',2n],['c',1n]])
    expect(roundFraction({n:-3n,d:2n})).toBe(-2n)
  })
  it('formats amounts beyond safe integer without losing digits',()=>{
    expect(exactAmount('900719925474099329',2,'en-US')).toBe('9,007,199,254,740,993.29')
  })
  it('keeps the last MYR cent in records and preserves native currency placement',()=>{
    expect(exactCurrencyMoney(9007199254740991n,2,'MYR','en-MY')).toBe('RM\u00a090,071,992,547,409.91')
    expect(exactCurrencyMoney(1200n,2,'MYR','en-MY')).toBe('RM\u00a012.00')
  })
  it('MYR-only needs no network and legacy currency selection cannot drop records',()=>{
    const rows=derivePersonalLedgerRows([spendingExpense('myr',1200)],'you')
    const s=spendingSnapshot(rows,'you',{...filter,currency:'JPY'},'MYR')
    expect(s.totalMinor).toBe(1200);expect(s.missingCurrencies).toEqual([]);expect(s.count).toBe(1)
  })
})
