import type { User } from '../config/roles'
import { countNewFormSubmissionsByType, sumNewSubmissionCounts, TRAINING_FORM_TYPES } from './forms-db'

export const BUILTIN_INBOX_KEYS = ['contact', 'applications', 'training', 'newsletter'] as const
export type BuiltinInboxKey = (typeof BUILTIN_INBOX_KEYS)[number]

export function isBuiltinInboxKey(key: string): key is BuiltinInboxKey {
  return (BUILTIN_INBOX_KEYS as readonly string[]).includes(key)
}

/** Maps a submission form_type to the inbox hub key used for access control. */
export function inboxKeyForFormType(formType: string): string {
  switch (formType) {
    case 'contact':
      return 'contact'
    case 'member_application':
    case 'award_application':
      return 'applications'
    case 'training_registration':
    case 'training_signin':
      return 'training'
    case 'newsletter':
      return 'newsletter'
    default:
      return formType
  }
}

export async function listUserInboxKeys(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT inbox_key FROM inbox_user_assignments WHERE user_id = ? ORDER BY inbox_key')
    .bind(userId)
    .all<{ inbox_key: string }>()
  return (results ?? []).map((row) => row.inbox_key)
}

export async function listInboxAssigneeIds(db: D1Database, inboxKey: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT user_id FROM inbox_user_assignments WHERE inbox_key = ? ORDER BY user_id')
    .bind(inboxKey)
    .all<{ user_id: string }>()
  return (results ?? []).map((row) => row.user_id)
}

export async function setInboxAssignees(db: D1Database, inboxKey: string, userIds: string[]): Promise<void> {
  await db.prepare('DELETE FROM inbox_user_assignments WHERE inbox_key = ?').bind(inboxKey).run()
  for (const userId of userIds) {
    await db
      .prepare('INSERT INTO inbox_user_assignments (user_id, inbox_key) VALUES (?, ?)')
      .bind(userId, inboxKey)
      .run()
  }
}

export async function deleteInboxAssignments(db: D1Database, inboxKey: string): Promise<void> {
  await db.prepare('DELETE FROM inbox_user_assignments WHERE inbox_key = ?').bind(inboxKey).run()
}

export function accessibleInboxKeys(user: User, assignedInboxKeys: string[], customSlugs: string[]): string[] {
  if (user.role === 'admin') {
    return [...BUILTIN_INBOX_KEYS, ...customSlugs]
  }

  const keys = new Set(assignedInboxKeys)
  if (user.role === 'trainer') keys.add('training')

  return [...keys].filter((key) => isBuiltinInboxKey(key) || customSlugs.includes(key))
}

/** Global nav badge — excludes training submissions (shown on the Training card). */
export async function countAccessibleInboxNew(
  db: D1Database,
  user: User,
  assignedInboxKeys: string[],
  customSlugs: string[],
): Promise<number> {
  if (user.role === 'admin') {
    const placeholders = TRAINING_FORM_TYPES.map(() => '?').join(', ')
    const row = await db
      .prepare(
        `SELECT COUNT(*) as c FROM form_submissions
         WHERE status = 'new' AND form_type NOT IN (${placeholders})`,
      )
      .bind(...TRAINING_FORM_TYPES)
      .first<{ c: number }>()
    return Number(row?.c) || 0
  }

  const keys = accessibleInboxKeys(user, assignedInboxKeys, customSlugs)
  if (!keys.length) return 0

  const newCounts = await countNewFormSubmissionsByType(db)
  let total = 0
  for (const key of keys) {
    if (key === 'training') continue
    if (key === 'contact') total += newCounts.contact ?? 0
    else if (key === 'applications') {
      total += sumNewSubmissionCounts(newCounts, ['member_application', 'award_application'])
    } else if (key === 'newsletter') total += newCounts.newsletter ?? 0
    else total += newCounts[key] ?? 0
  }
  return total
}
