import type { User, UserRole } from '../config/roles'
import { listChairCommittees } from './auth'
import type { EventRecord } from './event-repeat'
import { listFormInboxes } from './forms-db'
import {
  accessibleInboxKeys,
  BUILTIN_INBOX_KEYS,
  listUserInboxKeys,
} from './inbox-access'
import { userCanAccessEvent } from './permissions'

export const NOTIFY_MODES = ['none', 'all', 'selected'] as const
export type NotifyMode = (typeof NOTIFY_MODES)[number]

export type NotificationPrefs = {
  event_mode: NotifyMode
  form_mode: NotifyMode
  event_ids: string[]
  inbox_keys: string[]
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  event_mode: 'none',
  form_mode: 'none',
  event_ids: [],
  inbox_keys: [],
}

export const BUILTIN_INBOX_LABELS: Record<string, string> = {
  contact: 'Contact',
  applications: 'Applications',
  training: 'Training',
  newsletter: 'Newsletter',
}

export function canReceiveStaffNotifications(role: UserRole): boolean {
  return role === 'admin' || role === 'chair' || role === 'trainer'
}

function parseMode(value: unknown): NotifyMode {
  return NOTIFY_MODES.includes(value as NotifyMode) ? (value as NotifyMode) : 'none'
}

export async function getNotificationPrefs(db: D1Database, userId: string): Promise<NotificationPrefs> {
  const row = await db
    .prepare('SELECT event_mode, form_mode FROM user_notification_prefs WHERE user_id = ?')
    .bind(userId)
    .first<{ event_mode: string; form_mode: string }>()
  const [{ results: eventRows }, { results: inboxRows }] = await Promise.all([
    db
      .prepare('SELECT event_id FROM user_event_notification_subs WHERE user_id = ?')
      .bind(userId)
      .all<{ event_id: string }>(),
    db
      .prepare('SELECT inbox_key FROM user_inbox_notification_subs WHERE user_id = ?')
      .bind(userId)
      .all<{ inbox_key: string }>(),
  ])
  return {
    event_mode: parseMode(row?.event_mode),
    form_mode: parseMode(row?.form_mode),
    event_ids: (eventRows ?? []).map((r) => r.event_id),
    inbox_keys: (inboxRows ?? []).map((r) => r.inbox_key),
  }
}

export async function saveNotificationPrefs(
  db: D1Database,
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_notification_prefs (user_id, event_mode, form_mode, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         event_mode = excluded.event_mode,
         form_mode = excluded.form_mode,
         updated_at = datetime('now')`,
    )
    .bind(userId, parseMode(prefs.event_mode), parseMode(prefs.form_mode))
    .run()

  await db.prepare('DELETE FROM user_event_notification_subs WHERE user_id = ?').bind(userId).run()
  const eventIds = [...new Set(prefs.event_ids.filter(Boolean))]
  for (const eventId of eventIds) {
    await db
      .prepare('INSERT INTO user_event_notification_subs (user_id, event_id) VALUES (?, ?)')
      .bind(userId, eventId)
      .run()
  }

  await db.prepare('DELETE FROM user_inbox_notification_subs WHERE user_id = ?').bind(userId).run()
  const inboxKeys = [...new Set(prefs.inbox_keys.filter(Boolean))]
  for (const inboxKey of inboxKeys) {
    await db
      .prepare('INSERT INTO user_inbox_notification_subs (user_id, inbox_key) VALUES (?, ?)')
      .bind(userId, inboxKey)
      .run()
  }
}

type PrefRow = {
  id: string
  email: string
  role: UserRole
  event_mode: NotifyMode
  form_mode: NotifyMode
}

async function listPrefRows(db: D1Database): Promise<PrefRow[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.email, u.role, p.event_mode, p.form_mode
       FROM user_notification_prefs p
       JOIN users u ON u.id = p.user_id
       WHERE p.event_mode IN ('all', 'selected') OR p.form_mode IN ('all', 'selected')`,
    )
    .all<PrefRow>()
  return (results ?? []).map((row) => ({
    ...row,
    event_mode: parseMode(row.event_mode),
    form_mode: parseMode(row.form_mode),
  }))
}

export async function listStaffEmailsForEvent(db: D1Database, event: EventRecord): Promise<string[]> {
  const rows = (await listPrefRows(db)).filter((row) => canReceiveStaffNotifications(row.role))
  if (!rows.length) return []
  const emails: string[] = []
  for (const row of rows) {
    if (row.event_mode === 'none') continue
    if (row.event_mode === 'selected') {
      const sub = await db
        .prepare('SELECT event_id FROM user_event_notification_subs WHERE user_id = ? AND event_id = ?')
        .bind(row.id, event.id)
        .first()
      if (sub) emails.push(row.email)
      continue
    }
    const committees = row.role === 'chair' ? await listChairCommittees(db, row.id) : []
    if (userCanAccessEvent(row.role, committees, event)) emails.push(row.email)
  }
  return [...new Set(emails)]
}

export async function listStaffEmailsForInbox(db: D1Database, inboxKey: string): Promise<string[]> {
  const rows = (await listPrefRows(db)).filter((row) => canReceiveStaffNotifications(row.role))
  if (!rows.length) return []
  const customInboxes = await listFormInboxes(db)
  const customSlugs = customInboxes.map((row) => String(row.slug))
  const emails: string[] = []
  for (const row of rows) {
    if (row.form_mode === 'none') continue
    if (row.form_mode === 'selected') {
      const sub = await db
        .prepare('SELECT inbox_key FROM user_inbox_notification_subs WHERE user_id = ? AND inbox_key = ?')
        .bind(row.id, inboxKey)
        .first()
      if (sub) emails.push(row.email)
      continue
    }
    const user: User = {
      id: row.id,
      email: row.email,
      role: row.role,
      display_name: null,
      member_id: null,
    }
    const assigned = row.role === 'admin' ? [] : await listUserInboxKeys(db, row.id)
    if (accessibleInboxKeys(user, assigned, customSlugs).includes(inboxKey)) emails.push(row.email)
  }
  return [...new Set(emails)]
}

export function inboxOptionsForUser(
  user: User,
  assignedInboxKeys: string[],
  customInboxes: Array<{ slug?: unknown; title?: unknown }>,
): Array<{ key: string; label: string }> {
  const customSlugs = customInboxes.map((row) => String(row.slug))
  const titles = new Map(customInboxes.map((row) => [String(row.slug), String(row.title || row.slug)]))
  return accessibleInboxKeys(user, assignedInboxKeys, customSlugs)
    .filter((key) => key !== 'newsletter')
    .map((key) => ({
      key,
      label: BUILTIN_INBOX_LABELS[key] ?? titles.get(key) ?? key,
    }))
}

export { BUILTIN_INBOX_KEYS }
