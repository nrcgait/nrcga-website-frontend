export type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export type Env = {
  DB: D1Database
  R2: R2Bucket
  ASSETS: Fetcher
  EMAIL?: SendEmail
  JWT_SECRET: string
  ADMIN_PASSWORD: string
  ADMIN_EMAIL: string
  PUBLIC_SITE_ORIGIN: string
  LOGIN_RATE_LIMITER: RateLimiter
  PUBLIC_WRITE_RATE_LIMITER: RateLimiter
}
