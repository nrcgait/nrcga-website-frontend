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

const NRCGA_NATIVE_INPUT_TYPES = new Set(['text', 'email', 'tel', 'url', 'hidden'])
const FORM_CONTROL_TAGS = ['form', 'input', 'textarea', 'button', 'label', 'select', 'option'] as const
const FORM_SLOT_TOKEN = (index: number) => `NRCGAFORMPSLOT${index}END`

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

/** Site forms posted via POST /api/v1/forms/:type (data-nrcga-form). */
export function isNativeNrcgaFormElement(attribs: Record<string, string>): boolean {
  const formType = attribs['data-nrcga-form']?.trim()
  if (formType && /^[a-z][a-z0-9_]*$/i.test(formType)) return true
  const cls = attribs.class ?? ''
  return cls.split(/\s+/).includes('nrcga-form')
}

function parseTagAttribs(openTag: string): Record<string, string> {
  const attribs: Record<string, string> = {}
  const inner = openTag.replace(/^<[^>\s]+/i, '').replace(/\/?>$/, '')
  const re = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
  let match: RegExpExecArray | null
  while ((match = re.exec(inner))) {
    attribs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return attribs
}

function isFormTagStart(html: string, index: number): boolean {
  const after = index + 5
  return after >= html.length || /[\s>/]/.test(html[after] ?? '')
}

function extractNativeNrcgaForms(html: string): { html: string; forms: string[] } {
  const forms: string[] = []
  let out = ''
  let i = 0
  const lower = html.toLowerCase()
  while (i < html.length) {
    const start = lower.indexOf('<form', i)
    if (start === -1) {
      out += html.slice(i)
      break
    }
    if (!isFormTagStart(html, start)) {
      out += html.slice(i, start + 5)
      i = start + 5
      continue
    }
    const tagEnd = html.indexOf('>', start)
    if (tagEnd === -1) {
      out += html.slice(i)
      break
    }
    const openTag = html.slice(start, tagEnd + 1)
    const closeIdx = lower.indexOf('</form>', tagEnd + 1)
    const end = closeIdx === -1 ? html.length : closeIdx + 7
    if (isNativeNrcgaFormElement(parseTagAttribs(openTag))) {
      out += html.slice(i, start) + FORM_SLOT_TOKEN(forms.length)
      forms.push(html.slice(start, end))
    } else {
      out += html.slice(i, end)
    }
    i = end
  }
  return { html: out, forms }
}

function droppedNode() {
  return { tagName: 'span', attribs: { class: 'nrcga-dropped' }, text: '' }
}

function baseOptions(apiOrigin?: string): sanitizeHtml.IOptions {
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
      div: ['class', 'id', 'style', 'aria-hidden'],
      span: ['class', 'id', 'style'],
      p: ['class', 'style', 'data-form-status'],
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
    exclusiveFilter: (frame) => frame.tag === 'span' && frame.attribs?.class === 'nrcga-dropped',
  }
}

function remainderOptions(apiOrigin?: string): sanitizeHtml.IOptions {
  return baseOptions(apiOrigin)
}

function nativeFormOptions(apiOrigin?: string): sanitizeHtml.IOptions {
  const options = baseOptions(apiOrigin)
  const allowedTags = Array.isArray(options.allowedTags) ? options.allowedTags : []
  options.allowedTags = allowedTags.concat([...FORM_CONTROL_TAGS])
  options.allowedAttributes = {
    ...options.allowedAttributes,
    form: ['class', 'style', 'data-nrcga-form', 'data-success-message'],
    input: ['type', 'name', 'id', 'value', 'required', 'style', 'autocomplete', 'tabindex', 'placeholder'],
    textarea: ['name', 'id', 'rows', 'required', 'style', 'placeholder'],
    button: ['type', 'class'],
    label: ['for', 'class'],
    select: ['name', 'id', 'required', 'class'],
    option: ['value'],
  }
  options.transformTags = {
    ...options.transformTags,
    form: (tagName, attribs) => {
      if (!isNativeNrcgaFormElement(attribs)) return droppedNode()
      delete attribs.action
      delete attribs.method
      delete attribs.enctype
      return { tagName, attribs }
    },
    input: (tagName, attribs) => {
      const type = String(attribs.type ?? 'text').toLowerCase()
      if (!NRCGA_NATIVE_INPUT_TYPES.has(type)) return droppedNode()
      if (type === 'hidden' && attribs.name === 'website_url') {
        return { tagName, attribs }
      }
      const name = attribs.name?.trim()
      if (!name || !/^[a-z][a-z0-9_]*$/i.test(name)) return droppedNode()
      return { tagName, attribs }
    },
    textarea: (tagName, attribs) => {
      const name = attribs.name?.trim()
      if (!name || !/^[a-z][a-z0-9_]*$/i.test(name)) return droppedNode()
      return { tagName, attribs }
    },
    button: (tagName, attribs) => {
      if (attribs.type !== 'submit') return droppedNode()
      return { tagName, attribs }
    },
    select: (tagName, attribs) => {
      const name = attribs.name?.trim()
      if (!name || !/^[a-z][a-z0-9_]*$/i.test(name)) return droppedNode()
      return { tagName, attribs }
    },
  }
  return options
}

/** Strip scripts and unsafe markup; allow rich text + vetted embeds. */
export function sanitizeCmsHtml(html: string | null | undefined, apiOrigin?: string): string {
  if (!html) return ''
  const { html: remainder, forms } = extractNativeNrcgaForms(String(html))
  let out = sanitizeHtml(remainder, remainderOptions(apiOrigin))
  for (let i = 0; i < forms.length; i++) {
    const sanitizedForm = sanitizeHtml(forms[i], nativeFormOptions(apiOrigin))
    out = out.replace(FORM_SLOT_TOKEN(i), sanitizedForm)
  }
  return out
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
