import { useMemo, useState } from 'react'
import { canEditOwnPaymentInfo } from '../lib/permissions'
import { useT } from '../lib/i18n'
import { getPersonNameStyle } from '../lib/personTheme'
import type { Group, GroupRole, PaymentInfo } from '../types'

type Props = {
  group: Group
  authUserId?: string
  role: GroupRole | null
  onUpdatePersonPaymentInfo: (personId: string, updates: Partial<PaymentInfo>) => void
  onAddComment: (personId: string, message: string) => void
}

export default function DashboardTab({
  group,
  authUserId,
  role,
  onUpdatePersonPaymentInfo,
  onAddComment,
}: Props) {
  const t = useT()

  // Resolve the logged-in user's person in this group
  const myPerson = useMemo(
    () => authUserId ? group.people.find((p) => p.authUserId === authUserId) ?? null : null,
    [authUserId, group.people],
  )

  const defaultPersonId = myPerson?.id ?? group.people[0]?.id ?? ''
  const [selectedPersonId, setSelectedPersonId] = useState(defaultPersonId)
  const [commentInput, setCommentInput] = useState('')
  const [paymentEditing, setPaymentEditing] = useState(false)
  const [paymentDraftByPersonId, setPaymentDraftByPersonId] = useState<
    Record<string, { bankName: string; accountHolder: string; accountNumber: string }>
  >({})

  // Comment identity: always the logged-in user's person if known
  const commentPersonId = myPerson?.id ?? ''
  const commentPerson = group.people.find((person) => person.id === commentPersonId)
  const canEditSelectedPaymentInfo =
    canEditOwnPaymentInfo(role) &&
    !!selectedPersonId &&
    !!myPerson &&
    selectedPersonId === myPerson.id

  const selectedPerson = group.people.find((person) => person.id === selectedPersonId)
  const paymentInfo = selectedPerson?.paymentInfo ?? {
    qrCodeDataUrl: null,
    bankName: '',
    accountHolder: '',
    accountNumber: '',
  }
  const paymentDraft = paymentDraftByPersonId[selectedPersonId] ?? {
    bankName: paymentInfo.bankName,
    accountHolder: paymentInfo.accountHolder,
    accountNumber: paymentInfo.accountNumber,
  }

  const comments = useMemo(
    () => [...(group.comments || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [group.comments],
  )

  if (group.people.length === 0) {
    return (
      <section className="space-y-4 pb-24">
        <div className="ms-card-soft text-sm text-[#6b6058]">{t('dash.addFirst')}</div>
      </section>
    )
  }

  return (
    <section className="space-y-4 pb-24 lg:pb-0">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
      <div className="ms-card-soft">
        <h3 className="ms-title mb-2">{t('dash.title')}</h3>
        <p className="mb-3 text-xs text-[#6b6058]">{t('dash.sharedComments')}</p>

        <div className="mb-3 h-[48dvh] min-h-72 overflow-y-auto rounded-xl border border-[#d8d0c4] bg-[#faf8f4] p-3 lg:h-[56dvh]">
          {comments.length === 0 ? <p className="text-sm text-[#6b6058]">{t('dash.noComments')}</p> : null}
          {comments.map((comment) => {
            const person = group.people.find((entry) => entry.id === comment.personId)
            return (
              <div key={comment.id} className="rounded-xl border border-[#e6e0d5] bg-[#f0ece3] p-3">
                <p className="text-xs text-[#6b6058]">
                  <span style={getPersonNameStyle(person)}>{person?.name ?? t('dash.unknown')}</span> · {new Date(comment.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-[#2c2520]">{comment.message}</p>
              </div>
            )
          })}
        </div>

        {/* Posting-as identity bar */}
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#e6e0d5] bg-[#f0ece3] px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#d8d0c4] bg-[#faf8f4] text-sm font-bold text-[#3a3330]">
            {commentPerson?.avatarDataUrl ? (
              <img src={commentPerson.avatarDataUrl} alt={commentPerson.name} className="h-8 w-8 scale-[1.7] object-cover object-center" />
            ) : (
              <span style={getPersonNameStyle(commentPerson)}>{(commentPerson?.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <p className="text-xs text-[#6b6058]">
            Posting as{' '}
            <span className="font-semibold text-[#2c2520]">{commentPerson?.name ?? t('dash.unknown')}</span>
          </p>
          {!myPerson && (
            <p className="ml-auto text-[10px] italic text-[#9a9088]">Log in to use your identity</p>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 sm:items-center">
          <input
            className="ms-input h-12"
            placeholder={t('dash.placeholder')}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const msg = commentInput.trim()
              if (!msg || !commentPersonId) return
              onAddComment(commentPersonId, msg)
              setCommentInput('')
            }}
          />
          <button
            className="ms-btn-primary h-12 px-4"
            disabled={!commentPersonId}
            onClick={() => {
              const msg = commentInput.trim()
              if (!msg || !commentPersonId) return
              onAddComment(commentPersonId, msg)
              setCommentInput('')
            }}
          >
            {t('dash.post')}
          </button>
        </div>
      </div>

      <div className="ms-card-soft">
        <h2 className="ms-title mb-3">{t('dash.paymentInfo')}</h2>
        <label className="text-sm text-[#6b6058]">
          {t('dash.member')}
          <select
            className="ms-input mt-1 w-full"
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
          >
            {group.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>

        {selectedPerson ? (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            <input
              className="ms-input"
              placeholder={t('dash.bankName')}
              value={paymentDraft.bankName}
              disabled={!paymentEditing || !canEditSelectedPaymentInfo}
              onChange={(e) =>
                setPaymentDraftByPersonId((prev) => ({
                  ...prev,
                  [selectedPerson.id]: {
                    ...paymentDraft,
                    bankName: e.target.value,
                  },
                }))
              }
            />
            <input
              className="ms-input"
              placeholder={t('dash.accountHolder')}
              value={paymentDraft.accountHolder}
              disabled={!paymentEditing || !canEditSelectedPaymentInfo}
              onChange={(e) =>
                setPaymentDraftByPersonId((prev) => ({
                  ...prev,
                  [selectedPerson.id]: {
                    ...paymentDraft,
                    accountHolder: e.target.value,
                  },
                }))
              }
            />
            <input
              className="ms-input"
              placeholder={t('dash.accountNumber')}
              value={paymentDraft.accountNumber}
              disabled={!paymentEditing || !canEditSelectedPaymentInfo}
              onChange={(e) =>
                setPaymentDraftByPersonId((prev) => ({
                  ...prev,
                  [selectedPerson.id]: {
                    ...paymentDraft,
                    accountNumber: e.target.value,
                  },
                }))
              }
            />

            <button
              className="ms-btn-primary mt-1 lg:col-span-2"
              disabled={!canEditSelectedPaymentInfo}
              onClick={() => {
                if (!canEditSelectedPaymentInfo) return
                if (!paymentEditing) {
                  setPaymentEditing(true)
                  return
                }
                onUpdatePersonPaymentInfo(selectedPerson.id, {
                  bankName: paymentDraft.bankName,
                  accountHolder: paymentDraft.accountHolder,
                  accountNumber: paymentDraft.accountNumber,
                })
                setPaymentEditing(false)
              }}
            >
              {paymentEditing ? t('people.save') : t('dash.editBtn')}
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </section>
  )
}
