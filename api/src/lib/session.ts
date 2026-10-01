import { sign, verify } from 'hono/jwt'
import type { UserRole } from '../config/roles'
import type { Env } from '../env'

export const SECURE_COOKIE_NAME = '__Host-nrcga_admin_session'
export const DEV_COOKIE_NAME = 'nrcga_admin_session'
/** @deprecated Use SECURE_COOKIE_NAME or DEV_COOKIE_NAME */
export const COOKIE_NAME = SECURE_COOKIE_NAME
const MAX_AGE_SEC = 60 * 60 * 24 * 7

export type SessionPayload = {
  sub: string
  role: UserRole
  sv: number
  exp: number
}

export async function createSessionToken(
  userId: string,
  role: UserRole,
  sessionVersion: number,
  env: Env,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC
  return await sign({ sub: userId, role, sv: sessionVersion, exp }, env.JWT_SECRET, 'HS256')
}

export async function verifySessionToken(
  token: string | undefined,
  env: Env,
): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256')
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null
    if (payload.role !== 'admin' && payload.role !== 'user' && payload.role !== 'chair' && payload.role !== 'trainer') {
      return null
    }
    const sv = Number(payload.sv)
    if (!Number.isFinite(sv) || sv < 1) return null
    return { sub: payload.sub, role: payload.role as UserRole, sv, exp: Number(payload.exp) }
  } catch {
    return null
  }
}

export function sessionCookieHeader(token: string, secure = true): string {
  const name = secure ? SECURE_COOKIE_NAME : DEV_COOKIE_NAME
  const securePart = secure ? '; Secure' : ''
  return `${name}=${token}; Path=/; HttpOnly${securePart}; SameSite=Lax; Max-Age=${MAX_AGE_SEC}`
}

export function clearSessionCookieHeader(secure = true): string {
  const name = secure ? SECURE_COOKIE_NAME : DEV_COOKIE_NAME
  const securePart = secure ? '; Secure' : ''
  return `${name}=; Path=/; HttpOnly${securePart}; SameSite=Lax; Max-Age=0`
}

export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined
  for (const name of [SECURE_COOKIE_NAME, DEV_COOKIE_NAME]) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
    if (match?.[1]) return match[1]
  }
  return undefined
}
