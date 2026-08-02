import type { User } from '../config/roles'
import type { Env } from '../env'
import { getUserById, listChairCommittees } from './auth'
import { countAllNewFormSubmissions } from './forms-db'

export type AdminContext = {
  user: User
  chairCommittees: string[]
  /** New (unread) form submissions — only loaded for admins who can open Inboxes. */
  inboxNewCount: number
}

export async function loadAdminContext(env: Env, userId: string): Promise<AdminContext | null> {
  const user = await getUserById(env.DB, userId)
  if (!user) return null
  const chairCommittees = user.role === 'chair' ? await listChairCommittees(env.DB, userId) : []
  const inboxNewCount = user.role === 'admin' ? await countAllNewFormSubmissions(env.DB) : 0
  return { user, chairCommittees, inboxNewCount }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
