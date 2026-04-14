import { useRef, useState } from 'react'
import { CURRENCIES } from '../lib/currency'
import { PRESET_AVATARS } from '../lib/avatars'
import { getPersonNameStyle } from '../lib/personTheme'
import { canEditGroup, canManageManualTravellers, isManualTraveller } from '../lib/permissions'
import { THEMES } from '../lib/themes'
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

export default function PeopleTab({ group, authUserId, role, membershipByUserId, onAddPerson, onUpdateMembershipRole, onUpdatePersonProfile, onRemovePerson, onUpdateGroupCurrency }: Props) {
  const t = useT()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftAvatarDataUrl, setDraftAvatarDataUrl] = useState<string | null>(null)
  const [draftLinkedRole, setDraftLinkedRole] = useState<Exclude<GroupRole, 'owner'>>('view')
  const editingPerson = editingPersonId ? group.people.find((person) => person.id === editingPersonId) || null : null
  const canManageTravellers = canManageManualTravellers(role)
  const canEditTrip = canEditGroup(role)

  const openEditPerson = (person: Person) => {
    setEditingPersonId(person.id)
    setDraftName(person.name)
    setDraftAvatarDataUrl(person.avatarDataUrl || null)
    const linkedRole = person.authUserId ? membershipByUserId[person.authUserId]?.role : null
    setDraftLinkedRole(linkedRole === 'full_access' ? 'full_access' : 'view')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (typeof result === 'string') setDraftAvatarDataUrl(result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
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
            const isMe = authUserId && person.authUserId === authUserId
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

            {!isManualTraveller(editingPerson) && (
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
                      disabled={!canManageTravellers || !isManualTraveller(editingPerson)}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                      </svg>
                      {t('people.uploadPhoto')}
                    </button>
                    <button type="button" className="text-xs text-[#6b6058] underline disabled:opacity-50" disabled={!canManageTravellers || !isManualTraveller(editingPerson)} onClick={() => setDraftAvatarDataUrl(null)}>
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
                        disabled={!canManageTravellers || !isManualTraveller(editingPerson)}
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
                  disabled={!canManageTravellers || !isManualTraveller(editingPerson)}
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

              {canManageTravellers && isManualTraveller(editingPerson) ? (
                <>
                  <button
                    className="ms-btn-primary w-full"
                    onClick={() => {
                      const cleanName = draftName.trim()
                      if (!cleanName) return
                      onUpdatePersonProfile(editingPerson.id, {
                        name: cleanName,
                        avatarDataUrl: draftAvatarDataUrl,
                        nameColor: null,
                      })
                      setEditingPersonId(null)
                    }}
                  >
                    {t('people.save')}
                  </button>
                  <button
                    className="ms-btn-ghost w-full py-2.5 text-sm font-semibold text-[#9e4a4a]"
                    onClick={() => {
                      onRemovePerson(editingPerson.id)
                      setEditingPersonId(null)
                    }}
                  >
                    {t('people.removeMember')}
                  </button>
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
