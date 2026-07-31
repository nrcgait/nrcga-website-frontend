export type Env = {
  DB: D1Database
  R2: R2Bucket
  ASSETS: Fetcher
  EMAIL?: SendEmail
  JWT_SECRET: string
  ADMIN_PASSWORD: string
  ADMIN_EMAIL: string
  PUBLIC_SITE_ORIGIN: string
}
