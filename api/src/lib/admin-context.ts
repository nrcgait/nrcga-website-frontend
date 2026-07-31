import type { User } from '../config/roles'
import type { Env } from '../env'
import { getUserById, listChairCommittees } from './auth'

export type AdminContext = {
  user: User
  chairCommittees: string[]
}

export async function loadAdminContext(env: Env, userId: string): Promise<AdminContext | null> {
  const user = await getUserById(env.DB, userId)
  if (!user) return null
  const chairCommittees = user.role === 'chair' ? await listChairCommittees(env.DB, userId) : []
  return { user, chairCommittees }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
