import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../lib/i18n'

export default function MovementRecordAction({id,trigger,triggerClassName,contextLabel}:{id:string;trigger?:ReactNode;triggerClassName?:string;contextLabel?:string}){
 const navigate=useNavigate(),t=useT()
 return <button type="button" className={triggerClassName??'ttmc-link'} aria-label={[t('mc.move.review'),contextLabel].filter(Boolean).join(' · ')} onClick={()=>navigate(`/accounts/movements/${encodeURIComponent(id)}`)}>{trigger??<span className="home-sr">{t('mc.move.review')}</span>}</button>
}
