export type FundingDraft={version:number;accountId:string;amount:string}
// Session-memory only. Never copied to notification read metadata, logs or analytics.
export const notificationFundingDrafts=new Map<string,FundingDraft>()
export function clearNotificationFundingDrafts(){notificationFundingDrafts.clear()}
