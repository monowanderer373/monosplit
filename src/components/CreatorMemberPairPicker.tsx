import {useId, useRef, useState} from 'react'
import {useStore} from '../store/useStore'
import {ct} from '../lib/creatorTexts'
import type {CreatorPerson} from '../lib/creatorSettlement'
import {RoutedAvatar} from './RoutedSettlementMap'

type Side = 'payer' | 'recipient'

/** One shared, in-flow menu keeps both triggers equal on narrow screens. */
export function CreatorMemberPairPicker({payer, recipient, people, index, onChange}: {
  payer: string
  recipient: string
  people: CreatorPerson[]
  index: number
  onChange: (side: Side, id: string) => void
}) {
  const lang = useStore(s => s.lang)
  const [open, setOpen] = useState<Side>()
  const panelId = useId()
  const triggers = useRef<Partial<Record<Side, HTMLButtonElement | null>>>({})
  const labels = {payer: ct(lang, 'payer'), recipient: ct(lang, 'recipient')}
  const selected = {payer, recipient}
  const close = (side: Side) => {
    setOpen(undefined)
    triggers.current[side]?.focus()
  }
  return <div className="tt-c-member-grid" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      close(open)
    }
  }}>
    {(['payer', 'recipient'] as const).map(side => {
      const person = people.find(p => p.id === selected[side])
      return <div className="tt-c-member-field" key={side}>
        <span>{labels[side]}</span>
        <button ref={el => { triggers.current[side] = el }} type="button"
          className="tt-c-member-trigger" title={person?.name}
          aria-label={`${labels[side]} ${index}: ${person?.name ?? ct(lang, 'chooseMember')}`}
          aria-expanded={open === side} aria-controls={open === side ? panelId : undefined}
          onClick={() => setOpen(current => current === side ? undefined : side)}>
          {person ? <RoutedAvatar person={person}/> : <span className="tt-r-avatar" aria-hidden="true">+</span>}
          <span className="tt-c-member-name">{person?.name ?? ct(lang, 'chooseMember')}</span>
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
    })}
    {open ? <div className="tt-c-member-menu" id={panelId} role="group" aria-label={labels[open] + ' ' + index}>
      <p>{labels[open]}</p>
      {people.filter(p => p.id !== selected[open === 'payer' ? 'recipient' : 'payer']).map(person =>
        <button type="button" key={person.id} aria-pressed={person.id === selected[open]}
          aria-label={person.name} onClick={() => { onChange(open, person.id); close(open) }}>
          <RoutedAvatar person={person}/><span title={person.name}>{person.name}</span>
          <span aria-hidden="true">{person.id === selected[open] ? '✓' : ''}</span>
        </button>)}
    </div> : null}
  </div>
}
