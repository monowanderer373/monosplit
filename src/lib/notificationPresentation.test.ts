/** @vitest-environment jsdom */
import {beforeEach,expect,it} from 'vitest'
import {parseNoticeLocation,noticeDestination,noticePagePath,saveNoticeOrigin,takeNoticeOrigin,noticeRowAction} from './notificationPresentation'
import {buildHomeNotifications} from './homeNotifications'
import {noticeSnapshot} from '../test/notificationFixtures'
beforeEach(()=>sessionStorage.clear())
it('routes simple tasks and exact complex pages with no title/name lookup; legacy links remain valid',()=>{
 expect(noticeDestination({kind:'funding',id:'intent-1'})).toBe('/?notice=funding&target=intent-1')
 expect(noticeDestination({kind:'change',id:'change-2'})).toBe('/notifications/change/change-2')
 expect(parseNoticeLocation('/notifications/expense/same-title-2','')).toEqual({kind:'expense',id:'same-title-2'})
 expect(parseNoticeLocation('/', '?notice=account&target=wallet')).toEqual({kind:'account',id:'wallet'})
 expect(parseNoticeLocation('/notifications/unknown/entity','')).toBeNull()
 expect(parseNoticeLocation('/notifications/funding/https://other.test','')).toBeNull()
 expect(noticePagePath({kind:'recurring',id:'occurrence-1'},true)).toBe('/notifications/recurring/occurrence-1?details=1')
})
it('stores only safe per-identity tab/scroll/row context and consumes it once',()=>{
 const origin={tab:'activity' as const,scrollTop:120,rowId:'account:wallet',pageScroll:250}
 saveNoticeOrigin('owner',origin);expect(takeNoticeOrigin('other')).toBeNull();expect(takeNoticeOrigin('owner')).toEqual(origin);expect(takeNoticeOrigin('owner')).toBeNull()
 sessionStorage.setItem('tt-notification-origin:owner',JSON.stringify({...origin,rowId:'https://external.test'}));expect(takeNoticeOrigin('owner')).toBeNull()
})
it('uses short actions and real account context while retaining typed identities',()=>{
 const s=noticeSnapshot();s.funding[0].account_id='bank'
 const n=buildHomeNotifications(s,[]).find(n=>n.ref.id==='fund-1')!
 expect(noticeRowAction(n)).toBe('noticeA.funding.addAmount');expect(n.relatedAccountName).toBe('Bank');expect(n.ref).toEqual({kind:'funding',id:'fund-1'})
})
