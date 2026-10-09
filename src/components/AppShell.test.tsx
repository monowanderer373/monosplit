/** @vitest-environment jsdom */
import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import AppShell from './AppShell'
import { useStore } from '../store/useStore'

const mocks = vi.hoisted(() => ({ open: vi.fn(), pageTarget: null as null | {pathname:string; ready:boolean; target:{kind:'personal'}|{kind:'space-candidate';spaceId:string}} }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ authUser: {
  id: 'account', participantId: 'participant', displayName: 'Dav', defaultCurrency: 'MYR', isAnonymous: false,
} }) }))
vi.mock('../hooks/usePersonalLedger', () => ({ PersonalLedgerProvider: ({ children }: { children: ReactNode }) => children }))
vi.mock('../hooks/useUniversalQuickAdd', () => ({
  UniversalQuickAddProvider: ({ children }: { children: ReactNode }) => children,
  useUniversalQuickAdd: () => ({ action: null, feedback: null, open: mocks.open, pageTarget: mocks.pageTarget }),
}))
vi.mock('./GlobalMoneyActionHost', () => ({ default: () => null }))
vi.mock('./GlobalMoneyAction', () => ({ default: ({onAdd,disabled}:{onAdd:()=>void;disabled?:boolean}) => <button onClick={onAdd} disabled={disabled}>Quick Add</button> }))
vi.mock('./BottomNavigation', () => ({ default: () => null }))
afterEach(() => { cleanup(); mocks.open.mockReset(); mocks.pageTarget=null; useStore.getState().setHomeUi({mode:'daily'}) })

it('opens the shortcut once per entry, including another entry after returning to Daily', async () => {
  const router = createMemoryRouter([{ element: <AppShell />, children: [
    { path: '/', element: <p>Daily</p> },
    { path: '/quick-add', element: <p>Shortcut</p> },
  ] }], { initialEntries: ['/quick-add?source=pwa-shortcut'] })
  const { rerender } = render(<RouterProvider router={router} />)
  await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1))
  rerender(<RouterProvider router={router} />)
  expect(mocks.open).toHaveBeenCalledTimes(1)
  await act(() => router.navigate('/'))
  await act(() => router.navigate('/quick-add?source=pwa-shortcut'))
  await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(2))
  expect(mocks.open.mock.calls[1][0]).toMatchObject({
    directDeepLink: true, context: { ref: { kind: 'personal' }, currentParticipantId: 'participant' },
  })
  router.dispose()
})

for(const [path,target] of [['/space/group-a','group-a'],['/travel/trip/trip-a','trip-a']]) it(`uses the ledger of ${path}`,()=>{
 const router=createMemoryRouter([{element:<AppShell/>,children:[{path,element:<p>Detail</p>}]}],{initialEntries:[path]})
 render(<RouterProvider router={router}/>);fireEvent.click(screen.getByText('Quick Add'))
 expect(mocks.open).toHaveBeenCalledWith({entryPoint:'global',spaceCandidateId:target,followPageContext:true});router.dispose()
})
it('uses the displayed Travel trip and blocks opening until the page is ready',async()=>{
 useStore.getState().setHomeUi({mode:'travel'})
 const router=createMemoryRouter([{element:<AppShell/>,children:[{path:'/',element:<p>Travel</p>}]}],{initialEntries:['/']})
 const result=render(<RouterProvider router={router}/>);fireEvent.click(screen.getByText('Quick Add'));expect(mocks.open).not.toHaveBeenCalled()
 mocks.pageTarget={pathname:'/',ready:true,target:{kind:'space-candidate',spaceId:'displayed-trip'}}
 result.rerender(<RouterProvider router={router}/>);await act(async()=>router.navigate('/?refresh=1'))
 fireEvent.click(screen.getByText('Quick Add'));expect(mocks.open).toHaveBeenCalledWith({entryPoint:'global',spaceCandidateId:'displayed-trip',followPageContext:true});router.dispose()
})
