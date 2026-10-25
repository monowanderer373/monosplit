import './notifications-a.css'
import './compact-home.css'
import QuickIcon from '../QuickIcon'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import { formatDate } from '../../lib/locale'
import { noticeCalendarDate, type HomeNotification } from '../../lib/homeNotifications'
import { saveNoticeOrigin, takeNoticeOrigin, type NoticeOrigin } from '../../lib/notificationPresentation'
import {
  previewItems,
  readSafeInsets,
  realTaskCount,
  rightPopupGeometry,
  shouldCancelNavigation,
  type NoticeCloseReason,
  type PopupPlacement,
} from '../../lib/noticePopoverGeometry'
import { createPopoverMotion, type PopoverMotion } from '../../lib/noticePopoverMotion'

export default function AccountNotice({
  identity,
  targetOpen = false,
  timezone = 'Asia/Kuala_Lumpur',
  notices = [],
  status = 'ready',
  unread = new Set<string>(),
  onAction,
  onRetry,
  onDismiss,
  onViewed,
}: {
  identity?: string
  targetOpen?: boolean
  timezone?: string
  notices?: readonly HomeNotification[]
  status?: 'loading' | 'ready' | 'error'
  unread?: ReadonlySet<string>
  onAction?: (notice: HomeNotification) => void
  onRetry?: () => unknown
  onDismiss?: () => void
  onViewed?: (notices: readonly HomeNotification[]) => void
}) {
  const hidden = useStore(s => s.homeUi.balanceHidden)
  const lang = useStore(s => s.lang)
  const t = useT()
  const [open, setOpen] = useState(false)
  const [present, setPresent] = useState(false)
  const [fullView, setFullView] = useState(false)
  const [tab, setTab] = useState<'tasks' | 'activity'>('tasks')
  const [place, setPlace] = useState<PopupPlacement>({ mode: 'closed' })
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const motion = useRef<PopoverMotion | null>(null)
  const naturalHeight = useRef(160)
  const restore = useRef<NoticeOrigin | null>(null)
  const navigating = useRef(false)
  const id = useId()
  const identityKey = identity ?? 'anon'
  const previousIdentity = useRef(identityKey)
  const pending = realTaskCount(notices)
  const unreadCount = notices.filter(n => unread.has(n.id)).reduce((count, n) => count + (n.taskCount ?? 1), 0)
  const visible = notices.filter(n => n.tab === tab)
  const preview = fullView ? { items: [...visible], hasMore: false, totalRows: visible.length } : previewItems(visible)
  const countLabel = !notices.length && status !== 'ready'
    ? t(status === 'loading' ? 'home.loading' : 'home.unavailable')
    : t('notice.count', { count: pending })

  const requestClose = (reason: NoticeCloseReason) => {
    if (shouldCancelNavigation(reason)) onDismiss?.()
    if (reason === 'identity' || reason === 'route' || reason === 'anchor-hidden') {
      motion.current?.dispose()
      setOpen(false)
      setPresent(false)
      setFullView(false)
      return
    }
    setOpen(false)
  }

  useEffect(() => {
    if (!identity || targetOpen) return
    const origin = takeNoticeOrigin(identity)
    if (origin) {
      restore.current = origin
      setTab(origin.tab)
      setFullView(true)
      setOpen(true)
      setPresent(true)
    }
  }, [identity, targetOpen])

  useEffect(() => {
    if (!targetOpen) return
    if (navigating.current) {
      navigating.current = false
      motion.current?.dispose()
      setOpen(false)
      setPresent(false)
      setFullView(false)
      return
    }
    requestClose('route')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOpen])

  useEffect(() => {
    if (previousIdentity.current === identityKey) return
    previousIdentity.current = identityKey
    motion.current?.dispose()
    setOpen(false)
    setPresent(false)
    setFullView(false)
  }, [identityKey])

  useLayoutEffect(() => {
    if (open) setPresent(true)
  }, [open])

  // Viewing the tray acknowledges its current versions, never completes a task.
  // Wait for a real visible, successfully loaded panel, including a slow first load.
  useEffect(() => {
    if (open && present && place.mode !== 'closed' && status === 'ready' && unreadCount) {
      onViewed?.(notices.filter(n => unread.has(n.id)))
    }
  }, [open, present, place.mode, status, unreadCount, unread, notices, onViewed])

  useLayoutEffect(() => {
    if (!present || !panel.current) return
    const node = panel.current
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    motion.current = createPopoverMotion(node, { reduced, onHidden: () => { setPresent(false); setFullView(false) } })
    return () => {
      motion.current?.dispose()
      motion.current = null
    }
  }, [present, identityKey])

  useLayoutEffect(() => {
    if (!present || !panel.current || !trigger.current) return
    const fit = () => {
      const anchor = trigger.current
      const node = panel.current
      if (!anchor || !node) {
        requestClose('anchor-hidden')
        return
      }
      const box = anchor.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) {
        setPlace({ mode: 'popover', left: 72, top: 16, width: 240, maxHeight: 480, origin: '0px 20px' })
        return
      }
      const viewportApi = window.visualViewport
      const root = document.documentElement
      const frameEl = document.querySelector<HTMLElement>('.home-frame') ?? document.getElementById('root')
      const frameBox = frameEl?.getBoundingClientRect()
      if (node.dataset.mode !== 'summary') naturalHeight.current = Math.max(node.scrollHeight, node.offsetHeight)
      const next = rightPopupGeometry({
        anchor: { left: box.left, right: box.right, top: box.top,
          bottom: Math.max(box.bottom, anchor.closest('header')?.getBoundingClientRect().bottom ?? box.bottom) },
        viewport: {
          left: viewportApi?.offsetLeft ?? 0,
          top: viewportApi?.offsetTop ?? 0,
          width: viewportApi?.width ?? root.clientWidth,
          height: viewportApi?.height ?? root.clientHeight,
        },
        frame: frameBox ? { left: frameBox.left, right: frameBox.right } : undefined,
        panelHeight: fullView ? 0 : naturalHeight.current,
        safe: readSafeInsets(),
        bottomReserve: 96,
      })
      if (next.mode === 'closed') {
        requestClose('anchor-hidden')
        return
      }
      setPlace(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
    }
    fit()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    observer?.observe(panel.current)
    observer?.observe(trigger.current)
    window.addEventListener('resize', fit)
    window.addEventListener('scroll', fit, true)
    window.visualViewport?.addEventListener('resize', fit)
    window.visualViewport?.addEventListener('scroll', fit)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', fit)
      window.removeEventListener('scroll', fit, true)
      window.visualViewport?.removeEventListener('resize', fit)
      window.visualViewport?.removeEventListener('scroll', fit)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, identityKey, visible.length, status, tab, fullView])

  useLayoutEffect(() => {
    if (!present) return
    if (open && place.mode !== 'closed') motion.current?.show()
    else if (!open) motion.current?.hide()
  }, [open, present, place.mode])

  useLayoutEffect(() => {
    if (!open || !restore.current || status !== 'ready' || !present) return
    const origin = restore.current
    const frame = requestAnimationFrame(() => {
      const list = panel.current?.querySelector<HTMLElement>('.home-notice-list')
      if (list) list.scrollTop = origin.scrollTop
      window.scrollTo({ top: origin.pageScroll, behavior: 'instant' })
      const row = [...panel.current?.querySelectorAll<HTMLElement>('[data-notice-id]') ?? []].find(r => r.dataset.noticeId === origin.rowId)
      ;(row ?? panel.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? trigger.current)?.focus({ preventScroll: true })
      restore.current = null
    })
    return () => cancelAnimationFrame(frame)
  }, [open, present, tab, status, notices, fullView])

  useEffect(() => {
    if (!present || !open) return
    const selected = document.getElementById(`${id}-${tab}`)
    selected?.focus({ preventScroll: true })
    const outside = (event: PointerEvent | FocusEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return
      if (event.type === 'pointerdown') {
        event.preventDefault()
        event.stopPropagation()
      }
      requestClose('outside')
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      requestClose('escape')
      trigger.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, open, id, tab])

  const openItem = (notice: HomeNotification) => {
    if (identity) {
      saveNoticeOrigin(identity, {
        tab,
        scrollTop: panel.current?.querySelector('.home-notice-list')?.scrollTop ?? 0,
        rowId: notice.id,
        pageScroll: window.scrollY,
      })
    }
    navigating.current = true
    requestClose('navigate')
    onAction?.(notice)
  }

  const titleFor = (notice: HomeNotification) => {
    if (notice.fundingGroup) return t('mc.verify.group', { account: notice.relatedAccountName || t('mc.verify.unassigned'), count: notice.taskCount ?? 1 })
    if (notice.ref.kind === 'account') return t('noticeA.account.negative')
    return hidden ? t(notice.title) : notice.description || t(notice.title)
  }

  const position = place.mode === 'closed'
    ? { visibility: 'hidden' as const }
    : { left: place.left, top: place.top, width: place.width, maxHeight: place.maxHeight, transformOrigin: place.origin }

  return (
    <div className="home-notice-anchor ttc-ui">
      <button
        ref={trigger}
        type="button"
        className="home-account-notice ttc-bell"
        data-testid="home-account-notice"
        aria-label={`${t('notice.title')} · ${countLabel}${unreadCount ? ` · ${t('notice.unreadCount', { count: unreadCount })}` : ''}`}
        title={t('notice.title')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={present ? id : undefined}
        onClick={() => open ? requestClose('toggle') : (setOpen(true), setPresent(true))}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4M12 2v2"/></svg>
        {unreadCount > 0 ? <span className="home-notice-count ttc-bell-count" aria-hidden="true">{unreadCount > 10 ? '…' : unreadCount}</span> : null}
      </button>
      {present && typeof document !== 'undefined' ? createPortal(
          <section
            ref={panel}
            id={id}
            role="dialog"
            aria-modal="false"
            aria-label={t('notice.title')}
            tabIndex={-1}
            className="home-notice-popover ttc-ui ttc-popover"
            data-testid="home-notice-popover"
            data-mode={place.mode}
            style={position}
          >
            {place.mode === 'summary' && !fullView ? (
              <button type="button" className="ttc-quiet" data-testid="home-notice-view-all" onClick={() => setFullView(true)}>{t('notice.viewAll')}<span aria-hidden="true">›</span></button>
            ) : (
              <>
                <div role="tablist" aria-label={t('notice.title')} className="home-notice-tabs ttc-tabs">
                  {(['tasks', 'activity'] as const).map((key, index) => (
                    <button
                      type="button"
                      key={key}
                      role="tab"
                      id={`${id}-${key}`}
                      className="ttc-tab"
                      aria-controls={`${id}-list`}
                      aria-selected={tab === key}
                      tabIndex={tab === key ? 0 : -1}
                      onClick={() => setTab(key)}
                      onKeyDown={event => {
                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                        event.preventDefault()
                        const next = index === 0 ? 'activity' : 'tasks'
                        setTab(next)
                        document.getElementById(`${id}-${next}`)?.focus()
                      }}
                    >
                      {t(key === 'tasks' ? 'notice.tasks' : 'notice.activity')}{key === 'tasks' && (status === 'ready' || notices.length > 0) ? ` ${pending}` : ''}
                    </button>
                  ))}
                </div>
                {status === 'loading' && !visible.length ? <p role="status" className="home-notice-message ttc-message">{t('home.loading')}</p> : null}
                {status === 'error' ? (
                  <div role="alert" className="home-notice-message">
                    <p>{t('notice.error')}</p>
                    <button type="button" className="home-notice-retry ttc-quiet" onClick={() => void onRetry?.()}>{t('common.retry')}</button>
                  </div>
                ) : null}
                <div role="tabpanel" id={`${id}-list`} aria-labelledby={`${id}-${tab}`} tabIndex={0} className="home-notice-list">
                  {!visible.length && status === 'ready' ? <p className="home-notice-message ttc-message">{t(tab === 'tasks' ? 'notice.noTasks' : 'notice.noActivity')}</p> : null}
                  <ul className="ttc-list">
                    {preview.items.map(notice => {
                      const dateLabel = notice.date ? formatDate(noticeCalendarDate(notice.date, timezone), lang) : ''
                      const accountLabel = notice.relatedAccountName || notice.contextLabel || t(notice.ref.kind === 'funding' ? 'noticeA.funding.noAccount' : notice.scope.kind === 'personal' ? 'home.chipPersonal' : 'home.chipDirect')
                      const title = titleFor(notice)
                      return (
                        <li key={notice.id}>
                          <button
                            type="button"
                            className="home-notice-row ttc-item"
                            data-notice-id={notice.id}
                            data-unread={unread.has(notice.id)}
                            aria-description={unread.has(notice.id) ? t('notice.unread') : undefined}
                            onClick={() => openItem(notice)}
                          >
                            <span className="home-notice-icon ttc-item-icon" aria-hidden="true">
                              <QuickIcon name={notice.tab === 'activity' && notice.state === 'completed' ? 'check' : ({ Drinks: 'Drink', transport: 'Transport', Transportation: 'Transport' } as Record<string, string>)[notice.icon ?? ''] ?? notice.icon ?? 'Bills'} size={14} />
                            </span>
                            <span className="home-notice-copy">
                              <span className="home-notice-headline ttc-item-title"><strong>{title}</strong>{unread.has(notice.id) ? <span className="home-notice-new" aria-hidden="true">•</span> : null}</span>
                              <span className="home-notice-metadata ttc-item-meta">
                                {notice.date ? <time dateTime={noticeCalendarDate(notice.date, timezone)}>{dateLabel}</time> : null}
                                {notice.date ? <span aria-hidden="true"> · </span> : null}
                                <span>{accountLabel}</span>
                              </span>
                            </span>
                            <span aria-hidden="true" className="home-notice-arrow ttc-chevron">›</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {preview.hasMore ? (
                    <button type="button" className="ttc-quiet" data-testid="home-notice-view-all" onClick={() => setFullView(true)}>
                      {t('notice.viewAll')}<span aria-hidden="true">›</span>
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </section>,
        document.body,
      ) : null}
    </div>
  )
}
