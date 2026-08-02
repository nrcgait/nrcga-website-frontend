import type { EventRecord } from './event-repeat'
import { expandEventOccurrences } from './event-repeat'
import type { PaginatedResult } from './pagination'
import { paginateQuery } from './pagination'

export type EventListFilter = {
  committeeSlugs?: string[]
  category?: 'training' | 'general'
}

function eventWhereClause(filter?: EventListFilter): { sql: string; binds: unknown[] } {
  const clauses: string[] = []
  const binds: unknown[] = []
  if (filter?.committeeSlugs?.length) {
    const placeholders = filter.committeeSlugs.map(() => '?').join(', ')
    clauses.push(`committee_slug IN (${placeholders})`)
    binds.push(...filter.committeeSlugs)
  }
  if (filter?.category) {
    clauses.push('category = ?')
    binds.push(filter.category)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return { sql: where, binds }
}

export type EventInput = {
  title: string
  starts_at: string
  ends_at?: string | null
  location?: string | null
  description?: string | null
  category?: 'general' | 'training'
  committee_slug?: string | null
  image_r2_key?: string | null
  latitude?: number | null
  longitude?: number | null
  published?: number
  repeat_rule?: string | null
  repeat_interval_days?: number | null
  repeat_until?: string | null
  registration_enabled?: number
  capacity?: number | null
  capacity_scope?: 'occurrence' | 'series'
  registration_cutoff_hours?: number
}

export async function listPublishedEvents(db: D1Database, category?: string): Promise<EventRecord[]> {
  let query = 'SELECT * FROM events WHERE published = 1 AND cancelled_at IS NULL'
  const binds: string[] = []
  if (category) {
    query += ' AND category = ?'
    binds.push(category)
  }
  query += ' ORDER BY starts_at ASC'
  const stmt = db.prepare(query)
  const { results } = binds.length
    ? await stmt.bind(...binds).all<EventRecord>()
    : await stmt.all<EventRecord>()
  return results ?? []
}

export async function listAllEventsPaginated(
  db: D1Database,
  page: number,
  filter?: EventListFilter,
): Promise<PaginatedResult<EventRecord>> {
  const { sql: where, binds } = eventWhereClause(filter)
  return paginateQuery<EventRecord>(
    db,
    `SELECT COUNT(*) as c FROM events ${where}`,
    `SELECT * FROM events ${where} ORDER BY starts_at DESC`,
    page,
    binds,
  )
}

export async function getEventById(db: D1Database, id: string): Promise<EventRecord | null> {
  return db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first<EventRecord>()
}

export async function createEvent(db: D1Database, input: EventInput): Promise<string> {
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO events (
        id, title, starts_at, ends_at, location, description, category, committee_slug, image_r2_key,
        latitude, longitude, published,
        repeat_rule, repeat_interval_days, repeat_until, registration_enabled, capacity,
        capacity_scope, registration_cutoff_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.title,
      input.starts_at,
      input.ends_at ?? null,
      input.location ?? null,
      input.description ?? null,
      input.category ?? 'general',
      input.committee_slug ?? null,
      input.image_r2_key ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.published ?? 1,
      input.repeat_rule ?? null,
      input.repeat_interval_days ?? null,
      input.repeat_until ?? null,
      input.registration_enabled ?? 0,
      input.capacity ?? null,
      input.capacity_scope ?? 'occurrence',
      input.registration_cutoff_hours ?? 0,
    )
    .run()
  return id
}

export async function updateEvent(db: D1Database, id: string, input: EventInput): Promise<void> {
  await db
    .prepare(
      `UPDATE events SET
        title = ?, starts_at = ?, ends_at = ?, location = ?, description = ?, category = ?, committee_slug = ?,
        image_r2_key = ?, latitude = ?, longitude = ?, published = ?, repeat_rule = ?, repeat_interval_days = ?,
        repeat_until = ?, registration_enabled = ?, capacity = ?, capacity_scope = ?, registration_cutoff_hours = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(
      input.title,
      input.starts_at,
      input.ends_at ?? null,
      input.location ?? null,
      input.description ?? null,
      input.category ?? 'general',
      input.committee_slug ?? null,
      input.image_r2_key ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      input.published ?? 1,
      input.repeat_rule ?? null,
      input.repeat_interval_days ?? null,
      input.repeat_until ?? null,
      input.registration_enabled ?? 0,
      input.capacity ?? null,
      input.capacity_scope ?? 'occurrence',
      input.registration_cutoff_hours ?? 0,
      id,
    )
    .run()
}

export async function deleteEvent(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
}

export async function getCancelledOccurrenceMap(db: D1Database): Promise<Map<string, Set<string>>> {
  const { results } = await db
    .prepare('SELECT event_id, occurrence_date FROM event_occurrence_cancellations')
    .all<{ event_id: string; occurrence_date: string }>()
  const map = new Map<string, Set<string>>()
  for (const row of results ?? []) {
    if (!map.has(row.event_id)) map.set(row.event_id, new Set())
    map.get(row.event_id)!.add(row.occurrence_date)
  }
  return map
}

export async function listExpandedPublishedEvents(
  db: D1Database,
  category?: string,
  upcomingOnly = true,
): Promise<ReturnType<typeof expandEventOccurrences>> {
  const [events, cancelled] = await Promise.all([
    listPublishedEvents(db, category),
    getCancelledOccurrenceMap(db),
  ])
  return expandEventOccurrences(events, cancelled, { upcomingOnly })
}

export async function cancelEventSeries(
  db: D1Database,
  eventId: string,
  message?: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE events SET cancelled_at = datetime('now'), cancellation_message = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(message ?? null, eventId)
    .run()
}

export async function cancelEventOccurrence(
  db: D1Database,
  eventId: string,
  occurrenceDate: string,
  message?: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO event_occurrence_cancellations (event_id, occurrence_date, cancellation_message)
       VALUES (?, ?, ?)
       ON CONFLICT(event_id, occurrence_date) DO UPDATE SET
         cancelled_at = datetime('now'),
         cancellation_message = excluded.cancellation_message`,
    )
    .bind(eventId, occurrenceDate, message ?? null)
    .run()
}

export async function markOccurrenceGuestsNotified(
  db: D1Database,
  eventId: string,
  occurrenceDate: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE event_occurrence_cancellations SET guests_notified = 1
       WHERE event_id = ? AND occurrence_date = ?`,
    )
    .bind(eventId, occurrenceDate)
    .run()
}
