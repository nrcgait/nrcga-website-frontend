import {
  formatInNevada,
  nevadaDateParam,
  parseToInstant,
  toNevadaParts,
} from './nevada-time'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Split a stored datetime into HTML date/time input values in Pacific Time. */
export function splitDateTime(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: '', time: '09:00' }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: value, time: '09:00' }
  }

  const naive = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
  if (naive && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    return { date: naive[1], time: naive[2] }
  }

  const instant = parseToInstant(value)
  if (!instant) return { date: '', time: '09:00' }
  const parts = toNevadaParts(instant)
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  }
}

/** Combine HTML date + time inputs into a naive Pacific wall-clock datetime for storage. */
export function combineDateTime(date: string, time: string): string {
  if (!date) return ''
  const t = time || '09:00'
  const normalized = t.length === 5 ? `${t}:00` : t
  return `${date}T${normalized}`
}

/** Format a stored datetime for display in admin lists (Pacific Time). */
export function formatEventDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const formatted = formatInNevada(value.includes('T') ? value : `${value}T09:00:00`, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return formatted || value
}

/** Normalize repeat_until / occurrence_date to YYYY-MM-DD in Pacific Time. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const instant = parseToInstant(value)
  if (!instant) return ''
  return nevadaDateParam(instant)
}
