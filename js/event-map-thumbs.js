(function () {
  const MAP_ZOOM = 14
  const initialized = new WeakSet()

  function initMapThumb(el) {
    if (!(el instanceof HTMLElement) || initialized.has(el)) return
    if (typeof window.L === 'undefined') return

    const lat = Number(el.dataset.lat)
    const lng = Number(el.dataset.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    initialized.add(el)

    delete window.L.Icon.Default.prototype._getIconUrl
    window.L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    const map = window.L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView([lat, lng], MAP_ZOOM)

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    window.L.marker([lat, lng]).addTo(map)

    window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false })
    })
  }

  function scan(root) {
    ;(root || document).querySelectorAll('[data-event-map-thumb]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      if (initialized.has(el)) return
      initMapThumb(el)
    })
  }

  function observe() {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            initMapThumb(entry.target)
            observer.unobserve(entry.target)
          })
        },
        { rootMargin: '120px' },
      )
      document.querySelectorAll('[data-event-map-thumb]').forEach((el) => observer.observe(el))
      window._eventMapThumbObserver = observer
    } else {
      scan(document)
    }
  }

  window.initEventMapThumbs = function (root) {
    if (window._eventMapThumbObserver && root) {
      root.querySelectorAll('[data-event-map-thumb]').forEach((el) => {
        window._eventMapThumbObserver.observe(el)
      })
      return
    }
    scan(root || document)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe)
  } else {
    observe()
  }

  window.addEventListener('load', () => scan(document))
})()
