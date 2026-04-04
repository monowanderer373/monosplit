import { useRef, useState } from 'react'
import { CURRENCIES } from '../lib/currency'
import { PRESET_AVATARS } from '../lib/avatars'
import { getPersonNameStyle, PERSON_COLOR_PALETTE } from '../lib/personTheme'
import { THEMES } from '../lib/themes'
import { useStore } from '../store/useStore'
import { exportGroupAsJson, exportGroupAsCsv, parseImportedJson } from '../lib/export'
import { generateGroupId } from '../lib/id'
import type { Group, Person } from '../types'

type Props = {
  group: Group
  onAddPerson: (name: string) => void
  onUpdatePersonProfile: (personId: string, updates: Partial<Pick<Person, 'name' | 'avatarDataUrl' | 'nameColor'>>) => void
  onRemovePerson: (personId: string) => void
  onUpdateGroupCurrency: (paid: string, repay: string) => void
}

export default function PeopleTab({ group, onAddPerson, onUpdatePersonProfile, onRemovePerson, onUpdateGroupCurrency }: Props) {
  const [name, setName] = useState('')
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftAvatarDataUrl, setDraftAvatarDataUrl] = useState<string | null>(null)
  const [draftColor, setDraftColor] = useState<string | null>(null)

  const editingPerson = editingPersonId ? group.people.find((person) => person.id === editingPersonId) || null : null

  const openEditPerson = (person: Person) => {
    setEditingPersonId(person.id)
    setDraftName(person.name)
    setDraftAvatarDataUrl(person.avatarDataUrl || null)
    setDraftColor(person.nameColor || null)
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px] xl:items-start">
      <div className="ms-card-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="ms-title">Travellers</h2>
          <span className="rounded-full bg-[rgba(139,110,78,0.08)] px-2 py-1 text-xs text-[#74593c]">{group.people.length}</span>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {group.people.map((person) => (
            <button
              key={person.id}
              className="flex items-center gap-2 rounded-full border border-[#e6e0d5] bg-[#f0ece3] px-3 py-1.5"
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
            </button>
          ))}
          {group.people.length === 0 ? <p className="text-sm text-[#6b6058]">Add at least one traveller.</p> : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="ms-input flex-1"
            placeholder="Add traveller..."
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
            Add
          </button>
        </div>
      </div>

      <div className="ms-card-soft">
        <h3 className="ms-title mb-3">Group Settings</h3>
        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm text-[#6b6058]">
            Default paid currency
            <select
              className="ms-input mt-1 w-full"
              value={group.defaultPaidCurrency}
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
            Default repay currency
            <select
              className="ms-input mt-1 w-full"
              value={group.defaultRepayCurrency}
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

      <DataCard group={group} />

      {editingPerson ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2c2520]/45 p-2 lg:items-center">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-[#faf8f4] p-4 lg:max-w-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="ms-title">Edit Member</h2>
              <button className="ms-btn-ghost" onClick={() => setEditingPersonId(null)}>
                Close
              </button>
            </div>

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

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-[#6b6058]">Avatar</p>
                  <button type="button" className="text-xs text-[#6b6058] underline" onClick={() => setDraftAvatarDataUrl(null)}>
                    Clear avatar
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {PRESET_AVATARS.map((avatar) => {
                    const selected = draftAvatarDataUrl === avatar.src
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        title={avatar.label}
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
                Member name
                <input
                  className="ms-input mt-1 w-full"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </label>

              <div>
                <p className="mb-2 text-sm text-[#6b6058]">Name color</p>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                  {PERSON_COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      className={`h-8 rounded-full border ${draftColor === color ? 'border-[#2c2520]' : 'border-[#e6e0d5]'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setDraftColor(color)}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="text-xs text-[#6b6058] underline" onClick={() => setDraftColor(null)}>
                    Reset color
                  </button>
                  <span className="text-sm font-semibold" style={getPersonNameStyle({ nameColor: draftColor })}>
                    {draftName || editingPerson.name}
                  </span>
                </div>
              </div>

              <button
                className="ms-btn-primary w-full"
                onClick={() => {
                  const cleanName = draftName.trim()
                  if (!cleanName) return
                  onUpdatePersonProfile(editingPerson.id, {
                    name: cleanName,
                    avatarDataUrl: draftAvatarDataUrl,
                    nameColor: draftColor,
                  })
                  setEditingPersonId(null)
                }}
              >
                Save
              </button>
              <button
                className="ms-btn-ghost w-full py-2.5 text-sm font-semibold text-[#9e4a4a]"
                onClick={() => {
                  onRemovePerson(editingPerson.id)
                  setEditingPersonId(null)
                }}
              >
                Remove Member
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function DataCard({ group }: { group: Group }) {
  const upsertGroup = useStore((s) => s.upsertGroup)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseImportedJson(reader.result as string)
      if (!parsed) {
        window.alert('Invalid MonoSplit JSON file.')
        return
      }
      const newId = generateGroupId()
      upsertGroup({ ...parsed, id: newId })
      window.alert(`Imported "${parsed.name}" successfully!`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="ms-card-soft">
      <h3 className="ms-title mb-1">Data</h3>
      <p className="mb-4 text-xs text-[var(--ms-text-muted)]">Export or import group data for backup.</p>

      <div className="flex flex-wrap gap-2">
        <button className="ms-btn-primary" onClick={() => exportGroupAsJson(group)}>
          Export JSON
        </button>
        <button className="ms-btn-ghost" onClick={() => exportGroupAsCsv(group)}>
          Export CSV
        </button>
        <button className="ms-btn-ghost" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>
    </div>
  )
}

function ThemeCard() {
  const themeId = useStore((s) => s.themeId)
  const setThemeId = useStore((s) => s.setThemeId)

  return (
    <div className="ms-card-soft">
      <h3 className="ms-title mb-1">Theme</h3>
      <p className="mb-4 text-xs text-[var(--ms-text-muted)]">Choose the look and feel of the app.</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((theme) => {
          const selected = themeId === theme.id
          return (
            <button
              key={theme.id}
              className={`ms-key relative flex flex-col items-stretch p-0 text-left ${selected ? 'ms-key-active' : ''}`}
              onClick={() => setThemeId(theme.id)}
            >
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
                    <span className="ml-auto text-xs font-semibold text-[var(--ms-accent)]">Active</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[var(--ms-text-muted)]">
                  {theme.description}
                </p>
                <p className="mt-1.5 text-[10px] tracking-wider text-[var(--ms-text-muted)]">
                  FONT: {theme.font}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
