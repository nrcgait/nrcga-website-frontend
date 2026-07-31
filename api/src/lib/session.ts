import { sign, verify } from 'hono/jwt'
import type { UserRole } from '../config/roles'
import type { Env } from '../env'

const COOKIE_NAME = 'nrcga_admin_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 7

export type SessionPayload = {
  sub: string
  role: UserRole
  exp: number
}

export async function createSessionToken(userId: string, role: UserRole, env: Env): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC
  return await sign({ sub: userId, role, exp }, env.JWT_SECRET, 'HS256')
}

export async function verifySessionToken(
  token: string | undefined,
  env: Env,
): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256')
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null
    if (payload.role !== 'admin' && payload.role !== 'user' && payload.role !== 'chair' && payload.role !== 'trainer') return null
    return { sub: payload.sub, role: payload.role as UserRole, exp: Number(payload.exp) }
  } catch {
    return null
  }
}

export function sessionCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}`
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  return match?.[1]
}
