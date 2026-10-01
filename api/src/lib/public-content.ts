import { sanitizeCmsHtml, sanitizeRegionsJson } from './html-sanitize'
import { sanitizeHttpUrl } from './http-url'

export function sanitizePublicPage(page: Record<string, unknown>, apiOrigin: string): Record<string, unknown> {
  const out = { ...page }
  if (out.body_html != null) out.body_html = sanitizeCmsHtml(String(out.body_html), apiOrigin)
  if (out.regions_json != null) {
    out.regions_json = sanitizeRegionsJson(String(out.regions_json), apiOrigin)
  }
  return out
}

export function sanitizePublicPost(post: Record<string, unknown>, apiOrigin: string): Record<string, unknown> {
  const out = { ...post }
  if (out.body_html != null) out.body_html = sanitizeCmsHtml(String(out.body_html), apiOrigin)
  return out
}

export function sanitizePublicUrlField(value: unknown): string | null {
  return sanitizeHttpUrl(value == null ? null : String(value))
}
