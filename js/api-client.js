/**
 * NRCGA API client for the static public site.
 * Set window.NRCGA_API_BASE before loading this script to override the default.
 */
(function () {
  function isStagingHost(host) {
    return (
      host === 'nrcga-website-staging.pages.dev' ||
      host.endsWith('.nrcga-website-staging.pages.dev') ||
      host === 'nrcga.ayowerks.com' ||
      host === 'ayowerks.com' ||
      host.endsWith('.ayowerks.com')
    );
  }

  const DEFAULT_API = (() => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8787';
    }
    if (isStagingHost(host)) {
      return 'https://nrcga-api-staging.nrcga-it.workers.dev';
    }
    return 'https://api.nrcga.org';
  })();

  const API_BASE = (window.NRCGA_API_BASE || DEFAULT_API).replace(/\/$/, '');

  function resolveMediaUrl(url) {
    if (url == null) return '';
    const raw = String(url).trim();
    if (!raw) return '';
    if (raw.startsWith('/api/v1/')) return `${API_BASE}${raw}`;
    return raw;
  }

  function rewriteMediaUrlsInString(value) {
    if (typeof value !== 'string' || !value) return value;
    if (value.startsWith('/api/v1/')) return `${API_BASE}${value}`;
    if (!value.includes('/api/v1/')) return value;
    return value
      .replace(/(["'])(\/api\/v1\/)/g, `$1${API_BASE}$2`)
      .replace(/(url\(\s*)(\/api\/v1\/)/gi, `$1${API_BASE}$2`)
      .replace(/(\s(?:src|href)=)(\/api\/v1\/)/gi, `$1${API_BASE}$2`);
  }

  function rewriteMediaUrls(value) {
    if (typeof value === 'string') return rewriteMediaUrlsInString(value);
    if (Array.isArray(value)) return value.map(rewriteMediaUrls);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) {
        out[key] = rewriteMediaUrls(value[key]);
      }
      return out;
    }
    return value;
  }

  async function fetchFromApi(path, options) {
    const url = `${API_BASE}/api/v1${path.startsWith('/') ? path : `/${path}`}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options && options.headers ? options.headers : {}),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text || `API error ${response.status}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed && (parsed.error || parsed.message)) {
          message = parsed.error || parsed.message;
        }
      } catch {
        /* use raw text */
      }
      throw new Error(message);
    }
    return rewriteMediaUrls(await response.json());
  }

  window.NRCGA_API = {
    baseUrl: API_BASE,
    staffPortalUrl: `${API_BASE}/admin`,
    resolveMediaUrl,
    get: (path) => fetchFromApi(path),
    post: (path, body) =>
      fetchFromApi(path, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  };
})();
