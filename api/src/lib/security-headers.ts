export type SecurityHeaderMode = 'api' | 'admin' | 'adminAuth'

const EMBED_FRAME_HOSTS = [
  'https://www.youtube.com',
  'https://youtube.com',
  'https://www.youtube-nocookie.com',
  'https://forms.office.com',
  'https://forms.microsoft.com',
  'https://docs.google.com',
  'https://www.typeform.com',
  'https://typeform.com',
  'https://form.jotform.com',
  'https://www.jotform.com',
]

export function embedFrameSrcCsp(): string {
  return ["'self'", 'about:', ...EMBED_FRAME_HOSTS].join(' ')
}

export function securityHeaders(mode: SecurityHeaderMode, isHttps = true): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
  if (isHttps) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  }
  if (mode === 'admin' || mode === 'adminAuth') {
    headers['X-Frame-Options'] = 'DENY'
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https:",
      `frame-src ${embedFrameSrcCsp()}`,
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "connect-src 'self' https://*.openstreetmap.org https://unpkg.com",
    ].join('; ')
  }
  return headers
}

export function applySecurityHeaders(response: Response, mode: SecurityHeaderMode, isHttps = true): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(securityHeaders(mode, isHttps))) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function isHttpsRequest(url: string): boolean {
  return url.startsWith('https://')
}
