/** Nevada wall-clock timezone. Handles PDT/PST automatically. */
const NEVADA_TIME_ZONE = 'America/Los_Angeles'
const HAS_EXPLICIT_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

function pad(n) {
  return String(n).padStart(2, '0')
}

function zonedParts(instant, timeZone) {
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

  const map = {}
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

function offsetMsAt(instant, timeZone) {
  const parts = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - instant.getTime()
}

function fromNevadaParts(parts) {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const firstOffset = offsetMsAt(new Date(utcGuess), NEVADA_TIME_ZONE)
  let instant = new Date(utcGuess - firstOffset)
  const secondOffset = offsetMsAt(instant, NEVADA_TIME_ZONE)
  if (firstOffset !== secondOffset) {
    instant = new Date(utcGuess - secondOffset)
  }
  return instant
}

function parseToInstant(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (!value) return null
  const trimmed = String(value).trim()
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

function formatInNevada(value, options) {
  const instant = parseToInstant(value)
  if (!instant) return typeof value === 'string' ? value : ''
  return new Intl.DateTimeFormat('en-US', { timeZone: NEVADA_TIME_ZONE, ...options }).format(instant)
}

window.NRCGATime = {
  TIME_ZONE: NEVADA_TIME_ZONE,
  parse: parseToInstant,
  dateParam(value) {
    const instant = parseToInstant(value)
    if (!instant) return ''
    const parts = zonedParts(instant, NEVADA_TIME_ZONE)
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
  },
  nowParts() {
    return zonedParts(new Date(), NEVADA_TIME_ZONE)
  },
  formatDate(value) {
    return formatInNevada(value, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  },
  formatShortDate(value) {
    return formatInNevada(value, { year: 'numeric', month: 'long', day: 'numeric' })
  },
  formatTime(value) {
    return formatInNevada(value, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  },
  formatDateParts(value) {
    const instant = parseToInstant(value)
    if (!instant) return { month: '', day: '', weekdayDate: typeof value === 'string' ? value : '' }
    return {
      month: formatInNevada(instant, { month: 'short' }).toUpperCase(),
      day: Number(formatInNevada(instant, { day: 'numeric' })),
      weekdayDate: formatInNevada(instant, { weekday: 'long', month: 'long', day: 'numeric' }),
    }
  },
}
