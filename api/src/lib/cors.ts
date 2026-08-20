import type { Context } from 'hono'
import type { Env } from '../env'

export function corsHeaders(origin: string, env: Env): HeadersInit {
  const allowed = new Set([
    env.PUBLIC_SITE_ORIGIN,
    'https://nrcga.org',
    'https://www.nrcga.org',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'https://nrcga-website-staging.pages.dev',
    'https://nrcga.ayowerks.com',
    'https://ayowerks.com',
    'https://www.ayowerks.com',
  ])
  const isPagesPreview = /^https:\/\/[a-z0-9-]+\.nrcga-website-staging\.pages\.dev$/i.test(origin)
  const isAyowerks = /^https:\/\/([a-z0-9-]+\.)?ayowerks\.com$/i.test(origin)
  const isNrcga = /^https:\/\/(www\.)?nrcga\.org$/i.test(origin)
  const requestOrigin =
    origin && (allowed.has(origin) || isPagesPreview || isAyowerks || isNrcga || origin.endsWith('.pages.dev'))
      ? origin
      : env.PUBLIC_SITE_ORIGIN
  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

export function withCors(
  c: Context<{ Bindings: Env }>,
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
) {
  const headers = {
    ...(corsHeaders(c.req.header('Origin') ?? '', c.env) as Record<string, string>),
    ...(extraHeaders ?? {}),
  }
  return c.json(body, status as 200, headers)
}

/** Short browser/CDN cache for public read-only JSON (admin/forms stay uncached). */
export const PUBLIC_JSON_CACHE = { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
