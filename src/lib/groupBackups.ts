import type { Group } from '../types'

const MAX_BACKUPS = 15
const BACKUP_KEY_PREFIX = 'monosplit-backup-'

export interface GroupBackup {
  id: string
  groupId: string
  savedAt: string
  trigger: 'add_payment' | 'remove_payment' | 'update_payment' | 'manual'
  description: string
  // Store full group data so any accidental change can be recovered
  data: {
    expenses: Group['expenses']
    settlementPayments: Group['settlementPayments']
  }
}

export function saveGroupBackup(
  group: Group,
  trigger: GroupBackup['trigger'],
  description: string,
): void {
  try {
    const key = `${BACKUP_KEY_PREFIX}${group.id}`
    const existing: GroupBackup[] = JSON.parse(localStorage.getItem(key) || '[]')

    const backup: GroupBackup = {
      id: `backup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      groupId: group.id,
      savedAt: new Date().toISOString(),
      trigger,
      description,
      data: {
        expenses: group.expenses,
        settlementPayments: group.settlementPayments ?? [],
      },
    }

    // Newest first, cap at MAX_BACKUPS
    const next = [backup, ...existing].slice(0, MAX_BACKUPS)
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // Never crash the app over a backup failure
  }
}

export function getGroupBackups(groupId: string): GroupBackup[] {
  try {
    const key = `${BACKUP_KEY_PREFIX}${groupId}`
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

export function deleteGroupBackup(groupId: string, backupId: string): void {
  try {
    const key = `${BACKUP_KEY_PREFIX}${groupId}`
    const existing: GroupBackup[] = JSON.parse(localStorage.getItem(key) || '[]')
    localStorage.setItem(key, JSON.stringify(existing.filter((b) => b.id !== backupId)))
  } catch {}
}

export function clearAllGroupBackups(groupId: string): void {
  try {
    localStorage.removeItem(`${BACKUP_KEY_PREFIX}${groupId}`)
  } catch {}
}

/** Returns a human-readable relative time string like "3 minutes ago" */
export function relativeTime(isoString: string, lang: 'en' | 'zh' = 'en'): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (lang === 'zh') {
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    return `${days} 天前`
  }
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
