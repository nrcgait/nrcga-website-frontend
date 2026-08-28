/** Nevada wall-clock timezone. Handles PDT/PST automatically. */
export const NEVADA_TIME_ZONE = 'America/Los_Angeles'

export type NevadaParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const HAS_EXPLICIT_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function zonedParts(instant: Date, timeZone: string): NevadaParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const map: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value
  }

  let hour = Number(map.hour)
  if (hour === 24) hour = 0

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function offsetMsAt(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - instant.getTime()
}

/** Convert a Nevada wall-clock date/time into a UTC instant. */
export function fromNevadaParts(parts: NevadaParts): Date {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const firstOffset = offsetMsAt(new Date(utcGuess), NEVADA_TIME_ZONE)
  let instant = new Date(utcGuess - firstOffset)
  const secondOffset = offsetMsAt(instant, NEVADA_TIME_ZONE)
  if (firstOffset !== secondOffset) {
    instant = new Date(utcGuess - secondOffset)
  }
  return instant
}

export function toNevadaParts(instant: Date): NevadaParts {
  return zonedParts(instant, NEVADA_TIME_ZONE)
}

/** Keep the Nevada wall-clock time, move it onto a YYYY-MM-DD calendar date. */
export function instantOnNevadaDate(source: Date, dateParam: string): Date | null {
  const match = dateParam.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const parts = toNevadaParts(source)
  return fromNevadaParts({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  })
}

export function nevadaDateParam(instant: Date): string {
  const parts = toNevadaParts(instant)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function addNevadaCalendarDays(instant: Date, days: number): Date {
  const parts = toNevadaParts(instant)
  const noon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0))
  return fromNevadaParts({
    year: noon.getUTCFullYear(),
    month: noon.getUTCMonth() + 1,
    day: noon.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  })
}

export function addNevadaCalendarMonths(instant: Date, months: number): Date {
  const parts = toNevadaParts(instant)
  const monthIndex = parts.month - 1 + months
  const year = parts.year + Math.floor(monthIndex / 12)
  const month = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return fromNevadaParts({
    year,
    month: month + 1,
    day: Math.min(parts.day, lastDay),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  })
}

export function nevadaEndOfDay(dateParam: string): Date | null {
  const match = dateParam.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return fromNevadaParts({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 23,
    minute: 59,
    second: 59,
  })
}

/**
 * Parse a stored datetime.
 * Naive values (no Z/offset) are Nevada wall-clock times.
 * Values with Z or an offset are absolute instants.
 */
export function parseToInstant(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    return fromNevadaParts({
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
      hour: 9,
      minute: 0,
      second: 0,
    })
  }

  const naive = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (naive && !HAS_EXPLICIT_ZONE.test(trimmed)) {
    return fromNevadaParts({
      year: Number(naive[1]),
      month: Number(naive[2]),
      day: Number(naive[3]),
      hour: Number(naive[4]),
      minute: Number(naive[5]),
      second: Number(naive[6] ?? 0),
    })
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatInNevada(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const instant = value instanceof Date ? value : parseToInstant(value)
  if (!instant) return typeof value === 'string' ? value : ''
  return new Intl.DateTimeFormat('en-US', { timeZone: NEVADA_TIME_ZONE, ...options }).format(instant)
}

export function formatNevadaDateParam(dateParam: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam
  const instant = fromNevadaParts({
    year: Number(dateParam.slice(0, 4)),
    month: Number(dateParam.slice(5, 7)),
    day: Number(dateParam.slice(8, 10)),
    hour: 12,
    minute: 0,
    second: 0,
  })
  return formatInNevada(instant, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}
