import { useRef, useState } from 'react'
import TripPeriodEditor from './TripPeriodEditor'
import type { ReactNode } from 'react'
import type { HomeScreenProps } from '../home/HomeScreen'
import type { TravelMembers } from '../../hooks/useTravelMembers'
import { useT } from '../../lib/i18n'
import { AnchoredPaperPopover, TravelAmount, TravelIcon, TravelRecordsSection, TravelStatus, TripDateLine } from './TravelUI'

export default function TripDetails({ props, records, members, membersStatus, participantId, onBack, onInfo, onMembers, onManage, canWrite }: {
  props: HomeScreenProps; records: ReactNode; members: TravelMembers; membersStatus: 'ready' | 'error' | 'loading';
  participantId: string; onBack: () => void; onInfo: () => void; onMembers: () => void; onManage: () => void; canWrite: boolean
}) {
  const t = useT(), anchor = useRef<HTMLButtonElement>(null)
  const [more, setMore] = useState(false)
  const [labelInfo, setLabelInfo] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState(false)
  const periodTrigger = useRef<HTMLButtonElement>(null)
  const closePeriod = () => { setEditingPeriod(false); requestAnimationFrame(() => periodTrigger.current?.focus({ preventScroll: true })) }
  const close = () => { setMore(false); anchor.current?.focus({ preventScroll: true }) }
  const trip = props.trip
  const personal = trip?.trip.id.startsWith('affiliation:')
  const info = () => { if (personal) setLabelInfo(value => !value); else onInfo() }
  const currencies = new Set([...props.tripSpending.map(x => x.currency), ...props.recordGroups.flatMap(g => g.records.map(r => r.currency))])
  const sameCurrency = currencies.size <= 1 && (!currencies.size || currencies.has(trip?.trip.defaultCurrency ?? ''))
  return <main className="tt-travel tt-trip-detail" data-density={props.density}>
    <div className="tt-page tt-detail-page">
      <nav className="tt-detail-nav"><button type="button" className="tt-detail-back tt-link" onClick={onBack}><TravelIcon name="chevron-left" />{t('home.modeTravel')}</button>
        {trip ? <button ref={anchor} className="tt-icon-button" type="button" aria-label={t('travel.actions')} aria-expanded={more} onClick={() => more ? close() : setMore(true)}><TravelIcon name="more" /></button> : null}
      </nav>
      {more ? <AnchoredPaperPopover anchor={anchor} onClose={close} label={t('travel.actions')}>
        <button type="button" className="tt-popover-footer-control" onClick={() => { close(); info() }}><TravelIcon name="info" />{t('travel.tripInfo')}</button>
        {!personal ? <button type="button" className="tt-popover-footer-control" onClick={() => { close(); onMembers() }}><TravelIcon name="users" />{t('travel.members')}</button> : null}
        <button type="button" className="tt-popover-footer-control" onClick={() => { close(); onManage() }}><TravelIcon name="settings" />{t('travel.manage')}</button>
      </AnchoredPaperPopover> : null}
      {!trip ? <section className="tt-guide tt-paper-card"><p role={props.travelStatus === 'loading' ? 'status' : 'alert'}>{t(props.travelStatus === 'loading' ? 'home.loading' : props.travelStatus === 'error' ? 'travel.unavailable' : 'travel.noAccess')}</p>
        {props.travelStatus === 'error' ? <button className="tt-link" type="button" onClick={props.onRetryTravel}>{t('common.retry')}</button> : null}</section> : <>
        <header className="tt-detail-heading"><div className="tt-detail-title-line"><h1 className="tt-detail-title">{trip.trip.name}</h1><TravelStatus trip={trip} today={props.localToday} /></div>
          <p className="tt-detail-date"><TripDateLine trip={trip.trip} /></p>
          {!personal && canWrite ? <button ref={periodTrigger} type="button" className="trip-period-entry" aria-expanded={editingPeriod} aria-controls="trip-period-details" onClick={() => editingPeriod ? closePeriod() : setEditingPeriod(true)}>{t(trip.trip.startDate || trip.trip.endDate ? 'travel.editPeriod' : 'travel.setPeriod')}</button> : null}<img className="tt-detail-map" src="/travel/travel-map-ticket.png" alt="" /></header>
        {editingPeriod && !personal && canWrite ? <div id="trip-period-details"><TripPeriodEditor key={trip.trip.id} spaceId={trip.trip.id} onCancel={closePeriod} onSaved={() => { closePeriod(); props.onRetryTravel?.() }}/></div> : null}
        <section className="tt-detail-summary tt-paper-card" data-testid="trip-detail-summary"><img className="tt-map-wash" src="/travel/map-wash.svg" alt="" />
          <p className="tt-amount-label">{t('home.mySpending')}</p><p className="tt-amount"><TravelAmount lines={props.tripSpending} currency={trip.trip.defaultCurrency} hidden={props.balanceHidden} status={props.tripSpendingStatus ?? 'ready'} /></p>
          <div className="tt-detail-facts"><span className="tt-detail-fact"><TravelIcon name="receipt" />{props.tripSpendingStatus === 'ready' ? t('travel.recordCount', { count: props.recordGroups.reduce((sum, group) => sum + group.records.length, 0) }) : t('home.amountUnavailable')}</span>
            {!personal ? <span className="tt-detail-fact"><TravelIcon name="users" />{membersStatus === 'ready' ? t('travel.memberCount', { count: members.length }) : t(membersStatus === 'error' ? 'home.amountUnavailable' : 'home.loading')}</span> : null}
            <button className="tt-link" type="button" onClick={info}>{t('travel.tripInfo')}<TravelIcon name="arrow-right" /></button></div>
        </section>
        {personal ? <section className="tt-members tt-paper-card"><p className="tt-state-message">{t('travel.personalLabelHelp')}</p>{labelInfo ? <p className="tt-state-message">{t('travel.labelAddHelp')}</p> : null}</section> : <section className="tt-members tt-paper-card"><h2 className="tt-members-title">{t('travel.members')}</h2><div className="tt-members-row">
          {membersStatus === 'ready' ? <div className="tt-avatars">{members.slice(0,3).map(({ participant }, index) => {
            const name = participant.id === participantId ? t('common.you') : participant.displayName || t('common.member')
            return <div className="tt-avatar-item" key={participant.id}><span className={`tt-avatar ${index === 1 ? 'tt-avatar--peach' : index === 2 ? 'tt-avatar--green' : ''}`} aria-hidden="true">{Array.from(name)[0]}</span><span>{name}</span></div>
          })}</div> : <p role={membersStatus === 'error' ? 'alert' : 'status'}>{t(membersStatus === 'error' ? 'travel.unavailable' : 'home.loading')}</p>}
          <button className="tt-link" type="button" onClick={onMembers}>{t('travel.members')}<TravelIcon name="arrow-right" /></button></div></section>}
        <TravelRecordsSection props={props} detail>{records}</TravelRecordsSection>
        <p className="tt-currency-note"><TravelIcon name="info" />{t(sameCurrency ? 'travel.currencyNote' : 'travel.multicurrencyNote')}</p>
        {!canWrite ? <p className="tt-state-message">{t('travel.readOnly')}</p> : null}
      </>}
    </div>
  </main>
}
