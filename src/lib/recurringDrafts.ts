export type RecurringCadence =
  | Readonly<{ unit: 'weekly'; interval?: number }>
  | Readonly<{ unit: 'monthly'; interval?: number; dayOfMonth: number }>

export type RecurringDraftRule<TPayload extends object = Record<string, unknown>> = Readonly<{
  id: string
  active: boolean
  nextDueOn: string
  endOn?: string | null
  cadence: RecurringCadence
  payload: TPayload
}>

export type PendingRecurringDraft<TPayload extends object = Record<string, unknown>> = Readonly<{
  kind: 'recurring_draft'
  ruleId: string
  scheduledFor: string
  occurrenceKey: string
  status: 'pending'
  payload: TPayload
}>

export type GeneratedRecurringDrafts<TPayload extends object = Record<string, unknown>> = Readonly<{
  drafts: readonly PendingRecurringDraft<TPayload>[]
  nextDueOnByRule: Readonly<Record<string, string>>
}>

export type RecurringDraftErrorCode =
  | 'invalid_calendar_date'
  | 'invalid_cadence'
  | 'generation_limit_exceeded'

export class RecurringDraftError extends Error {
  readonly code: RecurringDraftErrorCode

  constructor(code: RecurringDraftErrorCode) {
    super(code)
    this.name = 'RecurringDraftError'
    this.code = code
  }
}

type CalendarDate = Readonly<{ year: number; month: number; day: number }>

function parseCalendarDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new RecurringDraftError('invalid_calendar_date')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RecurringDraftError('invalid_calendar_date')
  }
  return { year, month, day }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function formatCalendarDate(date: CalendarDate): string {
  return [
    String(date.year).padStart(4, '0'),
    String(date.month).padStart(2, '0'),
    String(date.day).padStart(2, '0'),
  ].join('-')
}

function cadenceInterval(cadence: RecurringCadence): number {
  const interval = cadence.interval ?? 1
  if (!Number.isSafeInteger(interval) || interval < 1) {
    throw new RecurringDraftError('invalid_cadence')
  }
  return interval
}

function addCalendarDays(value: string, days: number): string {
  const date = parseCalendarDate(value)
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return formatCalendarDate({
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  })
}

export function nextLocalCalendarDate(
  scheduledFor: string,
  cadence: RecurringCadence,
): string {
  const current = parseCalendarDate(scheduledFor)
  const interval = cadenceInterval(cadence)

  if (cadence.unit === 'weekly') {
    return addCalendarDays(scheduledFor, interval * 7)
  }
  if (!Number.isSafeInteger(cadence.dayOfMonth)
      || cadence.dayOfMonth < 1
      || cadence.dayOfMonth > 31) {
    throw new RecurringDraftError('invalid_cadence')
  }

  const zeroBasedTargetMonth = current.month - 1 + interval
  const year = current.year + Math.floor(zeroBasedTargetMonth / 12)
  const month = zeroBasedTargetMonth % 12 + 1
  return formatCalendarDate({
    year,
    month,
    day: Math.min(cadence.dayOfMonth, daysInMonth(year, month)),
  })
}

export function recurringOccurrenceKey(ruleId: string, scheduledFor: string): string {
  parseCalendarDate(scheduledFor)
  return `${ruleId}:${scheduledFor}`
}

export function dedupeOccurrenceKeys(keys: readonly string[]): string[] {
  return [...new Set(keys)]
}

export function generatePendingRecurringDrafts<TPayload extends object>(
  rules: readonly RecurringDraftRule<TPayload>[],
  dueThrough: string,
  existingOccurrenceKeys: readonly string[] = [],
  maxOccurrences = 1_000,
): GeneratedRecurringDrafts<TPayload> {
  parseCalendarDate(dueThrough)
  if (!Number.isSafeInteger(maxOccurrences) || maxOccurrences < 1) {
    throw new RecurringDraftError('generation_limit_exceeded')
  }

  const knownKeys = new Set(dedupeOccurrenceKeys(existingOccurrenceKeys))
  const drafts: PendingRecurringDraft<TPayload>[] = []
  const nextDueOnByRule: Record<string, string> = {}
  let visitedOccurrences = 0

  for (const rule of rules) {
    if (!rule.active) continue

    let scheduledFor = rule.nextDueOn
    parseCalendarDate(scheduledFor)
    if (rule.endOn != null) parseCalendarDate(rule.endOn)

    while (scheduledFor <= dueThrough && (rule.endOn == null || scheduledFor <= rule.endOn)) {
      visitedOccurrences += 1
      if (visitedOccurrences > maxOccurrences) {
        throw new RecurringDraftError('generation_limit_exceeded')
      }

      const occurrenceKey = recurringOccurrenceKey(rule.id, scheduledFor)
      if (!knownKeys.has(occurrenceKey)) {
        knownKeys.add(occurrenceKey)
        drafts.push({
          kind: 'recurring_draft',
          ruleId: rule.id,
          scheduledFor,
          occurrenceKey,
          status: 'pending',
          payload: { ...rule.payload },
        })
      }
      scheduledFor = nextLocalCalendarDate(scheduledFor, rule.cadence)
    }

    nextDueOnByRule[rule.id] = scheduledFor
  }

  return { drafts, nextDueOnByRule }
}
