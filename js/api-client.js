/**
 * NRCGA API client for the static public site.
 * Set window.NRCGA_API_BASE before loading this script to override the default.
 */
(function () {
  const DEFAULT_API = (() => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8787';
    }
    if (host === 'nrcga-website-staging.pages.dev' || host.endsWith('.nrcga-website-staging.pages.dev')) {
      return 'https://nrcga-api-staging.thefieldmappinggroup.workers.dev';
    }
    return 'https://api.nrcga.org';
  })();

  const API_BASE = (window.NRCGA_API_BASE || DEFAULT_API).replace(/\/$/, '');

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
      throw new Error(text || `API error ${response.status}`);
    }
    return response.json();
  }

  window.NRCGA_API = {
    baseUrl: API_BASE,
    staffPortalUrl: `${API_BASE}/admin`,
    get: (path) => fetchFromApi(path),
    post: (path, body) =>
      fetchFromApi(path, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  };
})();
