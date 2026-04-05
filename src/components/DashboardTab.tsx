import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { getPersonNameStyle } from '../lib/personTheme'
import type { Group, PaymentInfo } from '../types'

type Props = {
  group: Group
  onUpdatePersonPaymentInfo: (personId: string, updates: Partial<PaymentInfo>) => void
  onAddComment: (personId: string, message: string) => void
}

export default function DashboardTab({
  group,
  onUpdatePersonPaymentInfo,
  onAddComment,
}: Props) {
  const t = useT()
  const defaultPersonId = group.people[0]?.id ?? ''
  const [selectedPersonId, setSelectedPersonId] = useState(defaultPersonId)
  const [commentPersonId, setCommentPersonId] = useState(defaultPersonId)
  const [commentInput, setCommentInput] = useState('')
  const [paymentEditing, setPaymentEditing] = useState(false)
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)
  const [paymentDraftByPersonId, setPaymentDraftByPersonId] = useState<
    Record<string, { bankName: string; accountHolder: string; accountNumber: string }>
  >({})
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)

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

  const commentPerson = group.people.find((person) => person.id === commentPersonId)

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, [])

  const startLongPress = () => {
    longPressTriggeredRef.current = false
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setMemberPickerOpen(true)
    }, 450)
  }

  const endLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    // Short press intentionally does nothing; long press opens picker.
  }

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

        <div className="relative grid grid-cols-[3rem_1fr] gap-2 sm:grid-cols-[3rem_1fr_auto] sm:items-center">
          <button
            className="flex h-12 w-12 items-center justify-center rounded-md border border-[#d8d0c4] bg-[#f0ece3] text-base font-bold text-[#3a3330]"
            title={`${t('dash.postingAs')} ${commentPerson?.name ?? t('dash.unknown')} ${t('dash.postingAsSuffix')}`}
            onPointerDown={startLongPress}
            onPointerUp={endLongPress}
            onPointerLeave={() => {
              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
              longPressTimerRef.current = null
            }}
            onPointerCancel={() => {
              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
              longPressTimerRef.current = null
            }}
          >
            {commentPerson?.avatarDataUrl ? (
              <span className="flex h-10 w-10 overflow-hidden rounded-md">
                <img src={commentPerson.avatarDataUrl} alt={commentPerson.name} className="h-10 w-10 scale-[1.7] object-cover object-center" />
              </span>
            ) : (
              <span style={getPersonNameStyle(commentPerson)}>{(commentPerson?.name || '?').slice(0, 1).toUpperCase()}</span>
            )}
          </button>

          {memberPickerOpen ? (
            <div className="absolute bottom-14 left-0 z-20 w-44 rounded-xl border border-[#e6e0d5] bg-[#faf8f4] p-1 shadow-lg">
              {group.people.map((person) => (
                <button
                  key={person.id}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                    commentPersonId === person.id ? 'bg-[rgba(139,110,78,0.08)] text-[#74593c]' : 'text-[#3a3330] hover:bg-[#f0ece3]'
                  }`}
                  onClick={() => {
                    setCommentPersonId(person.id)
                    setMemberPickerOpen(false)
                  }}
                >
                  {person.avatarDataUrl ? (
                    <span className="flex h-7 w-7 overflow-hidden rounded-md border border-[#e6e0d5]">
                      <img src={person.avatarDataUrl} alt={person.name} className="h-7 w-7 scale-[1.7] object-cover object-center" />
                    </span>
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e6e0d5] bg-[#f0ece3] text-xs font-bold">
                      <span style={getPersonNameStyle(person)}>{person.name.slice(0, 1).toUpperCase()}</span>
                    </span>
                  )}
                  <span className="truncate" style={getPersonNameStyle(person)}>{person.name}</span>
                </button>
              ))}
              <button
                className="mt-1 w-full rounded-lg px-2 py-1 text-xs text-[#6b6058] hover:bg-[#f0ece3]"
                onClick={() => setMemberPickerOpen(false)}
              >
                {t('dash.closePicker')}
              </button>
            </div>
          ) : null}
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
            className="ms-btn-primary col-span-2 h-12 px-4 sm:col-span-1"
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
        <p className="mt-1 text-xs text-[#6b6058]">{t('dash.longPressHint')}</p>
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
              disabled={!paymentEditing}
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
              disabled={!paymentEditing}
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
              disabled={!paymentEditing}
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
              onClick={() => {
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
