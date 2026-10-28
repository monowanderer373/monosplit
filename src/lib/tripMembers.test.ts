import {expect,it} from 'vitest'
import {sortTripMembers,tripMemberPermissions,validTripId,type TripMember} from './tripMembers'
import type {SpaceWithRole} from './spaceRepository'
const entry={space:{status:'active'},role:'owner'}as SpaceWithRole
function row(id:string,role='view',kind='account',name='Same'):TripMember{return {participant:{id,kind,displayName:name},member:{participantId:id,role,removedAt:null}}as TripMember}
it('keeps immutable same-name principals, sorts own/owner/accounts/manual and excludes removed membership',()=>{
 const removed=row('removed');removed.member.removedAt='2026-10-01'
 expect(sortTripMembers([row('m','view','manual'),row('z'),row('owner','owner'),row('a'),removed,row('self')],'self').map(r=>r.participant.id)).toEqual(['self','owner','a','z','m'])
})
it('preserves owner/full/view/self permissions and existing active-account add restriction',()=>{
 const full={...entry,role:'full_access' as const},view={...entry,role:'view' as const}
 expect(tripMemberPermissions(entry,'self',row('self','owner'))).toMatchObject({invite:true,add:true,role:false,remove:false})
 expect(tripMemberPermissions(entry,'self',row('manual','view','manual'))).toMatchObject({role:false,remove:true})
 expect(tripMemberPermissions(entry,'self',row('other'))).toMatchObject({role:true,remove:true})
 expect(tripMemberPermissions(full,'self',row('other'))).toMatchObject({invite:false,add:true,role:false,remove:false})
 expect(tripMemberPermissions(view,'self',row('self'))).toMatchObject({invite:false,add:false,role:false,remove:true})
 expect(tripMemberPermissions({...entry,space:{...entry.space,status:'archived'}},'self').add).toBe(false)
})
it('does not turn personal labels or malformed paths into shared Space IDs',()=>{
 expect(validTripId('affiliation:any')).toBe(false);expect(validTripId('not-a-trip')).toBe(false);expect(validTripId('00000000-0000-4000-8000-000000000001')).toBe(true)
})
