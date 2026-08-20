import type { User } from '../config/roles'
import { canAccessInboxesSection } from '../config/roles'
import type { Env } from '../env'
import { getUserById, listChairCommittees } from './auth'
import { countAccessibleInboxNew, listUserInboxKeys } from './inbox-access'
import { listFormInboxes } from './forms-db'

export type AdminContext = {
  user: User
  chairCommittees: string[]
  /** Inbox keys this user was explicitly assigned to (admins see all regardless). */
  assignedInboxKeys: string[]
  /** New (unread) form submissions across accessible inboxes — for nav badge. */
  inboxNewCount: number
}

export async function loadAdminContext(env: Env, userId: string): Promise<AdminContext | null> {
  const user = await getUserById(env.DB, userId)
  if (!user) return null
  const chairCommittees = user.role === 'chair' ? await listChairCommittees(env.DB, userId) : []
  const assignedInboxKeys = user.role === 'admin' ? [] : await listUserInboxKeys(env.DB, userId)
  let inboxNewCount = 0
  if (canAccessInboxesSection(user.role, assignedInboxKeys)) {
    const customInboxes = await listFormInboxes(env.DB)
    const customSlugs = customInboxes.map((row) => String(row.slug))
    inboxNewCount = await countAccessibleInboxNew(env.DB, user, assignedInboxKeys, customSlugs)
  }
  return { user, chairCommittees, assignedInboxKeys, inboxNewCount }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
