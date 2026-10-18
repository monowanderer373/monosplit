/** @vitest-environment jsdom */
import {render,screen,cleanup,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import AccountNotice from './AccountNotice'
import {buildHomeNotifications} from '../../lib/homeNotifications'
import {funding,noticeExpense,noticeSnapshot} from '../../test/notificationFixtures'
import {useStore} from '../../store/useStore'
afterEach(cleanup);beforeEach(()=>useStore.setState({lang:'en'}))
describe('paper notification interactions',()=>{
 it('has full-row semantic actions with distinct record context, independent unread and pending counters; close never clears tasks',async()=>{
  const user=userEvent.setup(),notices=buildHomeNotifications(noticeSnapshot(),[]),onAction=vi.fn(),unread=new Set(notices.map(n=>n.id))
  const {rerender}=render(<AccountNotice notices={notices} unread={unread} onAction={onAction}/>)
  const bell=screen.getByTestId('home-account-notice');expect(bell.getAttribute('aria-label')).toContain('2 to do');await user.click(bell)
  const one=screen.getByRole('button',{name:/Train ticket/}),two=screen.getByRole('button',{name:/Dinner with friends/});expect(one).not.toBe(two);expect(one.querySelector('button,a,input')).toBeNull()
  await user.click(one);expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ref:{kind:'funding',id:'fund-1'}}));expect(screen.queryByRole('dialog')).toBeNull()
  rerender(<AccountNotice notices={notices} unread={new Set()} onAction={onAction}/>);expect(bell.getAttribute('aria-label')).toContain('2 to do');expect(bell.querySelector('.home-account-notice-dot')).toBeNull()
  await user.click(bell);expect(screen.queryByRole('button',{name:'Close'})).toBeNull();expect(screen.queryByRole('heading',{name:'Notifications'})).toBeNull();await user.keyboard('{Escape}');expect(bell.getAttribute('aria-label')).toContain('2 to do');expect(bell).toBe(document.activeElement)
 })
 it('separates information from tasks and exposes retry on failure rather than an empty-complete claim',async()=>{
  const user=userEvent.setup(),onRetry=vi.fn();render(<AccountNotice notices={buildHomeNotifications(noticeSnapshot(),[])} status="error" onRetry={onRetry}/>)
  await user.click(screen.getByTestId('home-account-notice'));expect(screen.getByRole('alert').textContent).toContain('not been cleared');await user.click(screen.getByRole('button',{name:'Retry'}));expect(onRetry).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('tab',{name:'Activity'}));expect(screen.getByRole('tabpanel').textContent).toContain('Touch n Go');expect(screen.getByRole('tabpanel').textContent).not.toContain('Train ticket')
  await user.keyboard('{ArrowLeft}');expect(screen.getByRole('tab',{name:/^To do/}).getAttribute('aria-selected')).toBe('true');await user.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull()
 })
 it('retains real task identity in Chinese and shows genuine empty states',async()=>{
  useStore.setState({lang:'zh'});const user=userEvent.setup();render(<AccountNotice/>)
  await user.click(screen.getByTestId('home-account-notice'));expect(within(screen.getByRole('tabpanel')).getByText('目前没有待处理事项。')).toBeTruthy();await user.click(screen.getByRole('tab',{name:'动态'}));expect(screen.getByText('暂无近期动态。')).toBeTruthy()
 })
 it('does not cancel the original resolver when a task is opened',async()=>{
  const user=userEvent.setup(),onAction=vi.fn(),onDismiss=vi.fn()
  render(<AccountNotice notices={buildHomeNotifications(noticeSnapshot(),[])} onAction={onAction} onDismiss={onDismiss}/>)
  await user.click(screen.getByTestId('home-account-notice'))
  await user.click(screen.getByRole('button',{name:/Train ticket/}))
  expect(onAction).toHaveBeenCalledTimes(1)
  expect(onDismiss).not.toHaveBeenCalled()
 })
 it('previews three tasks then reveals the rest from the same host',async()=>{
  const user=userEvent.setup()
  const snapshot=noticeSnapshot()
  snapshot.expenses.push(noticeExpense('expense-3','Taxi'),noticeExpense('expense-4','Coffee'))
  snapshot.funding.push(funding('fund-3','expense-3'),funding('fund-4','expense-4'))
  render(<AccountNotice notices={buildHomeNotifications(snapshot,[])}/>)
  await user.click(screen.getByTestId('home-account-notice'))
  expect(screen.getByTestId('home-account-notice').getAttribute('aria-label')).toContain('4 to do')
  expect(screen.getByTestId('home-notice-popover').querySelectorAll('[data-notice-id]')).toHaveLength(3)
  await user.click(screen.getByTestId('home-notice-view-all'))
  expect(screen.getByTestId('home-notice-popover').querySelectorAll('[data-notice-id]')).toHaveLength(4)
 })
})
