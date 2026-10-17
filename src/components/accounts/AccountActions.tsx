import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MoneyDialog from './MoneyDialog'
import { useT } from '../../lib/i18n'

export default function AccountActions({accountId}:{accountId:string}){
 const [open,setOpen]=useState(false),t=useT(),navigate=useNavigate()
 const go=(path:string)=>{setOpen(false);navigate(path)}
 return <><button type="button" className="ttmc-more" aria-label={t('mc.account.moreActions')} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>⋯</button>
  {open?<MoneyDialog title={t('mc.account.moreActions')} onClose={()=>setOpen(false)} testId="account-actions">
   <div className="ttmc-module ttmc-actions"><button onClick={()=>go(`/accounts/move/transfer?from=${encodeURIComponent(accountId)}`)}>{t('mc.move.transfer')}</button><button onClick={()=>go(`/accounts/move/exchange?from=${encodeURIComponent(accountId)}`)}>{t('mc.move.exchange')}</button><button onClick={()=>go(accountId==='all'?'/accounts':`/accounts/${encodeURIComponent(accountId)}`)}>{t('mc.account.view')}</button></div>
  </MoneyDialog>:null}
 </>
}
