import {currencyExponent} from './money'
import type {HomeNotification,NoticeRef} from './homeNotifications'
import {parseNotice} from './homeNotifications'
import type {TranslationKey} from './i18n'

export const simpleNotice = (ref:NoticeRef) => ['funding','recurring','installment','outbox'].includes(ref.kind)
export function noticePagePath(ref:NoticeRef,details=false){return `/notifications/${ref.kind}/${encodeURIComponent(ref.id)}${details?'?details=1':''}`}
export function noticeDestination(ref:NoticeRef){return simpleNotice(ref)?`/?${new URLSearchParams({notice:ref.kind,target:ref.id})}`:noticePagePath(ref)}
export function parseNoticeLocation(pathname:string,search:string){
 const match=/^\/notifications\/([a-z]+)\/([a-zA-Z0-9-]{1,100})$/.exec(pathname)
 if(pathname.startsWith('/notifications/')&&!match)return null
 return match?parseNotice('?'+new URLSearchParams({notice:match[1],target:match[2]})):parseNotice(search)
}
export function noticeRowAction(n:HomeNotification):TranslationKey{
 if(n.state!=='pending')return n.ref.kind==='account'?'noticeA.account.negative':n.ref.kind==='funding'?'noticeA.balanceUpdated':n.title
 const actions:Partial<Record<NoticeRef['kind'],TranslationKey>>={funding:n.relatedAccountId?'noticeA.funding.addAmount':'notice.choose',recurring:'noticeA.recordPayment',installment:'noticeA.recordInstallment',expense:'noticeA.review',change:n.action==='noticeA.reviewCancellation'?'noticeA.reviewCancellation':'noticeA.change.title',payment:'noticeA.receipt.confirm',request:'noticeA.payment.record',outbox:'noticeA.outbox.retry'}
 return actions[n.ref.kind]??n.action
}
export type NoticeOrigin={tab:'tasks'|'activity';scrollTop:number;rowId:string;pageScroll:number}
const originKey=(identity:string)=>`tt-notification-origin:${identity}`
export function saveNoticeOrigin(identity:string,value:NoticeOrigin){try{sessionStorage.setItem(originKey(identity),JSON.stringify(value))}catch{/* Navigation remains available. */}}
export function takeNoticeOrigin(identity:string):NoticeOrigin|null{
 try{const key=originKey(identity),value=JSON.parse(sessionStorage.getItem(key)??'null');sessionStorage.removeItem(key)
  return value&&['tasks','activity'].includes(value.tab)&&typeof value.rowId==='string'&&/^[a-z]+:[a-zA-Z0-9-]{1,100}$/.test(value.rowId)&&Number.isFinite(value.scrollTop)&&Number.isFinite(value.pageScroll)?{...value,scrollTop:Math.max(0,value.scrollTop),pageScroll:Math.max(0,value.pageScroll)}:null
 }catch{return null}
}

/** Exact editable text only; authoritative money and currency validation remain in the domain helpers. */
export function notificationAmountInput(value:number|string,currency:string){const digits=currencyExponent(currency),n=BigInt(value),base=10n**BigInt(digits);return `${n/base}${digits?'.'+(n%base).toString().padStart(digits,'0'):''}`}
