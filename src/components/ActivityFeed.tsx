import { useEffect, useState } from 'react'
import {
  listFinancialActivity,
  type FinancialActivity,
} from '../lib/activityRepository'
import { activityEventKey, friendlyErrorKey, useT, type TranslationKey } from '../lib/i18n'
import { formatDateTime } from '../lib/locale'
import { useStore } from '../store/useStore'

type Props = {
  spaceId?: string
  expenseIds?: readonly string[]
  settlementIds?: readonly string[]
  refreshKey?: string
  pageable?: boolean
}

export default function ActivityFeed({
  spaceId,
  expenseIds = [],
  settlementIds = [],
  refreshKey = '', pageable=false,
}: Props) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const [activity, setActivity] = useState<FinancialActivity[]>([])
  const [loading,setLoading]=useState(true),[limit,setLimit]=useState(20),[retry,setRetry]=useState(0)
  const [error, setError] = useState<TranslationKey | ''>('')
  const expenseIdKey = expenseIds.join(':')
  const settlementIdKey = settlementIds.join(':')

  useEffect(() => {
    let active = true
    queueMicrotask(()=>{if(active)setLoading(true)})
    void listFinancialActivity({
      spaceId,
      expenseIds: expenseIdKey ? expenseIdKey.split(':') : [],
      settlementIds: settlementIdKey ? settlementIdKey.split(':') : [],
      limit: 80, all:pageable,
    })
      .then((events) => {
        if (!active) return
        setActivity(pageable?events:events.slice(0, 12))
        setError('')
      })
      .catch((cause) => {
        if (!active) return
        setError(friendlyErrorKey(cause))
      }).finally(()=>{if(active)setLoading(false)})
    return () => {
      active = false
    }
  }, [expenseIdKey, refreshKey, settlementIdKey, spaceId,pageable,retry])

  return (
    <section data-testid="financial-activity">
      <p className="ms-label">{t('activity.label')}</p>
      <h2 className="mt-1 text-xl font-extrabold">{t('activity.title')}</h2>
      {error ? <p role="alert" className="mt-2 text-xs text-[var(--ms-danger)]">{t(error)}{pageable?<button type="button" className="ms-btn-ghost" onClick={()=>setRetry(n=>n+1)}>{t('common.retry')}</button>:null}</p> : null}
      <div className="ms-list tt-paper-list mt-3">
        {loading&&activity.length===0?<p role="status" className="p-5">{t('common.loading')}</p>:error&&activity.length===0?null:activity.length === 0 ? (
          <p className="p-5 text-center text-sm text-[var(--ms-text-muted)]">{t('activity.empty')}</p>
        ) : activity.slice(0,pageable?limit:activity.length).map((event, index) => (
          <div key={event.id}>
            {index > 0 ? <hr className="ms-divider" /> : null}
            <article className="ms-row tt-record-card">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{t(activityEventKey(event.eventType))}</p>
                <p className="mt-1 text-xs text-[var(--ms-text-muted)]">{formatDateTime(event.createdAt, lang)}</p>
              </div>
            </article>
          </div>
        ))}
      </div>
      {pageable&&activity.length>limit?<button type="button" className="ms-btn-ghost" onClick={()=>setLimit(n=>n+20)}>{t('tl.more')}</button>:null}
    </section>
  )
}
