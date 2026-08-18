import type { Env } from '../env'
import type { EventRecord } from './event-repeat'
import { expandEventOccurrences } from './event-repeat'
import { getCancelledOccurrenceMap } from './events-db'
import { instantOnNevadaDate, parseToInstant } from './nevada-time'
import { sendRegistrationConfirmation } from './site-settings'

export type RegistrationInput = {
  guest_name: string
  guest_email: string
  guest_phone?: string
  organization?: string
  spot_count: number
  notes?: string
}

export type Availability = {
  registered: number
  capacity: number | null
  available: number | null
  isFull: boolean
  cancelled: boolean
}

export async function isValidOccurrence(
  db: D1Database,
  event: EventRecord,
  occurrenceDate: string,
): Promise<boolean> {
  if (event.cancelled_at) return false
  const cancelled = await getCancelledOccurrenceMap(db)
  const expanded = expandEventOccurrences([event], cancelled, { upcomingOnly: false })
  return expanded.some((o) => o.occurrence_date === occurrenceDate && !o.cancelled)
}

export async function getRegisteredSpots(
  db: D1Database,
  event: EventRecord,
  occurrenceDate: string,
): Promise<number> {
  if (event.capacity_scope === 'series') {
    const row = await db
      .prepare('SELECT COALESCE(SUM(spot_count), 0) as total FROM event_registrations WHERE event_id = ?')
      .bind(event.id)
      .first<{ total: number }>()
    return row?.total ?? 0
  }
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(spot_count), 0) as total FROM event_registrations
       WHERE event_id = ? AND occurrence_date = ?`,
    )
    .bind(event.id, occurrenceDate)
    .first<{ total: number }>()
  return row?.total ?? 0
}

export async function getAvailability(
  db: D1Database,
  event: EventRecord,
  occurrenceDate: string,
): Promise<Availability> {
  const cancelledMap = await getCancelledOccurrenceMap(db)
  const cancelled =
    Boolean(event.cancelled_at) || (cancelledMap.get(event.id)?.has(occurrenceDate) ?? false)
  const registered = await getRegisteredSpots(db, event, occurrenceDate)
  const capacity = event.registration_enabled ? event.capacity : null
  const available = capacity == null ? null : Math.max(0, capacity - registered)
  return {
    registered,
    capacity,
    available,
    isFull: capacity != null ? registered >= capacity : false,
    cancelled,
  }
}

function occurrenceStartInstant(event: EventRecord, occurrenceDate: string): Date | null {
  const start = parseToInstant(event.starts_at)
  if (!start) return null
  return instantOnNevadaDate(start, occurrenceDate)
}

function isPastCutoff(event: EventRecord, occurrenceDate: string): boolean {
  const hours = event.registration_cutoff_hours ?? 0
  const occurrenceStart = occurrenceStartInstant(event, occurrenceDate)
  if (!occurrenceStart) return false
  const cutoff = new Date(occurrenceStart.getTime() - hours * 60 * 60 * 1000)
  return Date.now() > cutoff.getTime()
}

export async function registerGuest(
  env: Env,
  event: EventRecord,
  occurrenceDate: string,
  input: RegistrationInput,
): Promise<
  | {
      ok: true
      registrationId: string
      emailSent: boolean
      availability: Availability
    }
  | { ok: false; error: string }
> {
  if (!event.registration_enabled) return { ok: false, error: 'Registration is not enabled for this event.' }
  if (!(await isValidOccurrence(env.DB, event, occurrenceDate))) {
    return { ok: false, error: 'This event occurrence is not available.' }
  }
  const availability = await getAvailability(env.DB, event, occurrenceDate)
  if (availability.cancelled) return { ok: false, error: 'This event has been cancelled.' }
  if (isPastCutoff(event, occurrenceDate)) {
    return { ok: false, error: 'Registration is closed for this event.' }
  }
  if (input.spot_count < 1) return { ok: false, error: 'At least one spot is required.' }

  const spotCount = Math.floor(input.spot_count)
  if (availability.capacity != null && availability.registered + spotCount > availability.capacity) {
    return { ok: false, error: 'Not enough spots available.' }
  }

  const email = input.guest_email.toLowerCase().trim()
  const existing = await env.DB.prepare(
    `SELECT id FROM event_registrations WHERE event_id = ? AND occurrence_date = ? AND guest_email = ?`,
  )
    .bind(event.id, occurrenceDate, email)
    .first<{ id: string }>()

  let registrationId: string
  if (existing) {
    registrationId = existing.id
    await env.DB.prepare(
      `UPDATE event_registrations SET guest_name = ?, guest_phone = ?, organization = ?,
       spot_count = ?, notes = ?, registered_at = datetime('now') WHERE id = ?`,
    )
      .bind(
        input.guest_name.trim(),
        input.guest_phone?.trim() ?? null,
        input.organization?.trim() ?? null,
        spotCount,
        input.notes?.trim() ?? null,
        registrationId,
      )
      .run()
  } else {
    registrationId = crypto.randomUUID()
    await env.DB.prepare(
      `INSERT INTO event_registrations (
        id, event_id, occurrence_date, guest_name, guest_email, guest_phone, organization, spot_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        registrationId,
        event.id,
        occurrenceDate,
        input.guest_name.trim(),
        email,
        input.guest_phone?.trim() ?? null,
        input.organization?.trim() ?? null,
        spotCount,
        input.notes?.trim() ?? null,
      )
      .run()
  }

  const updatedAvailability = await getAvailability(env.DB, event, occurrenceDate)
  const emailSent = await sendRegistrationConfirmation(env, {
    to: email,
    eventTitle: event.title,
    occurrenceDate,
    startsAt: occurrenceStartInstant(event, occurrenceDate)?.toISOString() ?? event.starts_at,
    location: event.location ?? '',
    guestName: input.guest_name.trim(),
    spotCount,
  })

  return { ok: true, registrationId, emailSent, availability: updatedAvailability }
}

export async function listRegistrations(
  db: D1Database,
  eventId: string,
  occurrenceDate?: string,
): Promise<
  Array<{
    id: string
    guest_name: string
    guest_email: string
    guest_phone: string | null
    organization: string | null
    spot_count: number
    occurrence_date: string
    registered_at: string
  }>
> {
  let query = 'SELECT * FROM event_registrations WHERE event_id = ?'
  const binds: string[] = [eventId]
  if (occurrenceDate) {
    query += ' AND occurrence_date = ?'
    binds.push(occurrenceDate)
  }
  query += ' ORDER BY registered_at DESC'
  const { results } = await db.prepare(query).bind(...binds).all()
  return (results ?? []) as Array<{
    id: string
    guest_name: string
    guest_email: string
    guest_phone: string | null
    organization: string | null
    spot_count: number
    occurrence_date: string
    registered_at: string
  }>
}

import { paginateQuery } from './pagination'

export async function listRegistrationsPaginated(db: D1Database, eventId: string, page: number) {
  return paginateQuery<{
    id: string
    guest_name: string
    guest_email: string
    guest_phone: string | null
    organization: string | null
    spot_count: number
    occurrence_date: string
    registered_at: string
  }>(
    db,
    'SELECT COUNT(*) as c FROM event_registrations WHERE event_id = ?',
    'SELECT * FROM event_registrations WHERE event_id = ? ORDER BY registered_at DESC',
    page,
    [eventId],
  )
}

export async function deleteRegistration(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM event_registrations WHERE id = ?').bind(id).run()
}
