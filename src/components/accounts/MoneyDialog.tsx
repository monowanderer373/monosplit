import { useEffect, type ComponentProps } from 'react'
import { HomeSheet } from '../home/HomeScreen'
import '../home/home.css'

type Props=Omit<ComponentProps<typeof HomeSheet>,'presentation'|'className'>
/** The existing accessible primitive, including its styles on a direct account URL. */
export default function MoneyDialog(props:Props){
 useEffect(()=>{
  const node=document.querySelector<HTMLElement>(`[data-testid="${props.testId}-backdrop"]`)
  const fit=()=>{const viewport=window.visualViewport;if(!node||!viewport)return
   node.style.top=`${viewport.offsetTop}px`;node.style.left=`${viewport.offsetLeft}px`;node.style.width=`${viewport.width}px`;node.style.height=`${viewport.height}px`;node.style.setProperty('--ttmc-viewport-height',`${viewport.height}px`)
  }
  fit();window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit)
  return()=>{window.visualViewport?.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('scroll',fit)}
 },[props.testId])
 return <HomeSheet {...props} presentation="dialog" className="ttmc-dialog"/>
}
