import { describe, expect, it } from 'vitest'
import { isAllowedCorsOrigin } from './cors'
import { sanitizeCmsHtml, isAllowedIframeSrc, isAllowedResourceUrl } from './html-sanitize'
import { normalizeMediaKey } from './media-response'
import { isValidEmailAddress } from './email-address'
import { rejectOversizedFormBody } from './forms-db'

const env = {
  PUBLIC_SITE_ORIGIN: 'https://nrcga.org',
} as { PUBLIC_SITE_ORIGIN: string }

describe('cors', () => {
  it('allows production origin', () => {
    expect(isAllowedCorsOrigin('https://nrcga.org', env as never)).toBe(true)
  })
  it('rejects arbitrary pages.dev', () => {
    expect(isAllowedCorsOrigin('https://evil.pages.dev', env as never)).toBe(false)
  })
})

describe('media keys', () => {
  it('accepts uploads prefix', () => {
    expect(normalizeMediaKey('uploads/foo.jpg')).toBe('uploads/foo.jpg')
  })
  it('rejects traversal', () => {
    expect(normalizeMediaKey('uploads/../secret')).toBeNull()
  })
  it('rejects non-uploads', () => {
    expect(normalizeMediaKey('private/file.pdf')).toBeNull()
  })
})

describe('html sanitize', () => {
  it('strips script tags', () => {
    expect(sanitizeCmsHtml('<p>ok</p><script>alert(1)</script>', 'https://api.nrcga.org')).not.toContain('<script')
  })
  it('allows youtube iframe', () => {
    const html = sanitizeCmsHtml(
      '<iframe src="https://www.youtube.com/embed/abc123"></iframe>',
      'https://api.nrcga.org',
    )
    expect(html).toContain('youtube.com/embed')
  })
  it('blocks javascript href', () => {
    expect(isAllowedResourceUrl('javascript:alert(1)')).toBe(false)
  })
  it('allows https links', () => {
    expect(isAllowedResourceUrl('https://nrcga.org')).toBe(true)
  })
  it('allows media paths', () => {
    expect(isAllowedIframeSrc('/api/v1/media/uploads/x.pdf', 'https://api.nrcga.org')).toBe(true)
  })
})

describe('email', () => {
  it('rejects header injection', () => {
    expect(isValidEmailAddress('user@example.com\r\nBcc: evil@x.com')).toBe(false)
  })
  it('accepts normal email', () => {
    expect(isValidEmailAddress('user@example.com')).toBe(true)
  })
})

describe('forms', () => {
  it('rejects oversized fields', () => {
    const result = rejectOversizedFormBody({ message: 'x'.repeat(20_000) })
    expect(result?.ok).toBe(false)
  })
})
