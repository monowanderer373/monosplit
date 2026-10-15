import type {CanonicalExpense} from '../types'
import {useT,countKey} from '../lib/i18n'
import {formatMinorAmount} from '../lib/money'
import {formatDate} from '../lib/locale'
import {useStore} from '../store/useStore'
export default function DirectExpenseReviewCard({expense,participantId,busy,onRespond,compact=false}:{compact?:boolean;expense:CanonicalExpense;participantId:string;busy:boolean;onRespond:(id:string,response:'accepted'|'declined',version:number)=>Promise<unknown>}){
const t=useT(),lang=useStore(s=>s.lang),hidden=useStore(s=>s.homeUi.balanceHidden),setHomeUi=useStore(s=>s.setHomeUi)
if(hidden)return <section><p>{expense.description??expense.category}</p><p>{t('notice.hiddenReview')}</p><button type="button" className="ms-btn-ghost" onClick={()=>setHomeUi({balanceHidden:false})}>{t('notice.show')}</button></section>
              const mine = expense.participations.find((participation) => participation.participantId === participantId)
              const myShare = expense.shares.find((share) => share.expenseParticipationId === mine?.id)?.amountMinor ?? 0
              const payerNames = expense.payerContributions
                .map((contribution) => expense.participations.find(
                  (participation) => participation.id === contribution.expenseParticipationId,
                )?.nameSnapshot)
                .filter((name): name is string => Boolean(name))
                .join(', ')
if(compact)return <article className="notification-a-panel" data-testid="notification-direct-review">
 <h3>{expense.description??expense.category}</h3><p className="home-meta">{formatDate(expense.occurredOn,lang)}</p>
 <dl className="notification-a-facts"><div className="notification-a-highlight"><dt>{t('noticeA.direct.yourShare')}</dt><dd>{formatMinorAmount(myShare,expense.currency)}</dd></div><div><dt>{t('noticeA.direct.billTotal')}</dt><dd>{formatMinorAmount(expense.totalMinor,expense.currency)}</dd></div><div><dt>{t('noticeA.direct.paidBy')}</dt><dd>{payerNames}</dd></div></dl>
 <details className="notification-a-disclosure"><summary>{t('noticeA.direct.splitDetails')}</summary><p>{t('friends.visibilityHelp')}</p>{expense.participations.map(person=><p key={person.id}>{person.nameSnapshot} · {formatMinorAmount(expense.shares.find(s=>s.expenseParticipationId===person.id)?.amountMinor??0,expense.currency)}</p>)}</details>
 <div className="notification-a-actions"><button type="button" className="ms-btn-primary" disabled={busy} onClick={()=>void onRespond(expense.id,'accepted',expense.version)}>{t('friends.acceptShare')}</button><button type="button" className="ms-btn-ghost" disabled={busy} onClick={()=>void onRespond(expense.id,'declined',expense.version)}>{t('common.decline')}</button></div>
 </article>
return (                <article className="ms-card-hero">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-extrabold">{expense.description ?? expense.category}</p>
                      <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">
                        {t('friends.share', { amount: formatMinorAmount(myShare, expense.currency), date: formatDate(expense.occurredOn, lang) })}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                        {t('friends.total', {
                          amount: formatMinorAmount(expense.totalMinor, expense.currency),
                          people: t(countKey('common.count.people.one', 'common.count.people.many', expense.participantCount), { count: expense.participantCount }),
                        })}
                        {payerNames ? ` · ${t('friends.paidBy', { names: payerNames })}` : ''}
                      </p>
                      <p className="mt-2 text-xs text-[var(--ms-text-muted)]">
                        {t('friends.visibilityHelp')}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--ms-info-bg)] px-2 py-1 text-xs font-bold text-[var(--ms-info)]">{t('common.pending')}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button className="ms-btn-ghost" disabled={busy} onClick={() => void onRespond(expense.id, 'declined', expense.version)}>{t('common.decline')}</button>
                    <button className="ms-btn-primary" disabled={busy} onClick={() => void onRespond(expense.id, 'accepted', expense.version)}>{t('friends.acceptShare')}</button>
                  </div>
                </article>)
}
