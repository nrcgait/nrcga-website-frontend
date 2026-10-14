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

const NRCGA_NATIVE_INPUT_TYPES = new Set(['text', 'email', 'tel', 'url', 'hidden'])

/** Site forms posted via POST /api/v1/forms/:type (data-nrcga-form). */
export function isNativeNrcgaFormElement(attribs: Record<string, string>): boolean {
  const formType = attribs['data-nrcga-form']?.trim()
  if (formType && /^[a-z][a-z0-9_]*$/i.test(formType)) return true
  const cls = attribs.class ?? ''
  return cls.split(/\s+/).includes('nrcga-form')
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
      'form',
      'input',
      'textarea',
      'button',
      'label',
      'select',
      'option',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel', 'class', 'title'],
      img: ['src', 'alt', 'width', 'height', 'class', 'loading', 'title'],
      iframe: ['src', 'width', 'height', 'title', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy', 'sandbox'],
      div: ['class', 'id', 'style', 'aria-hidden'],
      span: ['class', 'id', 'style'],
      p: ['class', 'style', 'data-form-status'],
      section: ['class', 'style'],
      figure: ['class', 'style'],
      table: ['class'],
      td: ['class', 'colspan', 'rowspan'],
      th: ['class', 'colspan', 'rowspan'],
      form: ['class', 'style', 'data-nrcga-form', 'data-success-message'],
      input: ['type', 'name', 'id', 'value', 'required', 'style', 'autocomplete', 'tabindex', 'placeholder'],
      textarea: ['name', 'id', 'rows', 'required', 'style', 'placeholder'],
      button: ['type', 'class'],
      label: ['for', 'class'],
      select: ['name', 'id', 'required', 'class'],
      option: ['value'],
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
      form: (tagName, attribs) => {
        if (!isNativeNrcgaFormElement(attribs)) {
          return { tagName: 'div', attribs: {}, text: '' }
        }
        delete attribs.action
        delete attribs.method
        delete attribs.enctype
        return { tagName, attribs }
      },
      input: (tagName, attribs) => {
        const type = String(attribs.type ?? 'text').toLowerCase()
        if (!NRCGA_NATIVE_INPUT_TYPES.has(type)) {
          return { tagName: 'div', attribs: {}, text: '' }
        }
        if (type === 'hidden' && attribs.name === 'website_url') {
          return { tagName, attribs }
        }
        const name = attribs.name?.trim()
        if (!name || !/^[a-z][a-z0-9_]*$/i.test(name)) {
          return { tagName: 'div', attribs: {}, text: '' }
        }
        return { tagName, attribs }
      },
      textarea: (tagName, attribs) => {
        const name = attribs.name?.trim()
        if (!name || !/^[a-z][a-z0-9_]*$/i.test(name)) {
          return { tagName: 'div', attribs: {}, text: '' }
        }
        return { tagName, attribs }
      },
      button: (tagName, attribs) => {
        if (attribs.type !== 'submit') {
          return { tagName: 'div', attribs: {}, text: '' }
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
