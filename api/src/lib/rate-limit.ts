import type { Context } from 'hono'
import type { Env, RateLimiter } from '../env'

export const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again in a minute.'
export const LOGIN_RATE_LIMIT_MESSAGE = 'Too many sign-in attempts. Please wait a minute and try again.'
export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60

export function clientIp(c: Context<{ Bindings: Env }>): string {
  const forwarded = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
  return c.req.header('CF-Connecting-IP') || c.req.header('True-Client-IP') || forwarded || 'unknown'
}

export function rateLimitHeaders(): Record<string, string> {
  return { 'Retry-After': String(RATE_LIMIT_RETRY_AFTER_SECONDS) }
}

/** Returns false when the key has exceeded its quota. Missing/failing limiters fail open. */
export async function consumeRateLimit(limiter: RateLimiter | undefined, key: string): Promise<boolean> {
  if (!limiter) return true
  try {
    const { success } = await limiter.limit({ key })
    return success
  } catch (err) {
    console.error('rate limit check failed', err)
    return true
  }
}

export async function consumeRateLimits(limiter: RateLimiter | undefined, keys: string[]): Promise<boolean> {
  for (const key of keys) {
    if (!(await consumeRateLimit(limiter, key))) return false
  }
  return true
}
