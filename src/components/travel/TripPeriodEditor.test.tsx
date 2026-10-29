// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TripPeriodFields } from './TripPeriodEditor'
import { useTripPeriodEditor } from '../../hooks/useTripPeriodEditor'
// Original permission/version/lifecycle witnesses now exercise the shared page controller.
function TripPeriodEditor({spaceId,onSaved,onCancel}:{spaceId:string;onSaved:()=>void;onCancel:()=>void}) {
 const editor=useTripPeriodEditor(spaceId,onSaved)
 return <section aria-label="Edit trip dates" onKeyDown={event=>{if(event.key==='Escape'&&!editor.saving)onCancel()}}>
 {editor.status==='loading'?<p role="status">Loading</p>:editor.status==='ready'?<TripPeriodFields value={editor.period} onChange={editor.updatePeriod} disabled={editor.saving}/>:null}
 {editor.error?<p role="alert">{editor.error}</p>:null}<button type="button" onClick={onCancel}>Cancel</button>
 {editor.status==='ready'?<button type="button" disabled={!editor.canSave} onClick={()=>void editor.save()}>{editor.saving?'Saving…':'Save dates'}</button>:null}
 {editor.uncertain?<button type="button" onClick={()=>void editor.checkSave()}>Check save status</button>:null}
 {editor.error?<button type="button" onClick={()=>void editor.loadLatest()}>{editor.conflict?'Load latest dates':'Refresh'}</button>:null}</section>
}
import type { SpaceWithRole } from '../../lib/spaceRepository'
import { useStore } from '../../store/useStore'
const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), identity: 'user-a' }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ authUser: { id: mocks.identity } }) }))
vi.mock('../../lib/spaceRepository', () => ({ spaceRepository: { get: mocks.get, update: mocks.update } }))
const entry: SpaceWithRole = { role: 'owner', space: { id: 'trip-a', name: 'Existing trip', type: 'trip', ownerParticipantId: 'owner', startDate: null, endDate: null, defaultCurrency: 'VND', status: 'active', version: 7, createdAt: '', updatedAt: '' } }
const saved = vi.fn(), cancelled = vi.fn()
beforeEach(() => { vi.clearAllMocks(); mocks.identity = 'user-a'; useStore.setState({ lang: 'en' }); mocks.get.mockResolvedValue(entry); mocks.update.mockResolvedValue(8) })
afterEach(cleanup)
async function open() { const result = render(<TripPeriodEditor spaceId="trip-a" onSaved={saved} onCancel={cancelled}/>); await screen.findByLabelText('Start date'); return result }
function dates(start = '2026-10-10', end = '2026-10-15') { const later=screen.getByRole('checkbox',{name:'Dates not decided yet'})as HTMLInputElement;if(later.checked)fireEvent.click(later); fireEvent.change(screen.getByLabelText('Start date'), { target: { value: start } }); fireEvent.change(screen.getByLabelText('End date'), { target: { value: end } }) }
it('adds dates to an existing undated Trip using the current version, name and currency', async () => {
 await open(); expect(screen.getByRole('button', { name: 'Save dates' }).hasAttribute('disabled')).toBe(true); dates()
 fireEvent.click(screen.getByRole('button', { name: 'Save dates' })); await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
 expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ spaceId: 'trip-a', name: 'Existing trip', defaultCurrency: 'VND', expectedVersion: 7, startDate: '2026-10-10', endDate: '2026-10-15' })
})
it('rejects incomplete and reversed periods without sending a write', async () => {
 await open(); dates('2026-10-15', '2026-10-10'); expect(screen.getByRole('alert')).toBeTruthy()
 fireEvent.click(screen.getByRole('button', { name: 'Save dates' })); expect(mocks.update).not.toHaveBeenCalled()
 dates('2026-10-10', ''); expect(screen.getByRole('button', { name: 'Save dates' }).hasAttribute('disabled')).toBe(true)
})
it('only removes dates after explicitly choosing dates not decided yet', async () => {
 mocks.get.mockResolvedValue({ ...entry, space: { ...entry.space, startDate: '2026-10-10', endDate: '2026-10-12' } }); await open()
 fireEvent.click(screen.getByRole('checkbox', { name: 'Dates not decided yet' })); fireEvent.click(screen.getByRole('button', { name: 'Save dates' }))
 await waitFor(() => expect(saved).toHaveBeenCalled()); expect(mocks.update.mock.calls[0][0]).toMatchObject({ startDate: null, endDate: null })
})
it('Cancel and Escape leave the period unsaved', async () => {
 await open(); dates(); fireEvent.keyDown(screen.getByLabelText('Start date'), { key: 'Escape' }); expect(cancelled).toHaveBeenCalledTimes(1)
 fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(cancelled).toHaveBeenCalledTimes(2); expect(mocks.update).not.toHaveBeenCalled()
})
it('retains edited dates on version conflict and explicitly refreshes the latest version', async () => {
 await open(); dates(); mocks.update.mockRejectedValueOnce(new Error('version_conflict')); fireEvent.click(screen.getByRole('button', { name: 'Save dates' })); await screen.findByRole('alert')
 expect((screen.getByLabelText('End date') as HTMLInputElement).value).toBe('2026-10-15'); expect(saved).not.toHaveBeenCalled()
 mocks.get.mockResolvedValue({ ...entry, space: { ...entry.space, version: 9, endDate: '2026-10-20', startDate: '2026-10-10' } }); fireEvent.click(screen.getByRole('button', { name: 'Load latest dates' })); await waitFor(() => expect((screen.getByLabelText('End date') as HTMLInputElement).value).toBe('2026-10-20')); expect(screen.getByRole('button',{name:'Save dates'}).hasAttribute('disabled')).toBe(true);dates('2026-10-10','2026-10-21')
 fireEvent.click(screen.getByRole('button', { name: 'Save dates' })); await waitFor(() => expect(saved).toHaveBeenCalled()); expect(mocks.update.mock.calls[1][0].expectedVersion).toBe(9)
})
it('recovers a failed load instead of remaining in Loading', async () => {
 mocks.get.mockRejectedValueOnce(new Error('network')); render(<TripPeriodEditor spaceId="trip-a" onSaved={saved} onCancel={cancelled}/>); await screen.findByRole('alert')
 expect(screen.queryByRole('status')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Refresh' })); await screen.findByLabelText('Start date')
})
it.each(['view', 'removed'])('does not expose an editor to %s access', async role => {
 mocks.get.mockResolvedValue(role === 'removed' ? null : { ...entry, role }); render(<TripPeriodEditor spaceId="trip-a" onSaved={saved} onCancel={cancelled}/>); await screen.findByRole('alert')
 expect(screen.queryByLabelText('Start date')).toBeNull(); expect(screen.queryByRole('button', { name: 'Save dates' })).toBeNull(); expect(mocks.update).not.toHaveBeenCalled()
})
it('ignores a stale response when switching Trips', async () => {
 let resolve!: (value: SpaceWithRole) => void; mocks.get.mockImplementationOnce(() => new Promise(r => { resolve = r }))
 const view = render(<TripPeriodEditor spaceId="trip-a" onSaved={saved} onCancel={cancelled}/>); await waitFor(()=>expect(mocks.get).toHaveBeenCalledTimes(1)); mocks.get.mockResolvedValue({ ...entry, space: { ...entry.space, id: 'trip-b', endDate: '2026-10-30' } })
 view.rerender(<TripPeriodEditor spaceId="trip-b" onSaved={saved} onCancel={cancelled}/>); await screen.findByLabelText('Start date'); resolve(entry)
 await waitFor(() => expect((screen.getByLabelText('End date') as HTMLInputElement).value).toBe('2026-10-30'))
})
it('prevents duplicate saves and ignores completion after account changes', async () => {
 let resolve!: (value: number) => void; mocks.update.mockImplementation(() => new Promise(r => { resolve = r })); const view = await open(); dates()
 fireEvent.click(screen.getByRole('button', { name: 'Save dates' })); fireEvent.click(screen.getByRole('button', { name: 'Saving…' })); await waitFor(()=>expect(mocks.update).toHaveBeenCalledTimes(1))
 mocks.identity = 'user-b'; view.rerender(<TripPeriodEditor spaceId="trip-a" onSaved={saved} onCancel={cancelled}/>); await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2)); resolve(8)
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Saving…' })).toBeNull()); expect(saved).not.toHaveBeenCalled()
})

it('blocks a changed authoritative version before issuing a write and keeps the draft',async()=>{
 await open();dates();mocks.get.mockResolvedValue({...entry,space:{...entry.space,version:9}});fireEvent.click(screen.getByRole('button',{name:'Save dates'}));await screen.findByRole('alert');expect(mocks.update).not.toHaveBeenCalled();expect((screen.getByLabelText('End date')as HTMLInputElement).value).toBe('2026-10-15');expect(saved).not.toHaveBeenCalled();
})
it('rechecks current role before saving instead of trusting the opened snapshot',async()=>{
 await open();dates();mocks.get.mockResolvedValue({...entry,role:'view'});fireEvent.click(screen.getByRole('button',{name:'Save dates'}));await screen.findByRole('alert');expect(mocks.update).not.toHaveBeenCalled();expect(screen.queryByLabelText('Start date')).toBeNull();
})
it('reconciles an unknown response against authoritative dates without a second version advance',async()=>{
 await open();dates();mocks.update.mockImplementationOnce(async()=>{mocks.get.mockResolvedValue({...entry,space:{...entry.space,version:8,startDate:'2026-10-10',endDate:'2026-10-15'}});throw new TypeError('Failed to fetch')});fireEvent.click(screen.getByRole('button',{name:'Save dates'}));await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(mocks.update).toHaveBeenCalledTimes(1);
})
it('keeps an unconfirmed save blocked and checks status without blindly replaying update_space',async()=>{
 await open();dates();mocks.update.mockRejectedValueOnce(new TypeError('Failed to fetch'));fireEvent.click(screen.getByRole('button',{name:'Save dates'}));await screen.findByRole('button',{name:'Check save status'});expect(screen.getByRole('button',{name:'Save dates'}).hasAttribute('disabled')).toBe(true);expect(saved).not.toHaveBeenCalled();mocks.get.mockResolvedValue({...entry,space:{...entry.space,version:8,startDate:'2026-10-10',endDate:'2026-10-15'}});fireEvent.click(screen.getByRole('button',{name:'Check save status'}));await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(mocks.update).toHaveBeenCalledTimes(1);
})
it('retains a known failed save for an explicit same-version retry',async()=>{
 await open();dates();mocks.update.mockRejectedValueOnce({code:'P0001',message:'invalid_date_range'});fireEvent.click(screen.getByRole('button',{name:'Save dates'}));await screen.findByRole('alert');expect((screen.getByLabelText('End date')as HTMLInputElement).value).toBe('2026-10-15');fireEvent.click(screen.getByRole('button',{name:'Save dates'}));await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(mocks.update).toHaveBeenCalledTimes(2);expect(mocks.update.mock.calls[1][0].expectedVersion).toBe(7);
})
it.each(['ECONNRESET','ETIMEDOUT','08006','57P01'])('reconciles %s as an unknown outcome rather than replaying the write',async code=>{
 await open();dates();mocks.update.mockRejectedValueOnce({code,message:'Connection interrupted'});fireEvent.click(screen.getByRole('button',{name:'Save dates'}));await screen.findByRole('button',{name:'Check save status'});expect(screen.getByRole('button',{name:'Save dates'}).hasAttribute('disabled')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Check save status'}));await waitFor(()=>expect(mocks.get.mock.calls.length).toBeGreaterThanOrEqual(4));expect(saved).not.toHaveBeenCalled();expect(mocks.update).toHaveBeenCalledTimes(1)
})
it('leaves a persisted anomalous half-period visible and invalid rather than silently postponing',async()=>{
 mocks.get.mockResolvedValue({...entry,space:{...entry.space,startDate:'2026-10-10',endDate:null}});await open();expect((screen.getByLabelText('Start date')as HTMLInputElement).value).toBe('2026-10-10');expect((screen.getByRole('checkbox',{name:'Dates not decided yet'})as HTMLInputElement).checked).toBe(false);expect(screen.getByRole('button',{name:'Save dates'}).hasAttribute('disabled')).toBe(true);expect(mocks.update).not.toHaveBeenCalled();
})
it('does not offer the Trip controller to a Group',async()=>{mocks.get.mockResolvedValue({...entry,space:{...entry.space,type:'group'}});render(<TripPeriodEditor spaceId="trip-a" onSaved={saved} onCancel={cancelled}/>);await screen.findByRole('alert');expect(screen.queryByLabelText('Start date')).toBeNull();expect(mocks.update).not.toHaveBeenCalled()})
