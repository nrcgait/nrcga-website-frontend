/**
 * Shared DOM safety helpers for the public static site.
 */
;(function (global) {
  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function isSafeHttpUrl(value) {
    try {
      const url = new URL(String(value || '').trim())
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  function safeHref(value) {
    const raw = String(value || '').trim()
    if (!raw) return '#'
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw
    return isSafeHttpUrl(raw) ? raw : '#'
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;')
  }

  global.NRCGA_safeDom = {
    escapeHtml,
    escapeAttr,
    isSafeHttpUrl,
    safeHref,
  }
})(typeof window !== 'undefined' ? window : globalThis)
