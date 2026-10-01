import type { Env } from '../env'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Cloudflare test secret — always passes in dev when paired with test site key. */
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA'

export function isTurnstileConfigured(env: Env): boolean {
  return Boolean(env.TURNSTILE_SECRET?.trim())
}

export async function verifyTurnstileToken(
  env: Env,
  token: string | undefined,
  remoteIp?: string,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET?.trim()
  if (!secret) return false
  const trimmed = (token ?? '').trim()
  if (!trimmed) return false

  const body = new URLSearchParams({ secret, response: trimmed })
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
