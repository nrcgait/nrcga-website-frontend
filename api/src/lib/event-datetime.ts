function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Split an ISO datetime (or date-only string) into HTML date/time input values. */
export function splitDateTime(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: '', time: '09:00' }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: value, time: '09:00' }
  }

  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: '', time: '09:00' }

  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** Combine HTML date + time inputs into an ISO datetime string for storage. */
export function combineDateTime(date: string, time: string): string {
  if (!date) return ''
  const t = time || '09:00'
  const normalized = t.length === 5 ? `${t}:00` : t
  return `${date}T${normalized}`
}

/** Format a stored datetime for display in admin lists. */
export function formatEventDateTime(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value.includes('T') ? value : `${value}T09:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

/** Normalize repeat_until / occurrence_date to YYYY-MM-DD. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
