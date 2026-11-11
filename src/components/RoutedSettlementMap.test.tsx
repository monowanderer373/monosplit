// @vitest-environment jsdom
import {cleanup,fireEvent,render} from '@testing-library/react'
import {afterEach,expect,it} from 'vitest'
import {RoutedAvatar} from './RoutedSettlementMap'
afterEach(cleanup)
it('replaces a failed image with a Unicode initial and accepts a different available image',()=>{
 const view=render(<RoutedAvatar person={{id:'recipient',name:'  李 Alex',avatarUrl:'https://example.test/first.png'}}/>),image=view.container.querySelector('img')!
 expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');fireEvent.error(image);expect(view.container.querySelector('img')).toBeNull();expect(view.container.textContent).toBe('李')
 view.rerender(<RoutedAvatar person={{id:'recipient',name:'Alex',avatarUrl:'https://example.test/second.png'}}/>);expect(view.container.querySelector('img')?.getAttribute('src')).toBe('https://example.test/second.png')
})
