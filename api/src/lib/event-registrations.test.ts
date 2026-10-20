import { describe, expect, it } from 'vitest'
import type { EventRecord } from './event-repeat'
import { buildUpcomingOccurrenceCounts, formatUpcomingRegistrationCount } from './event-registrations'
import { fromNevadaParts } from './nevada-time'

function nevadaInstant(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return fromNevadaParts({ year, month, day, hour, minute, second: 0 })
}

function event(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'evt-1',
    title: 'Weekly meeting',
    starts_at: '2026-09-16T18:00:00',
    ends_at: null,
    location: null,
    meeting_url: null,
    description: null,
    category: 'general',
    committee_slug: null,
    image_r2_key: null,
    latitude: null,
    longitude: null,
    published: 1,
    repeat_rule: 'weekly',
    repeat_interval_days: null,
    repeat_until: '2027-03-31',
    registration_enabled: 1,
    capacity: 40,
    capacity_scope: 'occurrence',
    registration_cutoff_hours: 0,
    cancelled_at: null,
    cancellation_message: null,
    ...overrides,
  }
}

describe('buildUpcomingOccurrenceCounts', () => {
  const now = nevadaInstant(2026, 10, 20, 12)

  it('excludes past occurrences and counts spots inside the 3-month window', () => {
    const rows = buildUpcomingOccurrenceCounts(
      event(),
      new Set(),
      new Map([
        ['2026-10-14', 8],
        ['2026-10-21', 5],
        ['2026-10-28', 2],
        ['2027-02-03', 9],
      ]),
      now,
    )
    const byDate = Object.fromEntries(rows.map((row) => [row.occurrence_date, row.registered]))

    expect(byDate['2026-10-14']).toBeUndefined()
    expect(byDate['2026-10-21']).toBe(5)
    expect(byDate['2026-10-28']).toBe(2)
    expect(byDate['2027-02-03']).toBeUndefined()
    expect(rows[0]?.capacity).toBe(40)
  })

  it('keeps cancelled upcoming dates and zero-fills dates with no registrations', () => {
    const rows = buildUpcomingOccurrenceCounts(event(), new Set(['2026-10-21']), new Map(), now)
    const next = rows.find((row) => row.occurrence_date === '2026-10-21')
    expect(next).toMatchObject({ registered: 0, cancelled: true, capacity: 40 })
  })

  it('returns no rows for a one-off event that already ended', () => {
    const rows = buildUpcomingOccurrenceCounts(
      event({
        starts_at: '2026-10-14T18:00:00',
        ends_at: '2026-10-14T20:00:00',
        repeat_rule: null,
        repeat_until: null,
      }),
      new Set(),
      new Map([['2026-10-14', 12]]),
      now,
    )
    expect(rows).toHaveLength(0)
  })

  it('pairs series capacity with the series-wide total, not the date count', () => {
    const rows = buildUpcomingOccurrenceCounts(
      event({ capacity_scope: 'series' }),
      new Set(),
      new Map([
        ['2026-10-14', 8],
        ['2026-10-21', 5],
        ['2026-10-28', 2],
      ]),
      now,
    )
    const next = rows.find((row) => row.occurrence_date === '2026-10-21')
    expect(next).toMatchObject({ registered: 5, filled: 15, capacity: 40, capacity_scope: 'series' })
    expect(formatUpcomingRegistrationCount(next!)).toBe('5 this date · 15 / 40')
  })
})
