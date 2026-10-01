import sanitizeHtml from 'sanitize-html'
import { sanitizeHttpUrl } from './http-url'

const IFRAME_HOST_PATTERNS = [
  /^https:\/\/(www\.)?youtube\.com\//i,
  /^https:\/\/(www\.)?youtube-nocookie\.com\//i,
  /^https:\/\/youtu\.be\//i,
  /^https:\/\/forms\.office\.com\//i,
  /^https:\/\/forms\.microsoft\.com\//i,
  /^https:\/\/docs\.google\.com\/forms\//i,
  /^https:\/\/([a-z0-9-]+\.)?typeform\.com\//i,
  /^https:\/\/([a-z0-9-]+\.)?jotform\.com\//i,
  /^https:\/\/form\.jotform\.com\//i,
]

export function isAllowedIframeSrc(src: string, apiOrigin?: string): boolean {
  const trimmed = src.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/api/v1/media/')) return true
  if (apiOrigin && trimmed.startsWith(`${apiOrigin}/api/v1/media/`)) return true
  if (!/^https:\/\//i.test(trimmed)) return false
  return IFRAME_HOST_PATTERNS.some((re) => re.test(trimmed))
}

export function isAllowedResourceUrl(url: string, apiOrigin?: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/api/v1/media/')) return true
  if (apiOrigin && trimmed.startsWith(`${apiOrigin}/api/v1/media/`)) return true
  return sanitizeHttpUrl(trimmed) !== null
}

function sanitizeOptions(apiOrigin?: string): sanitizeHtml.IOptions {
  return {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'iframe',
      'figure',
      'figcaption',
      'section',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel', 'class', 'title'],
      img: ['src', 'alt', 'width', 'height', 'class', 'loading', 'title'],
      iframe: ['src', 'width', 'height', 'title', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy', 'sandbox'],
      div: ['class', 'id', 'style'],
      span: ['class', 'id', 'style'],
      p: ['class', 'style'],
      section: ['class', 'style'],
      figure: ['class', 'style'],
      table: ['class'],
      td: ['class', 'colspan', 'rowspan'],
      th: ['class', 'colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
      iframe: ['https'],
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? ''
        if (href && !isAllowedResourceUrl(href, apiOrigin)) {
          delete attribs.href
        }
        if (attribs.target === '_blank') {
          attribs.rel = 'noopener noreferrer'
        }
        return { tagName, attribs }
      },
      img: (tagName, attribs) => {
        const src = attribs.src ?? ''
        if (src && !isAllowedResourceUrl(src, apiOrigin)) {
          delete attribs.src
        }
        return { tagName, attribs }
      },
      iframe: (tagName, attribs) => {
        const src = attribs.src ?? ''
        if (!isAllowedIframeSrc(src, apiOrigin)) {
          return { tagName: 'div', attribs: {}, text: '' }
        }
        attribs.referrerpolicy = 'strict-origin-when-cross-origin'
        if (/forms\.(office|microsoft)\.com|google\.com\/forms|typeform|jotform/i.test(src)) {
          attribs.sandbox = 'allow-scripts allow-forms allow-popups allow-same-origin'
        }
        return { tagName, attribs }
      },
    },
  }
}

/** Strip scripts and unsafe markup; allow rich text + vetted embeds. */
export function sanitizeCmsHtml(html: string | null | undefined, apiOrigin?: string): string {
  if (!html) return ''
  return sanitizeHtml(String(html), sanitizeOptions(apiOrigin))
}

export function sanitizeRegionsJson(raw: string | null | undefined, apiOrigin?: string): string | null {
  if (!raw) return null
  try {
    const regions = JSON.parse(String(raw)) as Record<string, unknown>
    if (regions.hero_html != null) regions.hero_html = sanitizeCmsHtml(String(regions.hero_html), apiOrigin)
    if (regions.contact_html != null) regions.contact_html = sanitizeCmsHtml(String(regions.contact_html), apiOrigin)
    return JSON.stringify(regions)
  } catch {
    return raw
  }
}
