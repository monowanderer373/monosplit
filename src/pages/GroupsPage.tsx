import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { formatDateRange } from '../lib/format'

export default function GroupsPage() {
  const navigate = useNavigate()
  const groups = useStore((s) => s.groups)
  const addGroup = useStore((s) => s.addGroup)
  const deleteGroup = useStore((s) => s.deleteGroup)
  const [newGroup, setNewGroup] = useState('')
  const [dateExpanded, setDateExpanded] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [groups],
  )

  const onCreate = () => {
    const name = newGroup.trim()
    if (!name) return
    const id = addGroup(name, {
      startDate: startDate || null,
      endDate: endDate || null,
    })
    setNewGroup('')
    setStartDate('')
    setEndDate('')
    setDateExpanded(false)
    navigate(`/group/${id}`)
  }

  return (
    <main className="ms-page">
      <header className="mb-6 max-w-3xl">
        <h1 className="text-3xl font-bold text-[#2c2520]">MonoSplit</h1>
        <p className="mt-1 text-sm text-[#6b6058]">Travel expense splitting, simple and fast.</p>
      </header>

      <section className="ms-card-soft mb-6 max-w-3xl p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="ms-input h-11 flex-1"
            placeholder="Create a travel group..."
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          />
          <button className="ms-btn-primary h-11 sm:min-w-32" onClick={onCreate}>
            Create
          </button>
        </div>
        <button
          className="mt-2 text-sm font-medium text-[#8b6e4e]"
          onClick={() => setDateExpanded((prev) => !prev)}
        >
          {dateExpanded ? 'Hide trip date calendar' : 'Set trip start/end date'}
        </button>
        {dateExpanded ? (
          <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[#e6e0d5] bg-[#f0ece3] p-3 sm:grid-cols-2">
            <label className="text-xs text-[#6b6058]">
              Start date
              <input
                type="date"
                className="ms-input mt-1 w-full"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-[#6b6058]">
              End date
              <input
                type="date"
                className="ms-input mt-1 w-full"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {sortedGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d8d0c4] bg-[#faf8f4]/80 p-6 text-center text-sm text-[#6b6058] lg:col-span-2 2xl:col-span-3">
            No groups yet. Create your first trip group.
          </div>
        ) : null}

        {sortedGroups.map((group) => (
          <article
            key={group.id}
            className="ms-card-soft cursor-pointer"
            onClick={() => navigate(`/group/${group.id}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#2c2520]">{group.name}</h2>
                <p className="mt-1 text-sm text-[#6b6058]">
                  {group.people.length} people · {group.expenses.length} expenses
                </p>
                <p className="mt-1 text-xs text-[#9a9088]">
                  {group.defaultPaidCurrency} → {group.defaultRepayCurrency}
                </p>
                <p className="mt-1 text-xs text-[#6b6058]">{formatDateRange(group.startDate, group.endDate)}</p>
              </div>
              <button
                className="ms-btn-ghost text-[#6b6058]"
                onClick={(e) => {
                  e.stopPropagation()
                  const ok = window.confirm(`Delete "${group.name}"?`)
                  if (ok) deleteGroup(group.id)
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
