import { expect, it } from 'vitest'
import { validTripPeriod, tripPeriodStatus } from './tripPeriod'
it.each([['2026-10-10','2026-10-10',true],['2026-10-10','2026-10-12',true],['2026-10-12','2026-10-10',false],['','2026-10-10',false],['2026-10-10','',false],['2026-02-30','2026-03-01',false],['2028-02-29','2028-03-01',true],['2026-02-29','2026-03-01',false]])('validates period %s through %s', (startDate,endDate,expected) => {
 expect(validTripPeriod({startDate,endDate,datesLater:false})).toBe(expected)
})
it('allows explicitly postponed dates', () => expect(validTripPeriod({startDate:'',endDate:'',datesLater:true})).toBe(true))
it.each([
 ['2026-10-10','2026-10-12','2026-10-09','upcoming'],
 ['2026-10-10','2026-10-12','2026-10-10','active'],
 ['2026-10-10','2026-10-12','2026-10-12','active'],
 ['2026-10-10','2026-10-12','2026-10-13','ended'],
 [null,null,'2026-10-13','unplanned'],[null,'2026-10-12','2026-10-13','ended'],
])('derives inclusive period status (%s / %s / %s)', (startDate,endDate,today,status) => expect(tripPeriodStatus({status:'active',startDate,endDate},today!)).toBe(status))
it('keeps ledger archive status distinct from an ended period', () => expect(tripPeriodStatus({status:'archived',startDate:'2026-10-10',endDate:'2026-10-12'},'2026-10-10')).toBe('archived'))
