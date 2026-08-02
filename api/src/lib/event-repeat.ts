export type EventRepeatRule = 'weekly' | 'biweekly' | 'monthly' | 'custom'

export type EventRecord = {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  category: 'general' | 'training'
  committee_slug: string | null
  image_r2_key: string | null
  latitude: number | null
  longitude: number | null
  published: number
  repeat_rule: EventRepeatRule | null
  repeat_interval_days: number | null
  repeat_until: string | null
  registration_enabled: number
  capacity: number | null
  capacity_scope: 'occurrence' | 'series'
  registration_cutoff_hours: number
  cancelled_at: string | null
  cancellation_message: string | null
}

export type ExpandedEventRecord = EventRecord & {
  series_id: string
  occurrence_date: string
  cancelled: boolean
}

const REPEAT_RULES = new Set<EventRepeatRule>(['weekly', 'biweekly', 'monthly', 'custom'])

export function parseRepeatRule(value: unknown): EventRepeatRule | null {
  if (typeof value === 'string' && REPEAT_RULES.has(value as EventRepeatRule)) {
    return value as EventRepeatRule
  }
  return null
}

export function repeatRuleLabel(rule: string | null | undefined): string {
  switch (rule) {
    case 'weekly':
      return 'Weekly'
    case 'biweekly':
      return 'Biweekly'
    case 'monthly':
      return 'Monthly'
    case 'custom':
      return 'Custom interval'
    default:
      return 'Does not repeat'
  }
}

function endOfDayFromDateParam(dateParam: string): Date {
  const [y, m, d] = dateParam.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate()
  const next = new Date(date)
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, lastDay))
  next.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds())
  return next
}

function toDateParam(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function nextOccurrence(current: Date, rule: EventRepeatRule, intervalDays: number | null): Date {
  switch (rule) {
    case 'weekly':
      return addDays(current, 7)
    case 'biweekly':
      return addDays(current, 14)
    case 'monthly':
      return addMonthsClamped(current, 1)
    case 'custom':
      return addDays(current, Math.max(1, intervalDays ?? 1))
  }
}

function eventDurationMs(event: EventRecord): number {
  if (!event.ends_at) return 0
  const start = new Date(event.starts_at).getTime()
  const end = new Date(event.ends_at).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
  return end - start
}

function repeatHorizonEnd(event: EventRecord, fallback: Date): Date {
  if (event.repeat_until) return endOfDayFromDateParam(event.repeat_until)
  return fallback
}

function makeOccurrence(
  event: EventRecord,
  occurrenceStart: Date,
  durationMs: number,
  cancelledDates: Set<string>,
): ExpandedEventRecord {
  const starts_at = occurrenceStart.toISOString()
  const ends_at =
    durationMs > 0 ? new Date(occurrenceStart.getTime() + durationMs).toISOString() : event.ends_at
  const occurrence_date = toDateParam(occurrenceStart)
  return {
    ...event,
    id: `${event.id}:${starts_at}`,
    series_id: event.id,
    starts_at,
    ends_at,
    occurrence_date,
    cancelled: cancelledDates.has(occurrence_date) || Boolean(event.cancelled_at),
  }
}

export function expandEventOccurrences(
  events: EventRecord[],
  cancelledByEvent: Map<string, Set<string>>,
  options: { from?: Date; to?: Date; upcomingOnly?: boolean } = {},
): ExpandedEventRecord[] {
  const now = new Date()
  const from = options.from ?? addMonthsClamped(now, -12)
  const to = options.to ?? addMonthsClamped(now, 24)
  const upcomingOnly = options.upcomingOnly ?? false
  const occurrences: ExpandedEventRecord[] = []

  for (const event of events) {
    if (event.cancelled_at) continue
    const cancelledDates = cancelledByEvent.get(event.id) ?? new Set<string>()
    const rule = parseRepeatRule(event.repeat_rule)
    const durationMs = eventDurationMs(event)
    const seriesStart = new Date(event.starts_at)
    if (Number.isNaN(seriesStart.getTime())) continue

    if (!rule) {
      const occurrenceEnd =
        durationMs > 0 ? new Date(seriesStart.getTime() + durationMs) : new Date(seriesStart)
      if (upcomingOnly && occurrenceEnd < now) continue
      if (seriesStart > to || occurrenceEnd < from) continue
      occurrences.push(makeOccurrence(event, seriesStart, durationMs, cancelledDates))
      continue
    }

    const repeatEnd = repeatHorizonEnd(event, to)
    let current = new Date(seriesStart)
    let guard = 0

    while (current <= repeatEnd && current <= to && guard < 500) {
      guard += 1
      const occurrenceEnd =
        durationMs > 0 ? new Date(current.getTime() + durationMs) : new Date(current)
      const inRange = current <= to && occurrenceEnd >= from
      const isUpcoming = occurrenceEnd >= now
      if (inRange && (!upcomingOnly || isUpcoming)) {
        occurrences.push(makeOccurrence(event, current, durationMs, cancelledDates))
      }
      const next = nextOccurrence(current, rule, event.repeat_interval_days)
      if (next.getTime() <= current.getTime()) break
      current = next
    }
  }

  occurrences.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  return occurrences
}
