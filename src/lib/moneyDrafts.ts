import type { SourceDraft } from './multicurrency'

type FundingDraft={version:number;sources:SourceDraft[];covers:boolean}
// Financial drafts stay in memory, scoped to the authenticated identity and target.
// They are never placed in notification read metadata, URLs, DOM attributes or diagnostics.
const drafts=new Map<string,FundingDraft>()
export function readFundingDraft(identity:string,target:string,version:number){
 const draft=drafts.get(`${identity}:${target}`)
 return draft?.version===version?draft:null
}
export function saveFundingDraft(identity:string,target:string,draft:FundingDraft){
 drafts.set(`${identity}:${target}`,draft)
 while(drafts.size>20)drafts.delete(drafts.keys().next().value!)
}
export function clearFundingDraft(identity:string,target:string){drafts.delete(`${identity}:${target}`)}
