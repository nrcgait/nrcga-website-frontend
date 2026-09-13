import type { Env } from '../env'
import { findUserByEmail } from './auth'
import { sendPasswordResetEmail } from './email'

const TOKEN_TTL_MS = 60 * 60 * 1000

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createPasswordResetToken(db: D1Database, userId: string): Promise<string> {
  await db
    .prepare(
      `UPDATE password_reset_tokens SET used_at = datetime('now')
       WHERE user_id = ? AND used_at IS NULL`,
    )
    .bind(userId)
    .run()
  const token = randomToken()
  const tokenHash = await sha256Hex(token)
  await db
    .prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), userId, tokenHash, new Date(Date.now() + TOKEN_TTL_MS).toISOString())
    .run()
  return token
}

export async function consumePasswordResetToken(db: D1Database, token: string): Promise<string | null> {
  const trimmed = token.trim()
  if (!trimmed) return null
  const tokenHash = await sha256Hex(trimmed)
  const row = await db
    .prepare(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>()
  if (!row || row.used_at) return null
  if (Date.parse(row.expires_at) < Date.now()) return null
  await db
    .prepare(`UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`)
    .bind(row.id)
    .run()
  return row.user_id
}

export async function peekPasswordResetToken(db: D1Database, token: string): Promise<boolean> {
  const trimmed = token.trim()
  if (!trimmed) return false
  const tokenHash = await sha256Hex(trimmed)
  const row = await db
    .prepare(`SELECT expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<{ expires_at: string; used_at: string | null }>()
  if (!row || row.used_at) return false
  return Date.parse(row.expires_at) >= Date.now()
}

const GENERIC_FORGOT_MESSAGE =
  'If that email is in our system, we sent a reset link. Check your inbox (and spam folder).'

export async function requestPasswordReset(
  env: Env,
  email: string,
  resetUrlForToken: (token: string) => string,
): Promise<string> {
  const user = await findUserByEmail(env.DB, email)
  if (!user) return GENERIC_FORGOT_MESSAGE
  const token = await createPasswordResetToken(env.DB, user.id)
  await sendPasswordResetEmail(env, user.email, resetUrlForToken(token))
  return GENERIC_FORGOT_MESSAGE
}
