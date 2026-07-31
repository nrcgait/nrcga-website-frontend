import type { User, UserRole } from '../config/roles'
import type { Env } from '../env'
import { hashPassword, randomSaltHex, verifyPassword } from './password'
import { likePattern, paginateQuery } from './pagination'

type UserRow = {
  id: string
  email: string
  password_hash: string
  password_salt: string
  role: UserRole
  display_name: string | null
  member_id: string | null
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    display_name: row.display_name,
    member_id: row.member_id,
  }
}

const USER_SELECT = `SELECT id, email, password_hash, password_salt, role, display_name, member_id FROM users`

export async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>()
  return row?.c ?? 0
}

export async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db
    .prepare(`${USER_SELECT} WHERE email = ?`)
    .bind(email.toLowerCase().trim())
    .first<UserRow>()
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare(`${USER_SELECT} WHERE id = ?`).bind(id).first<UserRow>()
  return row ? mapUser(row) : null
}

export async function createUser(
  db: D1Database,
  email: string,
  password: string,
  role: UserRole,
  displayName?: string,
  memberId?: string | null,
): Promise<string> {
  const id = crypto.randomUUID()
  const salt = randomSaltHex()
  const password_hash = await hashPassword(password, salt)
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, password_salt, role, display_name, member_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, email.toLowerCase().trim(), password_hash, salt, role, displayName ?? null, memberId ?? null)
    .run()
  return id
}

export async function updateUser(
  db: D1Database,
  id: string,
  data: {
    email?: string
    role?: UserRole
    display_name?: string | null
    member_id?: string | null
    password?: string
  },
): Promise<void> {
  const existing = await db.prepare(`${USER_SELECT} WHERE id = ?`).bind(id).first<UserRow>()
  if (!existing) return

  let password_hash = existing.password_hash
  let password_salt = existing.password_salt
  if (data.password) {
    password_salt = randomSaltHex()
    password_hash = await hashPassword(data.password, password_salt)
  }

  await db
    .prepare(
      `UPDATE users SET
         email = ?,
         password_hash = ?,
         password_salt = ?,
         role = ?,
         display_name = ?,
         member_id = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(
      data.email?.toLowerCase().trim() ?? existing.email,
      password_hash,
      password_salt,
      data.role ?? existing.role,
      data.display_name !== undefined ? data.display_name : existing.display_name,
      data.member_id !== undefined ? data.member_id : existing.member_id,
      id,
    )
    .run()
}

export async function verifyUserLogin(env: Env, email: string, password: string): Promise<User | null> {
  const row = await findUserByEmail(env.DB, email)
  if (!row) return null
  const ok = await verifyPassword(password, row.password_salt, row.password_hash)
  if (!ok) return null
  return mapUser(row)
}

export async function ensureBootstrapAdmin(env: Env): Promise<void> {
  const count = await countUsers(env.DB)
  if (count > 0) return
  await createUser(env.DB, env.ADMIN_EMAIL, env.ADMIN_PASSWORD, 'admin', 'Site Admin')
}

export async function listUsers(db: D1Database): Promise<User[]> {
  const { results } = await db
    .prepare(`SELECT id, email, role, display_name, member_id FROM users ORDER BY role, email`)
    .all<UserRow>()
  return (results ?? []).map(mapUser)
}

export async function listUsersPaginated(db: D1Database, page: number, search = '') {
  const term = search.trim()
  if (!term) {
    return paginateQuery<User>(
      db,
      'SELECT COUNT(*) as c FROM users',
      'SELECT id, email, role, display_name, member_id FROM users ORDER BY role, email',
      page,
    )
  }

  const pattern = likePattern(term)
  const binds = [pattern, pattern, pattern, pattern]
  const where = `WHERE (
    u.email LIKE ? ESCAPE '\\' OR
    u.display_name LIKE ? ESCAPE '\\' OR
    u.role LIKE ? ESCAPE '\\' OR
    m.company_name LIKE ? ESCAPE '\\'
  )`

  return paginateQuery<User>(
    db,
    `SELECT COUNT(*) as c FROM users u LEFT JOIN members m ON m.id = u.member_id ${where}`,
    `SELECT u.id, u.email, u.role, u.display_name, u.member_id FROM users u LEFT JOIN members m ON m.id = u.member_id ${where} ORDER BY u.role, u.email`,
    page,
    binds,
  )
}

export async function listChairCommittees(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT committee_slug FROM chair_committee_assignments WHERE user_id = ?')
    .bind(userId)
    .all<{ committee_slug: string }>()
  return (results ?? []).map((r) => r.committee_slug)
}

export async function assignChairCommittees(
  db: D1Database,
  userId: string,
  committeeSlugs: string[],
): Promise<void> {
  await db.prepare('DELETE FROM chair_committee_assignments WHERE user_id = ?').bind(userId).run()
  for (const slug of committeeSlugs) {
    await db
      .prepare('INSERT INTO chair_committee_assignments (user_id, committee_slug) VALUES (?, ?)')
      .bind(userId, slug)
      .run()
  }
}

export async function getMemberIdForUser(db: D1Database, userId: string): Promise<string | null> {
  const row = await db.prepare('SELECT member_id FROM users WHERE id = ?').bind(userId).first<{ member_id: string | null }>()
  return row?.member_id ?? null
}

export async function findUserLinkedToMember(db: D1Database, memberId: string, excludeUserId?: string): Promise<User | null> {
  let query = 'SELECT id, email, role, display_name, member_id FROM users WHERE member_id = ?'
  const binds: string[] = [memberId]
  if (excludeUserId) {
    query += ' AND id != ?'
    binds.push(excludeUserId)
  }
  const row = await db.prepare(query).bind(...binds).first<UserRow>()
  return row ? mapUser(row) : null
}
