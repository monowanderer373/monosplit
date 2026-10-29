import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { AmountView, SharedTab } from '../../lib/sharedAPresentation'
import './shared-a.css'

type IconName =
  | 'search' | 'plus' | 'chevron' | 'close' | 'down' | 'receive' | 'send'
  | 'review' | 'record' | 'people' | 'back' | 'more'

const paths: Record<IconName, string> = {
  search: 'M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14m5-2 6 6',
  plus: 'M12 4v16M4 12h16',
  chevron: 'm9 5 7 7-7 7',
  close: 'm5 5 14 14M5 19 19 5',
  down: 'm5 9 7 7 7-7',
  receive: 'M19 5 5 19M5 7v12h12',
  send: 'M5 19 14-14M7 5h12v12',
  review: 'M4 5h16v14H4zM5 6l7 6 7-6',
  record: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6m-6 4h6',
  people: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a6 6 0 0 1 12 0v3',
  back: 'm15 5-7 7 7 7',
  more: 'M5 12h.1M12 12h.1M19 12h.1',
}

export function SharedRoot({ children, as: Tag = 'section',spaceList=false }: { children: ReactNode; as?: 'section' | 'main';spaceList?:boolean }) {
  return <Tag className={'tt-shared-a'+(spaceList?' tt-shared-spaces':'')}><div className="ttsa-content">{children}</div></Tag>
}

export function SharedIcon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg className={`ttsa-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

export function IconButton({
  label, icon, onClick, disabled = false, expanded,
}: { label: string; icon: IconName; onClick: () => void; disabled?: boolean; expanded?: boolean }) {
  return (
    <button
      type="button"
      className="ttsa-icon-button"
      aria-label={label}
      {...(expanded === undefined ? {} : { 'aria-expanded': expanded })}
      onClick={onClick}
      disabled={disabled}
    >
      <SharedIcon name={icon} />
    </button>
  )
}

export function QuietAction({
  children, icon, onClick, disabled = false,focusId,
}: { children: ReactNode; icon: IconName; onClick: () => void; disabled?: boolean;focusId?:string }) {
  return (
    <button type="button" className="ttsa-action" data-space-focus={focusId} onClick={onClick} disabled={disabled}>
      <span className="ttsa-action-face">
        <SharedIcon name={icon} />
        {children}
      </span>
    </button>
  )
}

export function SharedHeader({
  title, addLabel, searchLabel, onSearch, onAdd,
}: {
  title: string
  addLabel: string
  searchLabel: string
  onSearch: () => void
  onAdd: () => void
}) {
  return (
    <header className="ttsa-header">
      <h1 className="ttsa-title">{title}</h1>
      <IconButton label={searchLabel} icon="search" onClick={onSearch} />
      {addLabel ? <QuietAction icon="plus" focusId="create" onClick={onAdd}>{addLabel}</QuietAction> : null}
    </header>
  )
}

export function ContextTabs({
  active, tabs, onChange, label,
}: {
  active: SharedTab
  tabs: readonly { id: SharedTab; label: string }[]
  onChange: (tab: SharedTab) => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} className="ttsa-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          className="ttsa-tab"
          role="tab"
          aria-selected={active === tab.id}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
            const next = delta
              ? (index + delta + tabs.length) % tabs.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (next < 0) return
            event.preventDefault()
            onChange(tabs[next].id)
            ;(ref.current?.children[next] as HTMLButtonElement | undefined)?.focus()
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function SearchField({
  query, onQuery, onCancel, label, cancelLabel, clearLabel, autoFocus=true,
}: {
  query: string
  autoFocus?: boolean
  onQuery: (value: string) => void
  onCancel: () => void
  label: string
  cancelLabel: string
  clearLabel: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if(autoFocus)ref.current?.focus() }, [autoFocus])
  return (
    <div className="ttsa-search">
      <div className="ttsa-search-field">
        <SharedIcon name="search" />
        <input
          ref={ref}
          type="search"
          aria-label={label}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') onCancel() }}
        />
        {query ? <IconButton label={clearLabel} icon="close" onClick={() => { onQuery(''); ref.current?.focus() }} /> : null}
      </div>
      <button type="button" className="ttsa-cancel" onClick={onCancel}>{cancelLabel}</button>
    </div>
  )
}

export function ReviewSummary({ count, label, onOpen }: { count: number; label: string; onOpen: () => void }) {
  if (count <= 0) return null
  return (
    <button type="button" className="ttsa-review-bar" onClick={onOpen}>
      <SharedIcon name="review" />
      <span>{label}</span>
      <span className="ttsa-spacer" />
      <span className="ttsa-count">{count}</span>
      <SharedIcon name="chevron" />
    </button>
  )
}

export function FilterControls({
  value, allLabel, balanceLabel, onChange, children,
}: {
  value: 'all' | 'balances'
  allLabel: string
  balanceLabel: string
  onChange: (value: 'all' | 'balances') => void
  children?: ReactNode
}) {
  return (
    <div className="ttsa-filters">
      {(['all', 'balances'] as const).map((item) => (
        <button type="button" key={item} className="ttsa-filter" aria-pressed={value === item} onClick={() => onChange(item)}>
          <span>{item === 'all' ? allLabel : balanceLabel}</span>
        </button>
      ))}
      {children}
    </div>
  )
}

export function CurrencyControl({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" className="ttsa-currency" onClick={onOpen}>
      {label}
      <SharedIcon name="down" />
    </button>
  )
}

export function Avatar({ name }: { name: string }) {
  return <span className="ttsa-avatar" aria-hidden="true">{Array.from(name.trim())[0] ?? '?'}</span>
}

export function AmountLabel({ view }: { view: AmountView }) {
  if (view.kind === 'amount') {
    return (
      <span className="ttsa-money">
        <span className="ttsa-amount">{view.amount}</span>
        <span className="ttsa-direction">{view.direction}</span>
      </span>
    )
  }
  if (view.kind === 'hidden' || view.kind === 'other' || view.kind === 'neutral' || view.kind === 'manual') {
    return view.status ? <span className="ttsa-money"><span className="ttsa-direction">{view.status}</span></span> : <span className="ttsa-money" />
  }
  return <span className="ttsa-money" />
}

export function PersonRow({
  name, meta, amount, onOpen, longLayout = false, label,
}: {
  name: string
  meta: string
  amount: AmountView
  onOpen: () => void
  longLayout?: boolean
  label?: string
}) {
  return (
    <li>
      <button type="button" className={`ttsa-row${longLayout ? ' is-long' : ''}`} data-testid="person-card" aria-label={label} onClick={onOpen}>
        <Avatar name={name} />
        <span>
          <span className="ttsa-row-name">{name}</span>
          {meta ? <span className="ttsa-meta">{meta}</span> : null}
        </span>
        <AmountLabel view={amount} />
        <SharedIcon name="chevron" className="ttsa-row-chevron" />
      </button>
    </li>
  )
}

export function PersonList({ children }: { children: ReactNode }) {
  return <ul className="ttsa-list">{children}</ul>
}

export function PaperSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`ttsa-paper ${className}`}>{children}</section>
}

export function BackControl({ label, onBack }: { label: string; onBack: () => void }) {
  return <QuietAction icon="back" onClick={onBack}>{label}</QuietAction>
}

export function PersonHeading({
  name, context, moreLabel, onMore,
}: { name: string; context: string; moreLabel: string; onMore: () => void }) {
  return (
    <header className="ttsa-person-header">
      <Avatar name={name} />
      <div className="ttsa-spacer">
        <h1>{name}</h1>
        <p className="ttsa-meta">{context}</p>
      </div>
      <IconButton label={moreLabel} icon="more" onClick={onMore} />
    </header>
  )
}

export function CompactBalanceCard({
  label, value, direction, actions,
}: { label: string; value: string; direction: string; actions?: ReactNode }) {
  return (
    <PaperSurface className="ttsa-balance">
      <p className="ttsa-label">{label}</p>
      <p className="ttsa-balance-value">{value}</p>
      <p className="ttsa-meta">{direction}</p>
      {actions ? <div className="ttsa-actions">{actions}</div> : null}
    </PaperSurface>
  )
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="ttsa-section-title">{children}</h2>
}

export function RecordRow({
  title, shareLabel, amount, date, onOpen,
}: { title: string; shareLabel: string; amount: string; date: string; onOpen: () => void }) {
  return (
    <button type="button" className="ttsa-record" onClick={onOpen}>
      <SharedIcon name="record" />
      <span>
        <span className="ttsa-record-name">{title}</span>
        <span className="ttsa-record-meta"><span>{shareLabel}</span><span>{amount}</span></span>
      </span>
      <span className="ttsa-record-date">{date}</span>
      <SharedIcon name="chevron" className="ttsa-row-chevron" />
    </button>
  )
}

export function ReviewRow({
  title, meta, actionLabel, onOpen,
}: { title: string; meta: string; actionLabel: string; onOpen: () => void }) {
  return (
    <button type="button" className="ttsa-review-row" onClick={onOpen}>
      <SharedIcon name="review" />
      <span>
        <strong>{title}</strong>
        <span className="ttsa-meta">{meta}</span>
      </span>
      <span className="ttsa-review-action">{actionLabel}</span>
      <SharedIcon name="chevron" className="ttsa-row-chevron" />
    </button>
  )
}

export function CenteredDialog({
  open, title, closeLabel, onClose, children,
}: {
  open: boolean
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="ttsa-dialog"
      aria-labelledby={id}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const box = event.currentTarget.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
      }}
    >
      <div className="ttsa-dialog-title">
        <h2 id={id}>{title}</h2>
        <IconButton label={closeLabel} icon="close" onClick={onClose} />
      </div>
      {children}
    </dialog>
  )
}

export function TextField({
  label, value, onChange, disabled = false,
}: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="ttsa-field">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  )
}

export function EmptyState({ title, help, action }: { title: string; help: string; action?: ReactNode }) {
  return (
    <section className="ttsa-state">
      <h2>{title}</h2>
      <p>{help}</p>
      {action}
    </section>
  )
}

export function ErrorState({
  title, help, retryLabel, onRetry,
}: { title: string; help: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState title={title} help={help} action={<QuietAction icon="review" onClick={onRetry}>{retryLabel}</QuietAction>} />
    </div>
  )
}

export function SkeletonList({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="ttsa-row" aria-hidden="true">
          <span className="ttsa-avatar" />
          <span><span className="ttsa-skeleton" /><span className="ttsa-skeleton" /></span>
          <span /><span />
        </div>
      ))}
    </div>
  )
}

export function OfflineNotice({ label }: { label: string }) {
  return <p className="ttsa-notice" role="status"><SharedIcon name="review" />{label}</p>
}

export function SpaceRow({
  name, meta, status, onOpen, focusId,
}: { name: string; meta: string; status: string; onOpen: () => void; focusId?: string }) {
  return (
    <button type="button" className="ttsa-record" data-space-focus={focusId} onClick={onOpen}>
      <SharedIcon name="people" />
      <span>
        <strong className="ttsa-record-name">{name}</strong>
        <span className="ttsa-meta">{meta}</span>
        <span className="ttsa-meta">{status}</span>
      </span>
      <span />
      <SharedIcon name="chevron" className="ttsa-row-chevron" />
    </button>
  )
}

export function Disclosure({ label, children, defaultOpen = false }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      className="ttsa-disclosure"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{label}</summary>
      {children}
    </details>
  )
}
