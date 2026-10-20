import { describe, expect, it } from 'vitest'
import { expandEventOccurrences, type EventRecord } from './event-repeat'
import { fromNevadaParts } from './nevada-time'

function nevadaInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  return fromNevadaParts({ year, month, day, hour, minute, second: 0 })
}

function event(overrides: Partial<EventRecord>): EventRecord {
  return {
    id: 'evt-1',
    title: 'Weekly meeting',
    starts_at: '2026-10-14T18:00:00',
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
    repeat_rule: null,
    repeat_interval_days: null,
    repeat_until: '2026-11-04',
    registration_enabled: 0,
    capacity: null,
    capacity_scope: 'occurrence',
    registration_cutoff_hours: 0,
    cancelled_at: null,
    cancellation_message: null,
    ...overrides,
  }
}

function occurrenceDates(events: ReturnType<typeof expandEventOccurrences>): string[] {
  return events.map((row) => row.occurrence_date)
}

describe('expandEventOccurrences upcoming filtering', () => {
  it('drops last week of a weekly series whose ends_at is the next meeting', () => {
    const series = event({
      repeat_rule: 'weekly',
      ends_at: '2026-10-21T18:00:00',
    })
    const now = nevadaInstant(2026, 10, 20, 12)
    const rows = expandEventOccurrences([series], new Map(), { upcomingOnly: true, now })
    const dates = occurrenceDates(rows)
    expect(dates).not.toContain('2026-10-14')
    expect(dates).toContain('2026-10-21')
    expect(rows.find((row) => row.occurrence_date === '2026-10-21')?.ends_at).toBeNull()
  })

  it('keeps a same-day 2-hour meeting until that end time', () => {
    const series = event({
      repeat_rule: 'weekly',
      ends_at: '2026-10-14T20:00:00',
    })
    const during = expandEventOccurrences([series], new Map(), {
      upcomingOnly: true,
      now: nevadaInstant(2026, 10, 14, 19),
    })
    expect(occurrenceDates(during)).toContain('2026-10-14')
    const oct14 = during.find((row) => row.occurrence_date === '2026-10-14')
    expect(oct14?.ends_at).toBe(nevadaInstant(2026, 10, 14, 20).toISOString())

    const after = expandEventOccurrences([series], new Map(), {
      upcomingOnly: true,
      now: nevadaInstant(2026, 10, 14, 20, 1),
    })
    expect(occurrenceDates(after)).not.toContain('2026-10-14')
    expect(occurrenceDates(after)).toContain('2026-10-21')
  })

  it('keeps a non-repeating multi-day event until its real ends_at', () => {
    const summit = event({
      title: 'Summit',
      starts_at: '2026-10-14T09:00:00',
      ends_at: '2026-10-16T17:00:00',
      repeat_rule: null,
      repeat_until: null,
    })
    const mid = expandEventOccurrences([summit], new Map(), {
      upcomingOnly: true,
      now: nevadaInstant(2026, 10, 15, 12),
    })
    expect(mid).toHaveLength(1)
    expect(mid[0].occurrence_date).toBe('2026-10-14')
    expect(mid[0].ends_at).toBe(nevadaInstant(2026, 10, 16, 17).toISOString())

    const after = expandEventOccurrences([summit], new Map(), {
      upcomingOnly: true,
      now: nevadaInstant(2026, 10, 16, 18),
    })
    expect(after).toHaveLength(0)
  })

  it('keeps a non-repeating event with equal start and end through Pacific end of day', () => {
    const oneOff = event({
      title: 'Mixer',
      starts_at: '2026-10-14T18:00:00',
      ends_at: '2026-10-14T18:00:00',
      repeat_rule: null,
      repeat_until: null,
    })
    const afterStart = expandEventOccurrences([oneOff], new Map(), {
      upcomingOnly: true,
      now: nevadaInstant(2026, 10, 14, 18, 1),
    })
    expect(afterStart).toHaveLength(1)
    expect(afterStart[0].ends_at).toBeNull()

    const nextDay = expandEventOccurrences([oneOff], new Map(), {
      upcomingOnly: true,
      now: nevadaInstant(2026, 10, 15, 0, 0),
    })
    expect(nextDay).toHaveLength(0)
  })
})
