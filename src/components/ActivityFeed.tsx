import { useEffect, useMemo, useState } from 'react'
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
}

export default function ActivityFeed({
  spaceId,
  expenseIds = [],
  settlementIds = [],
  refreshKey = '',
}: Props) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const [activity, setActivity] = useState<FinancialActivity[]>([])
  const [error, setError] = useState<TranslationKey | ''>('')
  const expenseIdKey = expenseIds.join(':')
  const settlementIdKey = settlementIds.join(':')
  const expenseIdSet = useMemo(
    () => new Set(expenseIdKey ? expenseIdKey.split(':') : []),
    [expenseIdKey],
  )
  const settlementIdSet = useMemo(
    () => new Set(settlementIdKey ? settlementIdKey.split(':') : []),
    [settlementIdKey],
  )

  useEffect(() => {
    let active = true
    void listFinancialActivity(80)
      .then((events) => {
        if (!active) return
        setActivity(events.filter((event) => (
          (spaceId != null && event.spaceId === spaceId)
          || (event.expenseId != null && expenseIdSet.has(event.expenseId))
          || (event.settlementPaymentId != null && settlementIdSet.has(event.settlementPaymentId))
        )).slice(0, 12))
        setError('')
      })
      .catch((cause) => {
        if (!active) return
        setError(friendlyErrorKey(cause))
      })
    return () => {
      active = false
    }
  }, [expenseIdSet, refreshKey, settlementIdSet, spaceId])

  return (
    <section>
      <p className="ms-label">{t('activity.label')}</p>
      <h2 className="mt-1 text-xl font-extrabold">{t('activity.title')}</h2>
      {error ? <p className="mt-2 text-xs text-[var(--ms-danger)]">{t(error)}</p> : null}
      <div className="ms-list mt-3">
        {activity.length === 0 ? (
          <p className="p-5 text-center text-sm text-[var(--ms-text-muted)]">{t('activity.empty')}</p>
        ) : activity.map((event, index) => (
          <div key={event.id}>
            {index > 0 ? <hr className="ms-divider" /> : null}
            <article className="ms-row">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{t(activityEventKey(event.eventType))}</p>
                <p className="mt-1 text-xs text-[var(--ms-text-muted)]">{formatDateTime(event.createdAt, lang)}</p>
              </div>
            </article>
          </div>
        ))}
      </div>
    </section>
  )
}
