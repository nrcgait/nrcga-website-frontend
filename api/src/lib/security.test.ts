import { describe, expect, it } from 'vitest'
import { isAllowedCorsOrigin } from './cors'
import { sanitizeCmsHtml, isAllowedIframeSrc, isAllowedResourceUrl } from './html-sanitize'
import { normalizeMediaKey } from './media-response'
import { isValidEmailAddress } from './email-address'
import { rejectOversizedFormBody } from './forms-db'
import { isTurnstileConfigured } from './turnstile'
import { sessionCookieHeader, readSessionCookie, SECURE_COOKIE_NAME, DEV_COOKIE_NAME } from './session'

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
  it('allows branch preview origin', () => {
    expect(isAllowedCorsOrigin('https://security-audit-fixes.nrcga-website-frontend.pages.dev', env as never)).toBe(true)
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

describe('turnstile', () => {
  it('is unconfigured without secret', () => {
    expect(isTurnstileConfigured({ TURNSTILE_SECRET: '' } as never)).toBe(false)
  })
  it('is configured with secret', () => {
    expect(isTurnstileConfigured({ TURNSTILE_SECRET: 'secret' } as never)).toBe(true)
  })
})

describe('session cookies', () => {
  it('uses dev cookie name over http', () => {
    const header = sessionCookieHeader('tok', false)
    expect(header).toContain(`${DEV_COOKIE_NAME}=tok`)
    expect(header).not.toContain('Secure')
  })
  it('reads secure or dev cookie', () => {
    const cookie = `${SECURE_COOKIE_NAME}=abc; other=1`
    expect(readSessionCookie(cookie)).toBe('abc')
    const devCookie = `${DEV_COOKIE_NAME}=xyz`
    expect(readSessionCookie(devCookie)).toBe('xyz')
  })
})
