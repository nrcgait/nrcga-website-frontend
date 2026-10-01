/**
 * Cloudflare Turnstile helper for public forms.
 */
;(function (global) {
  let siteKeyPromise = null
  let scriptPromise = null

  function loadScript() {
    if (scriptPromise) return scriptPromise
    scriptPromise = new Promise((resolve, reject) => {
      if (global.turnstile) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Could not load Turnstile'))
      document.head.appendChild(script)
    })
    return scriptPromise
  }

  async function getSiteKey() {
    if (!siteKeyPromise) {
      siteKeyPromise = (async () => {
        if (global.NRCGA_API) {
          try {
            const config = await global.NRCGA_API.get('/public-config')
            if (config && config.turnstile_site_key) return config.turnstile_site_key
          } catch {
            /* fall through */
          }
          try {
            const settings = await global.NRCGA_API.get('/settings')
            if (settings && settings.turnstile_site_key) return settings.turnstile_site_key
          } catch {
            /* fall through */
          }
        }
        return ''
      })()
    }
    return siteKeyPromise
  }

  async function mountWidget(container) {
    const siteKey = await getSiteKey()
    if (!siteKey || !container) return null
    await loadScript()
    if (!global.turnstile) return null
    container.innerHTML = ''
    return global.turnstile.render(container, {
      sitekey: siteKey,
      theme: 'auto',
    })
  }

  function readToken(container) {
    if (!container) return ''
    const input = container.querySelector('[name="cf-turnstile-response"]')
    return input && input.value ? String(input.value) : ''
  }

  global.NRCGA_turnstile = {
    mountWidget,
    readToken,
    getSiteKey,
  }
})(typeof window !== 'undefined' ? window : globalThis)
