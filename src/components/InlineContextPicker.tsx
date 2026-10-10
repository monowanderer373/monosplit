import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { MoneyContextRef } from '../lib/moneyContext'
import { EMPTY_MONEY_CONTEXT_CATALOG, loadMoneyContextCatalog, type MoneyContextCatalog } from '../lib/moneyContextCatalog'
import type { CanonicalExpense } from '../types'
import type { UniversalQuickAddSession } from '../lib/universalQuickAdd'
import { todayIso } from '../lib/universalQuickAdd'

export function ContextIcon({ name }: { name: string }) {
 return <svg className="qa-icon" viewBox="0 0 24 24" aria-hidden="true"><use href={`/assets/quick-add-context/quickadd-icons.svg#${name}`}/></svg>
}
type BrowseType = 'personal' | 'trips' | 'groups' | 'friends'
type Candidate = { ref: MoneyContextRef; ids?: string[]; friends?: boolean }
export type InlineCommit = (ref: MoneyContextRef, ids?: string[], draftChoice?: 'resume' | 'move') => Promise<{ ok: boolean; session?: UniversalQuickAddSession; error?: 'unavailable' | 'network' | 'draft-conflict' | 'cancelled' }>
function sameTarget(a: MoneyContextRef, b: MoneyContextRef) {
 return a.kind === b.kind && (a.kind === 'personal' || (a.kind === 'space' && b.kind === 'space' && a.spaceId === b.spaceId) || (a.kind === 'person' && b.kind === 'person' && a.personId === b.personId))
}
export default function InlineContextPicker({ session, expenses, zh, onCommit, onCommitted, onCancel }: {
 session: UniversalQuickAddSession; expenses: CanonicalExpense[]; zh: boolean; onCommit: InlineCommit
 onCommitted: (session: UniversalQuickAddSession, friends: boolean) => void; onCancel: () => void
}) {
 const { authUser } = useAuth()
 const context = session.context!
 const copy = (en: string, cn: string) => zh ? cn : en
 const [browse, setBrowse] = useState<BrowseType>(() => context.ref.kind === 'space' ? context.ref.spaceType === 'trip' ? 'trips' : 'groups' : context.ref.kind === 'person' ? 'friends' : 'personal')
 const [pendingIds, setPendingIds] = useState<string[]>(() => context.ref.kind === 'person' ? session.values.selectedParticipantIds.filter(id => id !== context.currentParticipantId) : [])
 const [query, setQuery] = useState('')
 const [more, setMore] = useState(false)
 const [catalog, setCatalog] = useState<MoneyContextCatalog>(EMPTY_MONEY_CONTEXT_CATALOG)
 const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
 const [retry, setRetry] = useState(0)
 const [busy, setBusy] = useState(false)
 const busyRef = useRef(false)
 const [error, setError] = useState('')
 const [candidate, setCandidate] = useState<Candidate | null>(null)
 const [conflict, setConflict] = useState(false)
 const alive = useRef(true)
 useEffect(() => {
  alive.current = true
  let active = true
  void loadMoneyContextCatalog({ isAnonymous: Boolean(authUser?.isAnonymous), includeDetails: true }).then(rows => {
   if (!active) return
   setCatalog(rows); setStatus('ready')
  }).catch(() => { if (active) setStatus('error') })
  return () => { active = false; alive.current = false }
 }, [session.identityKey, authUser?.isAnonymous, retry])
 const labels = { personal: copy('Personal', '个人'), trips: copy('Trips', '旅行'), groups: copy('Groups', '群组'), friends: copy('Friends', '朋友') }
 const placeholder = browse === 'trips' ? copy('Find a trip…', '搜索旅行…') : browse === 'groups' ? copy('Find a group…', '搜索群组…') : copy('Find a friend…', '搜索朋友…')
 const changeBrowse = (next: BrowseType) => { setBrowse(next); setQuery(''); setMore(false); setCandidate(null); setConflict(false); setError('') }
 const tabKeys = (event: KeyboardEvent<HTMLButtonElement>, current: BrowseType) => {
  const types = ['personal', 'trips', 'groups', 'friends'] as const
  let index = types.indexOf(current)
  if (event.key === 'ArrowRight') index = (index + 1) % 4
  else if (event.key === 'ArrowLeft') index = (index + 3) % 4
  else if (event.key === 'Home') index = 0
  else if (event.key === 'End') index = 3
  else return
  event.preventDefault(); changeBrowse(types[index]); document.getElementById(`qa-browse-${types[index]}`)?.focus()
 }
 const commit = async (next: Candidate, choice?: 'resume' | 'move') => {
  if (busyRef.current) return
  busyRef.current = true; setBusy(true); setError('')
  try {
   const result = await onCommit(next.ref, next.ids, choice)
   if (!alive.current) return
   if (result.ok && result.session) onCommitted(result.session, Boolean(next.friends && choice !== 'resume'))
   else if (result.error === 'draft-conflict') { setCandidate(next); setConflict(true) }
   else if (result.error !== 'cancelled') setError(result.error === 'network' ? copy('Could not load this ledger. Retry your selection.', '无法加载账本，请重新选择。') : copy('This selection is no longer available. Refresh and choose again.', '所选对象已不可用，请刷新后重新选择。'))
  } catch { if (alive.current) setError(copy('Could not load this ledger. Retry your selection.', '无法加载账本，请重新选择。')) }
  finally { busyRef.current = false; if (alive.current) setBusy(false) }
 }
 const choose = (next: Candidate) => {
  const same = sameTarget(context.ref, next.ref)
  const ids = next.ids ? [...new Set([context.currentParticipantId, ...next.ids])] : same ? session.values.selectedParticipantIds : [context.currentParticipantId]
  const sameAllocation = same && ids.length === session.values.selectedParticipantIds.length && ids.every(id => session.values.selectedParticipantIds.includes(id))
  const hasAllocation = session.values.selectedParticipantIds.some(id => id !== context.currentParticipantId) || session.values.splitMode === 'exact' || Object.values(session.values.payerAmounts).some(Boolean) || Boolean(session.values.items?.length)
  if (!sameAllocation && hasAllocation) { setCandidate(next); setConflict(false) }
  else void commit(next)
 }
 const rows = browse === 'trips' || browse === 'groups' ? [...catalog[browse]].sort((a, b) => {
  if (context.ref.kind === 'space') { if (a.spaceId === context.ref.spaceId) return -1; if (b.spaceId === context.ref.spaceId) return 1 }
  const recent = (id: string) => Math.max(0, ...expenses.filter(e => e.spaceId === id).map(e => Date.parse(e.occurredOn)), Date.parse(catalog.spaceDetails?.[id]?.updatedAt ?? '') || 0)
  return recent(b.spaceId) - recent(a.spaceId)
 }).filter(row => row.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : []
 const visible = more || query.trim() ? rows : rows.slice(0, 4)
 const friends = catalog.people.filter(person => person.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
 const commitFriends = () => {
  const chosen = catalog.people.filter(person => pendingIds.includes(person.participantId))
  const first = context.ref.kind === 'person' ? chosen.find(person => context.ref.kind === 'person' && person.personId === context.ref.personId) ?? chosen[0] : chosen[0]
  if (first && chosen.length === pendingIds.length) choose({ ref: first, ids: chosen.map(person => person.participantId), friends: true })
  else setError(copy('Some selected friends are unavailable. Refresh and choose again.', '部分所选朋友已不可用，请刷新后重新选择。'))
 }
 const metadata = (id: string) => {
  const details = catalog.spaceDetails?.[id]
  if (!details) return ''
  if (browse === 'groups') return details.memberCount === undefined ? '' : copy(`${details.memberCount} people`, `${details.memberCount} 人`)
  const today = todayIso()
  return details.startDate && details.startDate > today ? copy('Upcoming', '即将开始') : details.endDate && details.endDate < today ? copy('Completed', '已结束') : details.startDate ? copy('In progress', '进行中') : ''
 }
 const name = candidate?.ref.kind === 'personal' ? copy('Personal ledger', '个人账本') : candidate?.ref.displayName
 return <section className="qa-picker" id="qa-inline-ledger-options" aria-label={copy('Choose ledger', '选择账本')} aria-busy={busy || status === 'loading'}>
  <div className="qa-type-tabs" role="tablist" aria-label={copy('Ledger types', '账本类型')}>{(['personal', 'trips', 'groups', 'friends'] as const).map(type => <button type="button" role="tab" id={`qa-browse-${type}`} key={type} aria-selected={browse === type} aria-controls="qa-browse-results" tabIndex={browse === type ? 0 : -1} className="qa-type-tab" disabled={busy} onClick={() => changeBrowse(type)} onKeyDown={event => tabKeys(event, type)}><span className="qa-tab-face">{labels[type]}</span></button>)}</div>
  {browse !== 'personal' && !candidate ? <label className="qa-search"><ContextIcon name="search"/><input className="qa-search-input" type="search" aria-label={placeholder} placeholder={placeholder} value={query} disabled={busy} onChange={event => setQuery(event.target.value)}/></label> : null}
  <div className="qa-options-scroll" role="tabpanel" id="qa-browse-results" aria-labelledby={`qa-browse-${browse}`} tabIndex={0}>
   {candidate ? <div className="qa-impact" role="status"><p>{conflict ? copy(`${name} already has a saved draft. Continue it, or replace it with this draft? The source draft stays saved.`, `${name} 已有草稿。继续该草稿，或用当前草稿替换？原账本草稿仍会保留。`) : copy(`Switching to ${name} will replace this ${session.values.selectedParticipantIds.length}-person split and its configured shares, payers or items.`, `切换到 ${name} 将替换当前 ${session.values.selectedParticipantIds.length} 人的分摊及已设置的份额、付款人或项目。`)}</p><div className="qa-impact-actions">{conflict ? <><button type="button" className="qa-impact-action" disabled={busy} onClick={() => void commit(candidate, 'resume')}>{copy('Continue saved draft', '继续已存草稿')}</button><button type="button" className="qa-commit-button" disabled={busy} onClick={() => void commit(candidate, 'move')}><span className="qa-commit-face">{copy('Move this draft', '移入当前草稿')}</span></button></> : <><button type="button" className="qa-impact-action" disabled={busy} onClick={onCancel}>{copy('Keep current', '保留当前')}</button><button type="button" className="qa-commit-button" disabled={busy} onClick={() => void commit(candidate)}><span className="qa-commit-face">{copy('Switch', '切换')}</span></button></>}</div></div> : browse === 'personal' ? <div className="qa-option-grid"><button type="button" className="qa-option qa-option--single" aria-pressed={context.ref.kind === 'personal'} disabled={busy} onClick={() => choose({ ref: { kind: 'personal' } })}><ContextIcon name="user"/><span className="qa-option-title">{copy('Personal ledger', '个人账本')}</span>{context.ref.kind === 'personal' ? <span className="qa-selection-mark"><ContextIcon name="check"/></span> : null}</button></div> : status === 'loading' ? <p className="qa-empty-or-error" role="status">{copy('Loading…', '加载中…')}</p> : status === 'error' ? <div className="qa-empty-or-error" role="alert">{copy('Could not load ledgers.', '无法加载账本。')}<button type="button" className="qa-more-button" onClick={() => { setStatus('loading'); setRetry(n => n + 1) }}>{copy('Retry', '重试')}</button></div> : browse === 'friends' ? <div className="qa-option-grid">{friends.map((person, index) => <label className="qa-option" key={person.personId} data-selected={pendingIds.includes(person.participantId)}><span className={`qa-avatar qa-avatar--${['blue', 'green', 'violet', 'apricot'][index % 4]}`} aria-hidden="true">{Array.from(person.displayName)[0]}</span><span className="qa-option-title">{person.displayName}</span><input type="checkbox" aria-label={person.displayName} disabled={busy} checked={pendingIds.includes(person.participantId)} onChange={() => setPendingIds(ids => ids.includes(person.participantId) ? ids.filter(id => id !== person.participantId) : [...ids, person.participantId])}/></label>)}{!friends.length ? <p className="qa-empty-or-error">{query ? copy('No matching friends.', '没有匹配的朋友。') : copy('No friends yet. Add a friend in Shared.', '暂无朋友。可在 Shared 添加朋友。')}</p> : null}</div> : <div className="qa-option-grid">{visible.map(ref => {
    const selected = sameTarget(context.ref, ref)
    return <button type="button" className="qa-option qa-option--single" key={ref.spaceId} aria-pressed={selected} disabled={busy} onClick={() => choose({ ref })}><ContextIcon name={browse === 'trips' ? 'map' : 'users'}/><span><span className="qa-option-title">{ref.displayName}</span>{metadata(ref.spaceId) ? <span className="qa-option-meta">{metadata(ref.spaceId)}</span> : null}</span>{selected ? <span className="qa-selection-mark"><ContextIcon name="check"/></span> : null}</button>
   })}{!rows.length ? <p className="qa-empty-or-error">{query ? browse === 'trips' ? copy('No matching trips.', '没有匹配的旅行。') : copy('No matching groups.', '没有匹配的群组。') : browse === 'trips' ? copy('No trips yet.', '暂无旅行。') : copy('No groups yet.', '暂无群组。')}</p> : null}</div>}
   {error ? <div className="qa-empty-or-error" role="alert">{error}<button type="button" className="qa-more-button" onClick={() => { setError(''); setStatus('loading'); setRetry(n => n + 1) }}>{copy('Refresh', '刷新')}</button></div> : null}
  </div>
  {!candidate && browse === 'friends' ? <footer className="qa-picker-footer"><span className="qa-selected-count" role="status">{copy(`${pendingIds.length} selected`, `已选 ${pendingIds.length} 人`)}</span><button type="button" className="qa-commit-button" disabled={busy || status !== 'ready' || !pendingIds.length} onClick={commitFriends}><span className="qa-commit-face">{copy('Use selected friends', '使用所选朋友')}</span></button></footer> : !candidate && (browse === 'trips' || browse === 'groups') && status === 'ready' ? <footer className="qa-picker-footer"><span className="qa-recent-label">{browse === 'trips' ? copy('Recent trips', '最近旅行') : copy('Recent groups', '最近群组')}</span>{rows.length > 4 && !query ? <button type="button" className="qa-more-button" aria-expanded={more} disabled={busy} onClick={() => setMore(value => !value)}>{more ? copy('Show recent', '仅显示最近') : browse === 'trips' ? copy('More trips ↓', '更多旅行 ↓') : copy('More groups ↓', '更多群组 ↓')}</button> : null}</footer> : null}
 </section>
}
