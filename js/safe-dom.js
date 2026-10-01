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

  function isSafeRelativePath(value) {
    if (!value || value.startsWith('//')) return false
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return false
    if (value.includes('..')) return false
    if (/[\r\n]/.test(value)) return false
    return true
  }

  function safeHref(value) {
    const raw = String(value || '').trim()
    if (!raw) return '#'
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw
    if (isSafeHttpUrl(raw)) return raw
    if (/^mailto:/i.test(raw) || /^tel:/i.test(raw)) {
      return /[\r\n]/.test(raw) ? '#' : raw
    }
    return isSafeRelativePath(raw) ? raw : '#'
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
