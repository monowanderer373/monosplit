import {supabase} from './supabase'
import {validateRoutedPlan,type RoutedDraft,type RoutedPlan,type RoutedReview,type RoutedPerson} from './routedSettlement'
export type CreatorPerson=RoutedPerson&{kind:'account'|'manual';delegated?:boolean}
export type CreatorContext={canRecord:boolean;isCreator:boolean;policyVersion:string;name:string;members:CreatorPerson[]}
export type CreatorDraft=RoutedDraft&{occurredAt:string;note:string;ownAccountLinks:{paymentId:string;accountId:string}[];replacementFor?:string}
export type CreatorCorrection={id:string;reason:string;requesterName:string;status:'pending'|'resolved'|'dismissed';version:number;createdAt:string;resolution:string|null}
export type CreatorRecord={id:string;tripId:string;recordedByName:string;occurredAt:string;recordedAt:string;timeZone:string;note:string;status:'posted'|'reversed';version:number;plan:RoutedPlan;people:CreatorPerson[];canManage:boolean;canReverse:boolean;canRequestCorrection:boolean;correctionPending:boolean;corrections:CreatorCorrection[];reversedAt:string|null;reverseReason:string|null;replacementFor:string|null;replacementId:string|null;ownCash:{lineId:string;role:'payer'|'receiver';currency:'MYR'|'VND';amountMinor:number;accountId:string|null;linked:boolean}[]}
export type CreatorNotice={id:string;recordId:string;tripId:string;tripName:string;actorName:string;kind:'creator_recorded'|'creator_reversed'|'correction_requested'|'correction_resolved';date:string;version:number;pending:boolean}
export type CreatorNoticeFeed={notices:CreatorNotice[];managedPaymentIds:string[]}
export type CreatorAttempt={requestId:string;draft:CreatorDraft;review:RoutedReview;attested:true}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function rpc(identity:string,name:string,args:Record<string,unknown>,guard?:()=>void){
 if(!supabase)throw new Error('not_configured')
 const {data,error}=await supabase.auth.getSession();guard?.()
 if(error||!data.session||data.session.user.id!==identity)throw new Error('creator_context_changed')
 const result=await supabase.rpc(name,args).setHeader('Authorization',`Bearer ${data.session.access_token}`)
 if(result.error)throw new Error(result.error.message)
 return result.data
}
function record(value:unknown):CreatorRecord{
 const r=value as CreatorRecord
 if(!r||!uuid.test(r.id)||!uuid.test(r.tripId)||!['posted','reversed'].includes(r.status)||!Number.isInteger(r.version)||!Array.isArray(r.people)||!Array.isArray(r.ownCash)||!Array.isArray(r.corrections))throw new Error('creator_invalid_response')
 validateRoutedPlan(r.plan)
 if(r.ownCash.some(c=>!Number.isSafeInteger(c.amountMinor)||c.amountMinor<=0||!['MYR','VND'].includes(c.currency)))throw new Error('creator_invalid_response')
 return r
}
export async function readCreatorContext(identity:string,trip:string):Promise<CreatorContext>{
 const c=await rpc(identity,'get_trip_creator_context',{target_space_id:trip})
 if(!c||typeof c.canRecord!=='boolean'||typeof c.isCreator!=='boolean'||!Array.isArray(c.members)||typeof c.policyVersion!=='string')throw new Error('creator_invalid_response')
 return c
}
export async function previewCreator(identity:string,trip:string,draft:CreatorDraft):Promise<RoutedReview>{
 const r=await rpc(identity,'preview_trip_creator_settlement',{target_space_id:trip,draft});validateRoutedPlan(r?.plan)
 if(typeof r.expiresAt!=='string'||r.digest!==null&&!/^[a-f0-9]{64}$/.test(r.digest))throw new Error('creator_invalid_response');return r
}
export async function recordCreator(identity:string,trip:string,attempt:CreatorAttempt,guard:()=>void){return record(await rpc(identity,'record_trip_creator_settlement',{target_space_id:trip,draft:attempt.draft,request_id:attempt.requestId,reviewed_digest:attempt.review.digest,expires_at:attempt.review.expiresAt,attested:attempt.attested},guard))}
export async function readCreator(identity:string,trip:string,id?:string,requestId?:string):Promise<CreatorRecord[]>{
 const rows=await rpc(identity,'read_trip_creator_settlements',{target_space_id:trip,record_id:id??null,request_id:requestId??null});if(!Array.isArray(rows))throw new Error('creator_invalid_response');return rows.map(record)
}
export async function changeCreatorDelegate(identity:string,trip:string,participant:string,enabled:boolean,requestId:string,policy:string){return await rpc(identity,'set_trip_creator_delegate',{target_space_id:trip,participant_id:participant,enabled,request_id:requestId,expected_policy:policy})as CreatorContext}
export async function linkCreatorAccount(identity:string,r:CreatorRecord,lineId:string,account:string,requestId:string){return record(await rpc(identity,'link_trip_creator_account',{record_id:r.id,line_id:lineId,account_id:account,request_id:requestId,expected_version:r.version}))}
export async function correctCreator(identity:string,r:CreatorRecord,reason:string,requestId:string){return record(await rpc(identity,'request_trip_creator_correction',{record_id:r.id,request_id:requestId,reason}))}
export async function resolveCreatorCorrection(identity:string,c:CreatorCorrection,resolution:string,replacementId:string|null,requestId:string){return record(await rpc(identity,'resolve_trip_creator_correction',{correction_id:c.id,request_id:requestId,expected_version:c.version,resolution,replacement_id:replacementId}))}
export async function reverseCreator(identity:string,r:CreatorRecord,reason:string,requestId:string){return record(await rpc(identity,'reverse_trip_creator_settlement',{record_id:r.id,request_id:requestId,expected_version:r.version,reason}))}
export async function loadCreatorNotices(identity:string,noticeId?:string):Promise<CreatorNoticeFeed>{
 const feed=await rpc(identity,'get_creator_settlement_notifications',{target_notice_id:noticeId??null})
 if(!feed||!Array.isArray(feed.notices)||!Array.isArray(feed.managedPaymentIds)||feed.notices.some((n:CreatorNotice)=>!uuid.test(n.id)||!uuid.test(n.recordId)||!uuid.test(n.tripId)))throw new Error('creator_invalid_response')
 return feed
}
export async function retireCreatorAttempt(identity:string,trip:string,requestId:string){
 const receipt=await rpc(identity,'reconcile_personal_money_operation',{request_id:requestId})
 if(receipt?.state==='committed'){const rows=await readCreator(identity,trip,undefined,requestId);if(!rows[0]||rows[0].id!==receipt.result?.recordId)throw new Error('creator_record_unavailable');return rows[0]}
 if(receipt?.state!=='not_posted')throw new Error('creator_unknown_result');return null
}
const prefix='tt:creator:pending:'
const key=(scope:string,trip:string)=>prefix+scope+':'+trip
const stores=()=>{const result:Storage[]=[];try{result.push(sessionStorage)}catch{/* handled before financial dispatch */}try{result.push(localStorage)}catch{/* handled before financial dispatch */}return result}
export function readCreatorAttempt(scope:string,trip:string):CreatorAttempt|null{
 for(const storage of stores()){
  let raw:string|null;try{raw=storage.getItem(key(scope,trip))}catch{continue}if(!raw)continue
  try{const a=JSON.parse(raw)as CreatorAttempt;if(a.attested!==true||!uuid.test(a.requestId)||!a.draft||!Array.isArray(a.draft.payments)||!Array.isArray(a.draft.ownAccountLinks)||typeof a.draft.occurredAt!=='string'||!a.review?.digest)throw new Error();validateRoutedPlan(a.review.plan);return a}catch{throw new Error('creator_recovery_invalid')}
 }return null
}
export function saveCreatorAttempt(scope:string,trip:string,a:CreatorAttempt){
 const serialized=JSON.stringify(a)
 for(const storage of stores())try{storage.setItem(key(scope,trip),serialized);if(storage.getItem(key(scope,trip))===serialized)return}catch{/* fallback retains the identical actor-scoped frozen request */}
 throw new Error('creator_recovery_unavailable')
}
export function clearCreatorAttempt(scope:string,trip:string){for(const storage of stores())try{storage.removeItem(key(scope,trip))}catch{/* next read remains safely blocked if storage fails */}}
export function clearCreatorRecovery(){for(const storage of stores())try{for(let i=storage.length-1;i>=0;i--){const k=storage.key(i);if(k?.startsWith(prefix))storage.removeItem(k)}}catch{/* unavailable storage is never used to issue an untracked request */}}
export const creatorChanged=(trip:string)=>window.dispatchEvent(new CustomEvent('tt:creator-settlement-changed',{detail:{trip}}))
export function creatorError(lang:string,cause:unknown){
 const message=cause instanceof Error?cause.message:'';const zh=lang==='zh'
 if(/creator_proxy_forbidden|creator_policy_changed/.test(message))return zh?'代记权限已变化，请刷新并重新核对。':'Your recording permission changed. Refresh and review again.'
 if(/future_payment|invalid_time/.test(message))return zh?'请填写实际发生的付款时间，不能登记未来计划。':'Enter the actual payment time. A future plan cannot be recorded as paid.'
 if(/account_owner_required/.test(message))return zh?'只能关联你本人的实际付款或收款账户。':'Only link your own account to your actual cash side.'
 if(/recovery_unavailable|recovery_invalid/.test(message))return zh?'无法保存或读取恢复信息，暂未发起新登记。请先核对已有记录。':'Recovery storage is unavailable. No new recording was sent; check existing records first.'
 if(/record_unavailable|space_membership/.test(message))return zh?'当前身份无法查看此记录。':'This record is unavailable to the current member.'
 if(/quote_changed|version_conflict|account_changed/.test(message))return zh?'账目、权限或账户已变化，请刷新并重新预览。':'Records, permission or accounts changed. Refresh and preview again.'
 if(/quote_expired/.test(message))return zh?'预览已过期，请重新预览。':'The review expired. Preview again.'
 if(/reversal_dependency/.test(message))return zh?'存在后续关联账目，请先处理后续变更再撤销。':'A later related change depends on this record. Resolve it before reversing.'
 if(/invalid_replacement/.test(message))return zh?'请先整笔撤销原记录，再创建一次关联的更正记录。':'Reverse the original record before creating its linked replacement.'
 if(/invalid_amount|invalid_rate|fraction|no_open_route/.test(message))return zh?'请核对实际金额、币种、抵扣路径和汇率。':'Check actual amounts, currencies, routes and rates.'
 return zh?'暂时无法完成。输入已保留，请核对结果后重试。':'Could not complete the action. Your input is retained; check its result before retrying.'
}
