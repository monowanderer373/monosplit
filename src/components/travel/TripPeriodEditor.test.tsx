// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import TripPeriodEditor from './TripPeriodEditor'
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
function dates(start = '2026-10-10', end = '2026-10-15') { fireEvent.change(screen.getByLabelText('Start date'), { target: { value: start } }); fireEvent.change(screen.getByLabelText('End date'), { target: { value: end } }) }
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
 mocks.get.mockResolvedValue({ ...entry, space: { ...entry.space, version: 9, endDate: '2026-10-20', startDate: '2026-10-10' } }); fireEvent.click(screen.getByRole('button', { name: 'Refresh' })); await waitFor(() => expect((screen.getByLabelText('End date') as HTMLInputElement).value).toBe('2026-10-20'))
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
 const view = render(<TripPeriodEditor spaceId="trip-a" onSaved={saved} onCancel={cancelled}/>); mocks.get.mockResolvedValue({ ...entry, space: { ...entry.space, id: 'trip-b', endDate: '2026-10-30' } })
 view.rerender(<TripPeriodEditor spaceId="trip-b" onSaved={saved} onCancel={cancelled}/>); await screen.findByLabelText('Start date'); resolve(entry)
 await waitFor(() => expect((screen.getByLabelText('End date') as HTMLInputElement).value).toBe('2026-10-30'))
})
it('prevents duplicate saves and ignores completion after account changes', async () => {
 let resolve!: (value: number) => void; mocks.update.mockImplementation(() => new Promise(r => { resolve = r })); const view = await open(); dates()
 fireEvent.click(screen.getByRole('button', { name: 'Save dates' })); fireEvent.click(screen.getByRole('button', { name: 'Saving…' })); expect(mocks.update).toHaveBeenCalledTimes(1)
 mocks.identity = 'user-b'; view.rerender(<TripPeriodEditor spaceId="trip-a" onSaved={saved} onCancel={cancelled}/>); await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2)); resolve(8)
 await waitFor(() => expect(screen.queryByRole('button', { name: 'Saving…' })).toBeNull()); expect(saved).not.toHaveBeenCalled()
})
