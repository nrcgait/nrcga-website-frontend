export const USER_ROLES = ['admin', 'chair', 'user', 'trainer'] as const
export type UserRole = (typeof USER_ROLES)[number]

export type User = {
  id: string
  email: string
  role: UserRole
  display_name: string | null
  member_id: string | null
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  chair: 'Committee Chair',
  user: 'User',
  trainer: 'Trainer',
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'admin'
}

export function canManageNavigation(role: UserRole): boolean {
  return role === 'admin'
}

export function canManageMembers(role: UserRole): boolean {
  return role === 'admin'
}

export function canEditOwnMember(role: UserRole): boolean {
  return role === 'user' || role === 'trainer'
}

export function canManageAllEvents(role: UserRole): boolean {
  return role === 'admin'
}

export function canAccessEventsSection(role: UserRole, chairCommittees: string[]): boolean {
  if (role === 'admin' || role === 'trainer') return true
  return role === 'chair' && chairCommittees.length > 0
}

export function canManageAllContent(role: UserRole): boolean {
  return role === 'admin'
}

export function canManageCommitteeContent(role: UserRole, chairCommittees: string[]): boolean {
  return role === 'chair' && chairCommittees.length > 0
}

export function canAccessContentSection(role: UserRole, chairCommittees: string[]): boolean {
  return canManageAllContent(role) || canManageCommitteeContent(role, chairCommittees)
}

export function canAccessAssets(role: UserRole): boolean {
  return role === 'admin' || role === 'chair' || role === 'trainer'
}
