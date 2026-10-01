import { getR2Object } from './r2-assets'

/** Reject path traversal and non-upload keys before R2 fetch. */
export function normalizeMediaKey(rawPath: string): string | null {
  let key = rawPath.replace(/^\/+/, '')
  try {
    key = decodeURIComponent(key)
  } catch {
    return null
  }
  if (!key || key.includes('..') || key.includes('\\') || key.includes('\0')) return null
  if (!key.startsWith('uploads/')) return null
  return key
}

function safePublicContentType(key: string, stored: string | null | undefined): string {
  const lower = (stored || '').toLowerCase()
  if (/\.svg$/i.test(key) || lower.includes('svg')) {
    return 'application/octet-stream'
  }
  const allowed = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/bmp',
    'application/pdf',
  ])
  if (lower && allowed.has(lower)) return lower
  if (/\.(jpe?g)$/i.test(key)) return 'image/jpeg'
  if (/\.png$/i.test(key)) return 'image/png'
  if (/\.gif$/i.test(key)) return 'image/gif'
  if (/\.webp$/i.test(key)) return 'image/webp'
  if (/\.pdf$/i.test(key)) return 'application/pdf'
  return 'application/octet-stream'
}

export async function servePublicMedia(r2: R2Bucket, rawPath: string): Promise<Response | null> {
  const key = normalizeMediaKey(rawPath)
  if (!key) return null
  const object = await getR2Object(r2, key)
  if (!object) return null

  const headers = new Headers()
  const contentType = safePublicContentType(key, object.httpMetadata?.contentType)
  headers.set('Content-Type', contentType)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Cache-Control', 'public, max-age=86400')
  if (contentType === 'application/octet-stream') {
    const filename = key.split('/').pop() ?? 'download'
    headers.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`)
  }
  return new Response(object.body, { headers })
}
