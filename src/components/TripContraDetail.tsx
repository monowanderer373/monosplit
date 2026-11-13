import {useStore} from '../store/useStore'
import {ct} from '../lib/creatorTexts'
import {routedMoney} from '../lib/routedSettlement'
import type {ContraPair,ContraSnapshot} from '../lib/tripContra'

export function TripContraDetail({pair,snapshot,names}:{pair:ContraPair|undefined;snapshot:ContraSnapshot;names:ReadonlyMap<string,string>}) {
  const lang=useStore(s=>s.lang),t=(key:Parameters<typeof ct>[1])=>ct(lang,key)
  if(!pair)return <p role="alert">{t('unavailable')}</p>
  const name=(id:string)=>names.get(id)??'—',d=pair.grossDisplay??pair.display
  const money=(n:number|null)=>n===null?'—':(d.estimated?'≈ ':'')+routedMoney(n,d.currency)
  return <section className="tt-contra-detail" data-testid="contra-pair-detail" data-contra-revision={snapshot.revision}>
    <h3>{name(pair.a)} · {name(pair.b)}</h3>
    <p className="tt-r-muted">{t(pair.grossDisplay?'contraGrossHelp':'contraNativeHelp')}</p>
    {pair.native.some(l=>l.currency==='VND')&&snapshot.quote.numerator?<p className="tt-r-muted">1 MYR = {snapshot.quote.numerator}{snapshot.quote.denominator==='1'?'':' / '+snapshot.quote.denominator} VND</p>:null}
    <dl>
      <div><dt>{name(pair.a)} → {name(pair.b)}</dt><dd>{money(d.aOwesB)}</dd></div>
      <div><dt>{name(pair.b)} → {name(pair.a)}</dt><dd>{money(d.bOwesA)}</dd></div>
      <div><dt>{t('contraOffset')}</dt><dd>{money(d.contraMinor)}</dd></div>
      <div className="tt-contra-net"><dt>{t('contraNet')}{d.payer?<small>{name(d.payer)} → {name(d.recipient!)}</small>:null}</dt><dd>{money(d.netMinor)}</dd></div>
    </dl>
    {pair.pending?<p className="tt-r-error" role="status">{t('contraPending')}</p>:null}
    {pair.netMinor===0?<p>{t('contraZero')}</p>:null}{pair.netMinor===null?<p role="status">{t('contraRate')}</p>:null}
    {!pair.currentMembers?<p>{t('contraMember')}</p>:null}
    <details className="tt-c-details"><summary>{t('contraOriginal')}</summary>
      <p className="tt-r-muted">{t('contraAuditHelp')}</p>
      {pair.audit.map(row=><div className="tt-contra-native" key={row.currency}>
        <strong>{row.currency}</strong>
        <p>{name(pair.a)} → {name(pair.b)} · {t('contraBills')} {routedMoney(row.aBills,row.currency)} · {t('contraApplied')} {routedMoney(row.aApplied,row.currency)}</p>
        <p>{name(pair.b)} → {name(pair.a)} · {t('contraBills')} {routedMoney(row.bBills,row.currency)} · {t('contraApplied')} {routedMoney(row.bApplied,row.currency)}</p>
      </div>)}
      <h4>{t('contraNativeRemaining')}</h4>{pair.native.map(row=><p key={row.from+row.to+row.currency}>{name(row.from)} → {name(row.to)} · {routedMoney(row.minor,row.currency)}</p>)}
    </details>
  </section>
}
