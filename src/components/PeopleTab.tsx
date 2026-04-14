import { useRef, useState } from 'react'
import { CURRENCIES } from '../lib/currency'
import { PRESET_AVATARS } from '../lib/avatars'
import { getPersonNameStyle } from '../lib/personTheme'
import { canEditGroup, canManageManualTravellers, isManualTraveller } from '../lib/permissions'
import { THEMES } from '../lib/themes'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'
import { useStore } from '../store/useStore'
import { exportGroupAsJson, exportGroupAsCsv, parseImportedJson } from '../lib/export'
import { generateGroupId } from '../lib/id'
import type { Group, GroupMembership, GroupRole, Person } from '../types'

type Props = {
  group: Group
  authUserId?: string
  role: GroupRole | null
  membershipByUserId: Record<string, GroupMembership | undefined>
  onAddPerson: (name: string) => void
  onUpdateMembershipRole: (userId: string, role: Exclude<GroupRole, 'owner'>) => void
  onUpdatePersonProfile: (personId: string, updates: Partial<Pick<Person, 'name' | 'avatarDataUrl' | 'nameColor'>>) => void
  onRemovePerson: (personId: string) => void
  onUpdateGroupCurrency: (paid: string, repay: string) => void
}

const AVATAR_EDITOR_SIZE = 240
const AVATAR_OUTPUT_SIZE = 512
const MIN_AVATAR_SCALE = 1
const MAX_AVATAR_SCALE = 3

function getCoverScale(width: number, height: number, viewportSize: number) {
  return Math.max(viewportSize / width, viewportSize / height)
}

function getRenderedImageSize(
  naturalSize: { width: number; height: number },
  viewportSize: number,
  scale: number,
) {
  const coverScale = getCoverScale(naturalSize.width, naturalSize.height, viewportSize)
  return {
    width: naturalSize.width * coverScale * scale,
    height: naturalSize.height * coverScale * scale,
  }
}

function clampAvatarOffset(
  offset: { x: number; y: number },
  naturalSize: { width: number; height: number },
  scale: number,
  viewportSize: number,
) {
  const rendered = getRenderedImageSize(naturalSize, viewportSize, scale)
  const maxX = Math.max(0, (rendered.width - viewportSize) / 2)
  const maxY = Math.max(0, (rendered.height - viewportSize) / 2)
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('invalid-image'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('read-failed'))
    reader.readAsDataURL(file)
  })
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = source
  })
}

async function renderAdjustedAvatar(args: {
  source: string
  naturalSize: { width: number; height: number }
  scale: number
  offset: { x: number; y: number }
}) {
  const image = await loadImage(args.source)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_OUTPUT_SIZE
  canvas.height = AVATAR_OUTPUT_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')

  const outputRatio = AVATAR_OUTPUT_SIZE / AVATAR_EDITOR_SIZE
  const rendered = getRenderedImageSize(args.naturalSize, AVATAR_EDITOR_SIZE, args.scale)
  const outputWidth = rendered.width * outputRatio
  const outputHeight = rendered.height * outputRatio
  const centerX = AVATAR_OUTPUT_SIZE / 2 + args.offset.x * outputRatio
  const centerY = AVATAR_OUTPUT_SIZE / 2 + args.offset.y * outputRatio

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    image,
    centerX - outputWidth / 2,
    centerY - outputHeight / 2,
    outputWidth,
    outputHeight,
  )

  return canvas.toDataURL('image/png')
}

export default function PeopleTab({ group, authUserId, role, membershipByUserId, onAddPerson, onUpdateMembershipRole, onUpdatePersonProfile, onRemovePerson, onUpdateGroupCurrency }: Props) {
  const t = useT()
  const { authUser, updateProfile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cropDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const [name, setName] = useState('')
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftAvatarDataUrl, setDraftAvatarDataUrl] = useState<string | null>(null)
  const [draftLinkedRole, setDraftLinkedRole] = useState<Exclude<GroupRole, 'owner'>>('view')
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropNaturalSize, setCropNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [cropScale, setCropScale] = useState(1)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const editingPerson = editingPersonId ? group.people.find((person) => person.id === editingPersonId) || null : null
  const canManageTravellers = canManageManualTravellers(role)
  const canEditTrip = canEditGroup(role)
  const normalizeIdentity = (value?: string | null) => value?.trim().toLowerCase() ?? ''
  const currentDisplayName = normalizeIdentity(authUser?.displayName)
  const currentEmailName = normalizeIdentity(authUser?.email?.split('@')[0])
  const currentDisplayTokens = currentDisplayName.split(/\s+/).filter(Boolean)
  const currentEmailTokens = currentEmailName.split(/\s+/).filter(Boolean)
  const isCurrentUserPerson = (person: Person | null) => {
    if (!person || !authUserId) return false
    if (person.authUserId === authUserId) return true
    if (role === 'owner' && group.ownerId === authUserId) {
      if (person.authUserId && person.authUserId === group.ownerId) return true
      const personName = normalizeIdentity(person.name)
      if (
        personName &&
        (
          personName === currentDisplayName ||
          personName === currentEmailName ||
          currentDisplayName.startsWith(personName) ||
          personName.startsWith(currentDisplayName) ||
          currentEmailName.startsWith(personName) ||
          personName.startsWith(currentEmailName) ||
          currentDisplayTokens.includes(personName) ||
          currentEmailTokens.includes(personName)
        )
      ) return true
    }
    return false
  }
  const isEditingSelf = isCurrentUserPerson(editingPerson)
  const canEditEditingPerson = !!editingPerson && (isManualTraveller(editingPerson) || isEditingSelf)

  const openEditPerson = (person: Person) => {
    setEditingPersonId(person.id)
    setDraftName(person.name)
    setDraftAvatarDataUrl(person.avatarDataUrl || null)
    setCropImageSrc(null)
    setCropNaturalSize(null)
    setCropScale(1)
    setCropOffset({ x: 0, y: 0 })
    const linkedRole = person.authUserId ? membershipByUserId[person.authUserId]?.role : null
    setDraftLinkedRole(linkedRole === 'full_access' ? 'full_access' : 'view')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !canEditEditingPerson) return
    try {
      const source = await readFileAsDataUrl(file)
      const image = await loadImage(source)
      setCropImageSrc(source)
      setCropNaturalSize({ width: image.naturalWidth, height: image.naturalHeight })
      setCropScale(1)
      setCropOffset({ x: 0, y: 0 })
    } catch {
      window.alert(t('auth.errorGeneric'))
    }
  }

  const closeCropEditor = () => {
    setCropImageSrc(null)
    setCropNaturalSize(null)
    setCropScale(1)
    setCropOffset({ x: 0, y: 0 })
    cropDragRef.current = null
  }

  const handleCropScaleChange = (nextScale: number) => {
    if (!cropNaturalSize) {
      setCropScale(nextScale)
      return
    }
    setCropScale(nextScale)
    setCropOffset((prev) => clampAvatarOffset(prev, cropNaturalSize, nextScale, AVATAR_EDITOR_SIZE))
  }

  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropNaturalSize) return
    cropDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: cropOffset.x,
      originY: cropOffset.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropNaturalSize || !cropDragRef.current || cropDragRef.current.pointerId !== e.pointerId) return
    const deltaX = e.clientX - cropDragRef.current.startX
    const deltaY = e.clientY - cropDragRef.current.startY
    setCropOffset(
      clampAvatarOffset(
        {
          x: cropDragRef.current.originX + deltaX,
          y: cropDragRef.current.originY + deltaY,
        },
        cropNaturalSize,
        cropScale,
        AVATAR_EDITOR_SIZE,
      ),
    )
  }

  const handleCropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (cropDragRef.current?.pointerId === e.pointerId) {
      cropDragRef.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleApplyCrop = async () => {
    if (!cropImageSrc || !cropNaturalSize) return
    try {
      const adjusted = await renderAdjustedAvatar({
        source: cropImageSrc,
        naturalSize: cropNaturalSize,
        scale: cropScale,
        offset: cropOffset,
      })
      setDraftAvatarDataUrl(adjusted)
      closeCropEditor()
    } catch {
      window.alert(t('auth.errorGeneric'))
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px] xl:items-start">
      <div className="ms-card-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="ms-title">{t('people.travellers')}</h2>
          <span className="rounded-full bg-[rgba(139,110,78,0.08)] px-2 py-1 text-xs text-[#74593c]">{group.people.length}</span>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {group.people.map((person) => {
            const isMe = isCurrentUserPerson(person)
            const membership = person.authUserId ? membershipByUserId[person.authUserId] : undefined
            const roleLabel = group.ownerId && person.authUserId === group.ownerId
              ? t('people.roleOwner')
              : membership?.role === 'full_access'
                ? t('people.roleFullAccess')
                : membership?.role === 'view'
                  ? t('people.roleView')
                  : isManualTraveller(person)
                    ? t('people.roleTraveller')
                    : null
            return (
              <button
                key={person.id}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 transition-shadow ${
                  isMe
                    ? 'border-[var(--ms-accent,#8b6e4e)] bg-[var(--ms-accent-bg,rgba(139,110,78,0.1))] ring-1 ring-[var(--ms-accent,#8b6e4e)]/30'
                    : 'border-[#e6e0d5] bg-[#f0ece3]'
                }`}
                onClick={() => openEditPerson(person)}
              >
                {person.avatarDataUrl ? (
                  <span className="flex h-6 w-6 overflow-hidden rounded-full">
                    <img src={person.avatarDataUrl} alt={person.name} className="h-6 w-6 scale-[1.7] object-cover object-center" />
                  </span>
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#e6e0d5] bg-[#faf8f4] text-xs font-semibold text-[#3a3330]">
                    {person.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="text-sm font-medium" style={getPersonNameStyle(person)}>
                  {person.name}
                </span>
                {isMe && (
                  <span className="ml-0.5 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--ms-accent,#8b6e4e)', color: '#fdfaf5' }}>
                    {t('people.you')}
                  </span>
                )}
                {roleLabel && (
                  <span className="ml-0.5 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#e8e0d0] text-[#74593c]">
                    {roleLabel}
                  </span>
                )}
              </button>
            )
          })}
          {group.people.length === 0 ? <p className="text-sm text-[#6b6058]">{t('people.addHint')}</p> : null}
        </div>

        {canManageTravellers ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="ms-input flex-1"
              placeholder={t('people.addPlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                const value = name.trim()
                if (!value) return
                onAddPerson(value)
                setName('')
              }}
            />
            <button className="ms-btn-primary h-11 sm:min-w-28" onClick={() => {
                const value = name.trim()
                if (!value) return
                onAddPerson(value)
                setName('')
              }}>
              {t('people.add')}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[#6b6058]">{t('people.manualTravellerHint')}</p>
        )}
      </div>

      <div className="ms-card-soft">
        <h3 className="ms-title mb-3">{t('people.groupSettings')}</h3>
        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm text-[#6b6058]">
            {t('people.defaultPaid')}
            <select
              className="ms-input mt-1 w-full"
              value={group.defaultPaidCurrency}
              disabled={!canEditTrip}
              onChange={(e) => onUpdateGroupCurrency(e.target.value, group.defaultRepayCurrency)}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} {currency.symbol}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-[#6b6058]">
            {t('people.defaultRepay')}
            <select
              className="ms-input mt-1 w-full"
              value={group.defaultRepayCurrency}
              disabled={!canEditTrip}
              onChange={(e) => onUpdateGroupCurrency(group.defaultPaidCurrency, e.target.value)}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} {currency.symbol}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      </div>

      <ThemeCard />

      <FontCard />

      <LanguageCard />

      {canEditTrip ? <DataCard group={group} /> : null}

      {editingPerson ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2c2520]/45 p-2 lg:items-center">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-[#faf8f4] p-4 lg:max-w-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="ms-title">{t('people.editMember')}</h2>
              <button className="ms-btn-ghost" onClick={() => setEditingPersonId(null)}>
                {t('people.close')}
              </button>
            </div>

            {!isManualTraveller(editingPerson) && !isEditingSelf && (
              <div className="mb-3 rounded-xl border border-[#e6e0d5] bg-[#f0ece3] px-3 py-2 text-sm text-[#6b6058]">
                {t('people.linkedMemberReadonly')}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {draftAvatarDataUrl ? (
                  <span className="flex h-14 w-14 overflow-hidden rounded-full border border-[#e6e0d5]">
                    <img src={draftAvatarDataUrl} alt={draftName || editingPerson.name} className="h-14 w-14 scale-[1.7] object-cover object-center" />
                  </span>
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e6e0d5] bg-[#f0ece3] text-lg font-bold text-[#3a3330]">
                    {(draftName || editingPerson.name || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Hidden file input for photo upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileUpload}
              />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-[#6b6058]">{t('people.avatar')}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg border border-[#d8d0c4] bg-[#f0ece3] px-2 py-1 text-xs font-medium text-[#5a4838] transition-colors hover:bg-[#e8e0d0]"
                      disabled={!canEditEditingPerson}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                      </svg>
                      {t('people.uploadPhoto')}
                    </button>
                    <button type="button" className="text-xs text-[#6b6058] underline disabled:opacity-50" disabled={!canEditEditingPerson} onClick={() => setDraftAvatarDataUrl(null)}>
                      {t('people.clearAvatar')}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {PRESET_AVATARS.map((avatar) => {
                    const selected = draftAvatarDataUrl === avatar.src
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        title={avatar.label}
                        disabled={!canEditEditingPerson}
                        className={`overflow-hidden rounded-xl border-2 p-0 transition ${selected ? 'border-[#8b6e4e] ring-2 ring-[rgba(139,110,78,0.15)]' : 'border-[#e6e0d5]'}`}
                        onClick={() => setDraftAvatarDataUrl(avatar.src)}
                      >
                        <img src={avatar.src} alt={avatar.label} className="aspect-square w-full scale-[1.7] object-cover object-center" loading="lazy" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="block text-sm text-[#6b6058]">
                {t('people.memberName')}
                <input
                  className="ms-input mt-1 w-full"
                  value={draftName}
                  disabled={!canEditEditingPerson}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </label>

              {role === 'owner' && editingPerson.authUserId && editingPerson.authUserId !== group.ownerId ? (
                <label className="block text-sm text-[#6b6058]">
                  {t('people.memberPermission')}
                  <select
                    className="ms-input mt-1 w-full"
                    value={draftLinkedRole}
                    onChange={(e) => setDraftLinkedRole(e.target.value === 'full_access' ? 'full_access' : 'view')}
                  >
                    <option value="full_access">Full Access</option>
                    <option value="view">View</option>
                  </select>
                </label>
              ) : null}

              {canEditEditingPerson ? (
                <>
                  <button
                    className="ms-btn-primary w-full"
                    onClick={async () => {
                      const cleanName = draftName.trim()
                      if (!cleanName) return
                      try {
                        onUpdatePersonProfile(editingPerson.id, {
                          name: cleanName,
                          avatarDataUrl: draftAvatarDataUrl,
                          nameColor: null,
                        })
                        if (isEditingSelf) {
                          await updateProfile({ displayName: cleanName })
                        }
                        setEditingPersonId(null)
                      } catch {
                        window.alert(t('auth.errorGeneric'))
                      }
                    }}
                  >
                    {t('people.save')}
                  </button>
                  {canManageTravellers && isManualTraveller(editingPerson) ? (
                    <button
                      className="ms-btn-ghost w-full py-2.5 text-sm font-semibold text-[#9e4a4a]"
                      onClick={() => {
                        onRemovePerson(editingPerson.id)
                        setEditingPersonId(null)
                      }}
                    >
                      {t('people.removeMember')}
                    </button>
                  ) : null}
                </>
              ) : null}

              {role === 'owner' && editingPerson.authUserId && editingPerson.authUserId !== group.ownerId ? (
                <button
                  className="ms-btn-primary w-full"
                  onClick={() => {
                    onUpdateMembershipRole(editingPerson.authUserId!, draftLinkedRole)
                    setEditingPersonId(null)
                  }}
                >
                  {t('people.updateMemberPermission')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {cropImageSrc && cropNaturalSize ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#2c2520]/55 p-2 lg:items-center">
          <div className="w-full max-w-md rounded-2xl bg-[#faf8f4] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="ms-title">{t('people.adjustPhoto')}</h3>
              <button className="ms-btn-ghost" onClick={closeCropEditor}>
                {t('people.close')}
              </button>
            </div>

            <p className="mb-4 text-sm text-[#6b6058]">{t('people.dragPhoto')}</p>

            <div className="mb-4 flex justify-center">
              <div
                className="relative overflow-hidden rounded-full border border-[#e6e0d5] bg-[#f0ece3] shadow-inner"
                style={{ width: `${AVATAR_EDITOR_SIZE}px`, height: `${AVATAR_EDITOR_SIZE}px`, touchAction: 'none' }}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
              >
                <img
                  src={cropImageSrc}
                  alt={draftName || editingPerson?.name || 'Avatar preview'}
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{
                    width: `${getRenderedImageSize(cropNaturalSize, AVATAR_EDITOR_SIZE, cropScale).width}px`,
                    height: `${getRenderedImageSize(cropNaturalSize, AVATAR_EDITOR_SIZE, cropScale).height}px`,
                    left: `calc(50% + ${cropOffset.x}px)`,
                    top: `calc(50% + ${cropOffset.y}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/75" />
              </div>
            </div>

            <label className="mb-4 block text-sm text-[#6b6058]">
              {t('people.zoom')}
              <input
                type="range"
                min={String(MIN_AVATAR_SCALE)}
                max={String(MAX_AVATAR_SCALE)}
                step="0.01"
                className="mt-2 w-full accent-[#8b6e4e]"
                value={cropScale}
                onChange={(e) => handleCropScaleChange(Number(e.target.value))}
              />
            </label>

            <div className="flex gap-2">
              <button className="ms-btn-ghost flex-1" onClick={closeCropEditor}>
                {t('expense.cancel')}
              </button>
              <button className="ms-btn-primary flex-1" onClick={handleApplyCrop}>
                {t('people.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function DataCard({ group }: { group: Group }) {
  const t = useT()
  const upsertGroup = useStore((s) => s.upsertGroup)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseImportedJson(reader.result as string)
      if (!parsed) {
        window.alert(t('data.invalidFile'))
        return
      }
      const newId = generateGroupId()
      upsertGroup({ ...parsed, id: newId })
      window.alert(t('data.importSuccess'))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="ms-card-soft">
      <h3 className="ms-title mb-1">{t('data.title')}</h3>
      <p className="mb-4 text-xs text-[var(--ms-text-muted)]">{t('data.desc')}</p>

      <div className="flex flex-wrap gap-2">
        <button className="ms-btn-primary" onClick={() => exportGroupAsJson(group)}>
          {t('data.exportJson')}
        </button>
        <button className="ms-btn-ghost" onClick={() => exportGroupAsCsv(group)}>
          {t('data.exportCsv')}
        </button>
        <button className="ms-btn-ghost" onClick={() => fileRef.current?.click()}>
          {t('data.importJson')}
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>
    </div>
  )
}

function ThemeCard() {
  const t = useT()
  const themeId = useStore((s) => s.themeId)
  const setThemeId = useStore((s) => s.setThemeId)

  return (
    <div className="ms-card-soft">
      <h3 className="ms-title mb-1">{t('theme.title')}</h3>
      <p className="mb-4 text-xs text-[var(--ms-text-muted)]">{t('theme.desc')}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((theme) => {
          const selected = themeId === theme.id
          const isWip = theme.wip === true
          return (
            <button
              key={theme.id}
              disabled={isWip}
              className={`ms-key relative flex flex-col items-stretch p-0 text-left ${selected ? 'ms-key-active' : ''} ${isWip ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !isWip && setThemeId(theme.id)}
            >
              {/* WIP overlay badge */}
              {isWip && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <span className="rounded-full bg-[var(--ms-text)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--ms-bg)]">
                    Coming soon
                  </span>
                </div>
              )}

              {/* Color swatch row */}
              <div className="flex h-10 w-full overflow-hidden">
                <div className="flex-1" style={{ background: theme.preview.bg }} />
                <div className="flex-1" style={{ background: theme.preview.surface }} />
                <div className="flex-1" style={{ background: theme.preview.accent }} />
                <div className="flex-1" style={{ background: theme.preview.text }} />
                <div className="flex-1" style={{ background: theme.preview.border }} />
                <div className="flex-1" style={{ background: theme.preview.sketchLine }} />
              </div>

              {/* Info */}
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: theme.preview.text,
                      fontSynthesis: 'weight',
                    }}
                  >
                    {theme.name}
                  </span>
                  {selected ? (
                    <span className="ml-auto text-xs font-semibold text-[var(--ms-accent)]">{t('theme.active')}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[var(--ms-text-muted)]">
                  {theme.description}
                </p>
                <p className="mt-1.5 text-[10px] tracking-wider text-[var(--ms-text-muted)]">
                  {t('theme.font')} {theme.font}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const FONT_OPTIONS = [
  {
    id: 'departure-mono',
    name: 'Departure Mono',
    label: 'Default',
    sample: 'Aa — MonoSplit',
    desc: 'Retro monospace · Built-in',
    family: "'Departure Mono', monospace",
  },
  {
    id: 'source-code-pro',
    name: 'Source Code Pro',
    label: 'Source Code Pro',
    sample: 'Aa — MonoSplit',
    desc: 'Clean monospace · Developer',
    family: "'Source Code Pro', monospace",
  },
  {
    id: 'modern-antiqua',
    name: 'Modern Antiqua',
    label: 'Modern Antiqua',
    sample: 'Aa — MonoSplit',
    desc: 'Elegant serif · Antiquarian',
    family: "'Modern Antiqua', Georgia, serif",
  },
  {
    id: 'bebas-neue',
    name: 'Bebas Neue',
    label: 'Bebas Neue',
    sample: 'Aa — MonoSplit',
    desc: 'Bold condensed · Display',
    family: "'Bebas Neue', sans-serif",
  },
  {
    id: 'caesar-dressing',
    name: 'Caesar Dressing',
    label: 'Caesar Dressing',
    sample: 'Aa — MonoSplit',
    desc: 'Decorative · Historical Roman',
    family: "'Caesar Dressing', serif",
  },
] as const

function FontCard() {
  const t = useT()
  const fontId = useStore((s) => s.fontId)
  const setFontId = useStore((s) => s.setFontId)

  return (
    <div className="ms-card-soft">
      <h3 className="ms-title mb-1">{t('font.title')}</h3>
      <p className="mb-3 text-xs text-[var(--ms-text-muted)]">{t('font.desc')}</p>

      <div className="flex flex-col gap-1.5">
        {FONT_OPTIONS.map((font) => {
          const selected = fontId === font.id || (!fontId && font.id === 'departure-mono')
          return (
            <button
              key={font.id}
              className={`flex w-full items-center gap-3 border px-3 py-2 text-left transition-colors ${
                selected
                  ? 'border-[var(--ms-accent)] bg-[var(--ms-accent-bg)]'
                  : 'border-[var(--ms-border)] hover:bg-[var(--ms-surface-dim)]'
              }`}
              onClick={() => setFontId(font.id)}
            >
              {/* Live sample in that font */}
              <span
                className="w-24 shrink-0 text-base text-[var(--ms-text)]"
                style={{ fontFamily: font.family }}
              >
                Aa — 123
              </span>
              {/* Name + desc */}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-[var(--ms-text)]">{font.label}</span>
                <span className="block text-[10px] text-[var(--ms-text-muted)]">{font.desc}</span>
              </span>
              {/* Active dot */}
              {selected && (
                <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--ms-accent)]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LanguageCard() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  return (
    <div className="ms-card-soft">
      <h3 className="ms-title mb-1">{t('lang.title')}</h3>
      <p className="mb-4 text-xs text-[var(--ms-text-muted)]">{t('lang.desc')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          className={`ms-btn-ghost ${lang === 'en' ? 'border-[var(--ms-accent)] text-[var(--ms-accent)]' : ''}`}
          onClick={() => setLang('en')}
        >
          {t('lang.en')}
        </button>
        <button
          className={`ms-btn-ghost ${lang === 'zh' ? 'border-[var(--ms-accent)] text-[var(--ms-accent)]' : ''}`}
          onClick={() => setLang('zh')}
        >
          {t('lang.zh')}
        </button>
      </div>
    </div>
  )
}
