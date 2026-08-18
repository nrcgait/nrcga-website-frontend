// Events loader — fetches from NRCGA API and renders calendar list/month views with registration modal.

const EVENTS_PAGE_SIZE = 7;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const calendarStates = new Map();
const NEVADA_CENTER = { lat: 39.5, lon: -117.0 };
const NEVADA_BBOX = '-120.0,35.0,-114.0,42.0';

let registrationMap = null;
let registrationMarker = null;
let leafletLoadPromise = null;

function formatEventDate(isoString) {
  try {
    if (window.NRCGATime) return window.NRCGATime.formatDate(isoString);
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Los_Angeles',
    });
  } catch {
    return isoString;
  }
}

function formatEventTime(isoString) {
  try {
    if (window.NRCGATime) return window.NRCGATime.formatTime(isoString);
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'short',
    });
  } catch {
    return '';
  }
}

function formatEventDateParts(isoString) {
  try {
    if (window.NRCGATime) return window.NRCGATime.formatDateParts(isoString);
    const d = new Date(isoString);
    return {
      month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Los_Angeles' }).toUpperCase(),
      day: Number(d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Los_Angeles' })),
      weekdayDate: d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Los_Angeles',
      }),
    };
  } catch {
    return { month: '', day: '', weekdayDate: isoString };
  }
}

function formatEventTimeRange(startsAt, endsAt) {
  const start = formatEventTime(startsAt);
  if (!endsAt) return start;
  const end = formatEventTime(endsAt);
  if (!start || !end) return start;
  return `${start} – ${end}`;
}

function findEventOccurrence(seriesId, occurrenceDate) {
  for (const state of calendarStates.values()) {
    const match = state.events.find((event) => {
      const sid = event.series_id || event.id.split(':')[0];
      return sid === seriesId && event.occurrence_date === occurrenceDate;
    });
    if (match) return match;
  }
  return null;
}

async function ensureEventMapThumbs() {
  await loadLeaflet();
  if (window.initEventMapThumbs) return;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-event-map-thumbs]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load map thumbs')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'js/event-map-thumbs.js';
    script.dataset.eventMapThumbs = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load map thumbs'));
    document.head.appendChild(script);
  });
}

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      link.dataset.leafletCss = 'true';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load map library'));
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

async function geocodeWithPhoton(address) {
  let query = address.trim();
  if (query && !/nevada|\bnv\b/i.test(query)) {
    query = `${query}, Nevada`;
  }

  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '1');
  url.searchParams.set('bbox', NEVADA_BBOX);

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature?.geometry?.coordinates) return null;

  const [lon, lat] = feature.geometry.coordinates;
  return { lat, lon };
}

function destroyRegistrationMap() {
  if (registrationMap) {
    registrationMap.remove();
    registrationMap = null;
    registrationMarker = null;
  }
}

function updateDirectionsLink(lat, lng) {
  const link = document.getElementById('event-reg-directions');
  if (link) {
    link.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
}

async function initEventLocationMap(locationAddress, coords) {
  const mapEl = document.getElementById('event-reg-map');
  if (!mapEl) return;

  await loadLeaflet();
  destroyRegistrationMap();

  let lat = NEVADA_CENTER.lat;
  let lon = NEVADA_CENTER.lon;
  let geocoded = false;

  if (coords && Number.isFinite(Number(coords.latitude)) && Number.isFinite(Number(coords.longitude))) {
    lat = Number(coords.latitude);
    lon = Number(coords.longitude);
    geocoded = true;
  } else if (locationAddress?.trim()) {
    try {
      const result = await geocodeWithPhoton(locationAddress.trim());
      if (result) {
        lat = result.lat;
        lon = result.lon;
        geocoded = true;
      }
    } catch (err) {
      console.warn('Geocoding failed:', err);
    }
  }

  registrationMap = window.L.map(mapEl, { scrollWheelZoom: false }).setView([lat, lon], geocoded ? 14 : 7);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(registrationMap);

  registrationMarker = window.L.marker([lat, lon], { draggable: true }).addTo(registrationMap);
  registrationMarker.on('dragend', () => {
    const pos = registrationMarker.getLatLng();
    updateDirectionsLink(pos.lat, pos.lng);
  });

  const hintEl = document.getElementById('event-reg-map-hint');
  if (hintEl) {
    hintEl.textContent = geocoded
      ? 'Drag the pin if the map location isn\'t quite right.'
      : 'We couldn\'t place this address automatically. Drag the pin to the correct location.';
  }

  updateDirectionsLink(lat, lon);
  setTimeout(() => registrationMap.invalidateSize(), 150);
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCalendarState(container) {
  if (!calendarStates.has(container)) {
    const scope = container.dataset.eventsScope || 'all';
    calendarStates.set(container, {
      events: [],
      view: 'list',
      categoryFilter: scope === 'training' ? 'training' : 'all',
      searchQuery: '',
      appliedSearchQuery: '',
      searchTimer: null,
      searchSelection: null,
      renderGen: 0,
      listPage: 1,
      monthDate: startOfNevadaMonth(),
      loading: false,
      activeContainer: container,
    });
  }
  return calendarStates.get(container);
}

function startOfNevadaMonth(date) {
  if (date) return startOfMonth(date);
  const parts = window.NRCGATime ? window.NRCGATime.nowParts() : null;
  if (parts) return new Date(parts.year, parts.month - 1, 1);
  return startOfMonth(new Date());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function toDateParam(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function eventDateKey(event) {
  if (event.occurrence_date) return event.occurrence_date;
  if (window.NRCGATime) return window.NRCGATime.dateParam(event.starts_at);
  return toDateParam(new Date(event.starts_at));
}

function nevadaTodayKey() {
  if (window.NRCGATime) return window.NRCGATime.dateParam(new Date());
  return toDateParam(new Date());
}

async function fetchEvents(category) {
  if (!window.NRCGA_API) {
    console.warn('NRCGA_API not loaded');
    return [];
  }
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  const data = await window.NRCGA_API.get(`/events${query}`);
  return data.events || [];
}

async function fetchAvailability(seriesId, occurrenceDate) {
  const data = await window.NRCGA_API.get(
    `/events/${encodeURIComponent(seriesId)}/availability?occurrence_date=${encodeURIComponent(occurrenceDate)}`,
  );
  return data;
}

function filterEventsByCategory(events, categoryFilter) {
  if (categoryFilter === 'training') {
    return events.filter((event) => event.category === 'training');
  }
  return events;
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function eventSearchHaystack(event) {
  return normalizeSearchText(
    [
      event.title,
      event.location,
      event.description,
      event.category,
      event.occurrence_date,
      formatEventDate(event.starts_at),
      formatEventTime(event.starts_at),
      formatEventTimeRange(event.starts_at, event.ends_at),
    ].join(' '),
  );
}

function filterEventsBySearch(events, searchQuery) {
  const query = normalizeSearchText(searchQuery);
  if (!query) return events;
  const terms = query.split(' ').filter(Boolean);
  return events.filter((event) => {
    const haystack = eventSearchHaystack(event);
    return terms.every((term) => haystack.includes(term));
  });
}

function ensureRegistrationModal() {
  let modal = document.getElementById('event-registration-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'event-registration-modal';
  modal.className = 'event-reg-modal-overlay';
  modal.innerHTML = `
    <div class="event-reg-modal-panel" role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
      <button type="button" id="event-modal-close" class="event-reg-modal__close" aria-label="Close">&times;</button>
      <div id="event-modal-body"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeRegistrationModal();
  });
  modal.querySelector('#event-modal-close').addEventListener('click', closeRegistrationModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeRegistrationModal();
  });
  return modal;
}

function closeRegistrationModal() {
  const modal = document.getElementById('event-registration-modal');
  if (modal) modal.style.display = 'none';
  destroyRegistrationMap();
}

function renderEventMetaSection(event) {
  const dateParts = formatEventDateParts(event.starts_at);
  const timeRange = formatEventTimeRange(event.starts_at, event.ends_at);
  const location = event.location?.trim();

  const locationSection = location
    ? `
      <div class="event-reg-modal__location">
        <p class="event-reg-modal__location-label">
          <span aria-hidden="true">📍</span> Location
        </p>
        <p class="event-reg-modal__location-address">${escapeHtml(location)}</p>
      </div>
      <div class="event-reg-modal__map-wrap">
        <div id="event-reg-map" class="event-reg-modal__map" role="img" aria-label="Event location map"></div>
      </div>
      <p id="event-reg-map-hint" class="event-reg-modal__map-hint"></p>
      <a id="event-reg-directions" class="event-reg-modal__directions" href="#" target="_blank" rel="noopener noreferrer">
        Get directions ↗
      </a>`
    : '';

  return `
    <div class="event-reg-modal__when">
      <div class="event-reg-modal__date-badge" aria-hidden="true">
        <span class="event-reg-modal__date-month">${escapeHtml(dateParts.month)}</span>
        <span class="event-reg-modal__date-day">${escapeHtml(String(dateParts.day))}</span>
      </div>
      <div>
        <p class="event-reg-modal__when-primary">${escapeHtml(dateParts.weekdayDate)}</p>
        ${timeRange ? `<p class="event-reg-modal__when-secondary">${escapeHtml(timeRange)}</p>` : ''}
      </div>
    </div>
    ${locationSection}`;
}

function renderRegistrationForm(event) {
  return `
    <div class="event-reg-modal__divider"></div>
    <h3 class="event-reg-modal__form-title">Complete your registration</h3>
    <form id="event-registration-form">
      <input type="hidden" name="occurrence_date" value="${escapeHtml(event.occurrence_date)}" />
      <div class="event-reg-modal__field">
        <label for="event-reg-name">Name *</label>
        <input id="event-reg-name" name="guest_name" required autocomplete="name" />
      </div>
      <div class="event-reg-modal__field-row">
        <div class="event-reg-modal__field">
          <label for="event-reg-email">Email *</label>
          <input id="event-reg-email" name="guest_email" type="email" required autocomplete="email" />
        </div>
        <div class="event-reg-modal__field">
          <label for="event-reg-phone">Phone</label>
          <input id="event-reg-phone" name="guest_phone" type="tel" autocomplete="tel" />
        </div>
      </div>
      <div class="event-reg-modal__field-row">
        <div class="event-reg-modal__field">
          <label for="event-reg-org">Organization</label>
          <input id="event-reg-org" name="organization" autocomplete="organization" />
        </div>
        <div class="event-reg-modal__field">
          <label for="event-reg-spots">Number of spots *</label>
          <input id="event-reg-spots" name="spot_count" type="number" min="1" value="1" required />
        </div>
      </div>
      <div class="event-reg-modal__field">
        <label for="event-reg-notes">Notes</label>
        <textarea id="event-reg-notes" name="notes" rows="3" placeholder="Optional questions or accessibility needs"></textarea>
      </div>
      <p id="event-registration-error" class="event-reg-modal__error"></p>
      <div class="event-reg-modal__actions">
        <button type="submit" class="btn btn-primary">Register</button>
        <button type="button" class="btn btn-secondary" id="event-registration-cancel">Cancel</button>
      </div>
    </form>`;
}

function showRegistrationSuccess(data) {
  const body = document.getElementById('event-modal-body');
  const reg = data.registration;
  destroyRegistrationMap();
  body.innerHTML = `
    <div class="event-reg-modal__success">
      <div class="event-reg-modal__success-icon" aria-hidden="true">✓</div>
      <h2>You're registered!</h2>
      <p><strong>${escapeHtml(reg.event_title)}</strong></p>
      <p>${escapeHtml(formatEventDate(reg.starts_at))}</p>
      <p>${escapeHtml(formatEventTime(reg.starts_at))}</p>
      ${reg.location ? `<p>${escapeHtml(reg.location)}</p>` : ''}
      <p>${escapeHtml(reg.guest_name)} · <strong>${reg.spot_count}</strong> spot${reg.spot_count > 1 ? 's' : ''}</p>
      <p style="font-size:0.9rem;">${
        reg.email_sent
          ? `A confirmation email has been sent to ${escapeHtml(reg.guest_email || 'your email')}.`
          : 'Registration saved. (Confirmation email could not be sent.)'
      }</p>
      <button type="button" class="btn btn-primary" id="event-modal-done" style="margin-top:1.25rem;">Done</button>
    </div>`;
  document.getElementById('event-modal-done').addEventListener('click', closeRegistrationModal);
}

async function refreshActiveCalendar() {
  const active = document.querySelector('[data-events-container][data-events-active="true"]');
  if (active) {
    await renderEventsCalendar(active, { preserveView: true });
    return;
  }
  const container = document.querySelector('[data-events-container]');
  if (container) await renderEventsCalendar(container, { preserveView: true });
}

async function showRegistrationModal(seriesId, occurrenceDate, eventTitle, sourceContainer) {
  if (sourceContainer) {
    document.querySelectorAll('[data-events-container]').forEach((el) => {
      el.removeAttribute('data-events-active');
    });
    sourceContainer.setAttribute('data-events-active', 'true');
  }

  const event =
    findEventOccurrence(seriesId, occurrenceDate) || {
      title: eventTitle,
      occurrence_date: occurrenceDate,
      series_id: seriesId,
      starts_at: occurrenceDate,
      ends_at: null,
      location: null,
      description: null,
      category: 'general',
    };

  const modal = ensureRegistrationModal();
  const body = document.getElementById('event-modal-body');
  const categoryLabel = event.category === 'training' ? 'Training' : 'Event';

  body.innerHTML = `
    <div class="event-reg-modal__hero">
      <span class="event-reg-modal__category">${escapeHtml(categoryLabel)}</span>
      <h2 id="event-modal-title" class="event-reg-modal__title">${escapeHtml(event.title)}</h2>
      ${event.description ? `<p class="event-reg-modal__description">${escapeHtml(event.description)}</p>` : ''}
    </div>
    <div class="event-reg-modal__body">
      ${renderEventMetaSection(event)}
      ${renderRegistrationForm(event)}
    </div>`;

  document.getElementById('event-registration-cancel').addEventListener('click', closeRegistrationModal);
  document.getElementById('event-registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errEl = document.getElementById('event-registration-error');
    errEl.style.display = 'none';
    const payload = {
      occurrence_date: form.occurrence_date.value,
      guest_name: form.guest_name.value,
      guest_email: form.guest_email.value,
      guest_phone: form.guest_phone.value,
      organization: form.organization.value,
      spot_count: Number(form.spot_count.value),
      notes: form.notes.value,
    };
    try {
      const data = await window.NRCGA_API.post(`/events/${encodeURIComponent(seriesId)}/register`, payload);
      if (!data.success) {
        errEl.textContent = data.error || 'Registration failed.';
        errEl.style.display = 'block';
        return;
      }
      data.registration.guest_email = payload.guest_email;
      showRegistrationSuccess(data);
      await refreshActiveCalendar();
    } catch (err) {
      errEl.textContent = err.message || 'Registration failed. Please try again.';
      errEl.style.display = 'block';
    }
  });

  modal.style.display = 'flex';

  if (event.location?.trim()) {
    try {
      await initEventLocationMap(event.location, {
        latitude: event.latitude,
        longitude: event.longitude,
      });
    } catch (err) {
      console.warn('Map initialization failed:', err);
    }
  }
}

async function buildRegisterButton(event) {
  const cancelled = event.cancelled;
  const seriesId = event.series_id || event.id.split(':')[0];
  if (!event.registration_enabled || cancelled) return '';

  try {
    const avail = await fetchAvailability(seriesId, event.occurrence_date);
    if (!avail.isFull && !avail.cancelled) {
      return `<button type="button" class="btn btn-primary event-register-btn" data-series-id="${escapeHtml(seriesId)}" data-occurrence="${escapeHtml(event.occurrence_date)}" data-title="${escapeHtml(event.title)}">Register</button>`;
    }
    if (avail.isFull) return '<span style="color:#999;">Full</span>';
  } catch {
    return `<button type="button" class="btn btn-primary event-register-btn" data-series-id="${escapeHtml(seriesId)}" data-occurrence="${escapeHtml(event.occurrence_date)}" data-title="${escapeHtml(event.title)}">Register</button>`;
  }
  return '';
}

async function buildAvailabilityHtml(event) {
  if (!event.registration_enabled || event.cancelled) return '';
  const seriesId = event.series_id || event.id.split(':')[0];
  try {
    const avail = await fetchAvailability(seriesId, event.occurrence_date);
    if (avail.capacity != null) {
      return `<span style="color:var(--text-secondary);">${avail.registered} / ${avail.capacity} registered</span>`;
    }
  } catch {
    return '';
  }
  return '';
}

async function buildEventCard(event) {
  const cancelled = event.cancelled;
  const dateLabel = formatEventDate(event.starts_at);
  const timeLabel = formatEventTime(event.starts_at);
  const [availabilityHtml, registerBtn] = await Promise.all([
    buildAvailabilityHtml(event),
    buildRegisterButton(event),
  ]);
  const categoryBadge =
    event.category === 'training'
      ? '<span class="events-calendar-category-badge events-calendar-category-badge--training">Training</span>'
      : '';

  let thumbHtml = '<div class="event-card-thumb event-card-thumb-fallback" aria-hidden="true"></div>';
  if (event.image_r2_key) {
    const apiBase = (window.NRCGA_API && window.NRCGA_API.baseUrl) || '';
    const src = `${apiBase}/api/v1/media/${encodeURIComponent(event.image_r2_key)}`;
    thumbHtml = `<img class="event-card-thumb" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">`;
  } else if (event.latitude != null && event.longitude != null && Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))) {
    thumbHtml = `<div class="event-card-thumb event-card-map-thumb" data-event-map-thumb data-lat="${Number(event.latitude)}" data-lng="${Number(event.longitude)}" aria-hidden="true"></div>`;
  }

  return `
    <div class="event-card nrcga-event-card">
      ${thumbHtml}
      <div class="event-card-body">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start;">
          <div>
            <h3 style="margin:0 0 0.5rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
              ${escapeHtml(event.title)}${cancelled ? ' <span style="color:#b42318;">(Cancelled)</span>' : ''}
              ${categoryBadge}
            </h3>
            <p style="margin:0;color:var(--text-secondary);">${escapeHtml(dateLabel)}${timeLabel ? ` · ${escapeHtml(timeLabel)}` : ''}</p>
            ${event.location ? `<p style="margin:0.25rem 0 0;">${escapeHtml(event.location)}</p>` : ''}
            ${event.description ? `<p style="margin:0.75rem 0 0;">${escapeHtml(event.description)}</p>` : ''}
            ${availabilityHtml ? `<p style="margin:0.5rem 0 0;">${availabilityHtml}</p>` : ''}
          </div>
          <div>${registerBtn}</div>
        </div>
      </div>
    </div>`;
}

function bindRegisterButtons(root, container) {
  root.querySelectorAll('.event-register-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      showRegistrationModal(btn.dataset.seriesId, btn.dataset.occurrence, btn.dataset.title, container);
    });
  });
}

function renderToolbar(container, state) {
  const scope = container.dataset.eventsScope || 'all';
  const showCategoryFilter = scope === 'all';
  const searchValue = escapeHtml(state.searchQuery || '');
  const searchPlaceholder = scope === 'training' ? 'Search training…' : 'Search events…';

  const filterButtons = showCategoryFilter
    ? `
      <div class="events-calendar-filters" role="group" aria-label="Event category filter">
        <button type="button" class="btn btn-secondary events-calendar-filter-btn${state.categoryFilter === 'all' ? ' active' : ''}" data-filter="all">All</button>
        <button type="button" class="btn btn-secondary events-calendar-filter-btn${state.categoryFilter === 'training' ? ' active' : ''}" data-filter="training">Training</button>
      </div>`
    : '';

  return `
    <div class="events-calendar-toolbar">
      <div class="events-calendar-toolbar-start">
        ${filterButtons}
        <div class="events-calendar-search">
          <input type="search" class="events-calendar-search-input" value="${searchValue}" placeholder="${escapeHtml(searchPlaceholder)}" aria-label="${escapeHtml(searchPlaceholder)}" autocomplete="off" spellcheck="false">
        </div>
      </div>
      <div class="events-calendar-views" role="group" aria-label="Calendar view">
        <button type="button" class="btn btn-secondary calendar-view-btn events-calendar-view-btn${state.view === 'list' ? ' active' : ''}" data-view="list">List</button>
        <button type="button" class="btn btn-secondary calendar-view-btn events-calendar-view-btn${state.view === 'month' ? ' active' : ''}" data-view="month">Month</button>
      </div>
    </div>`;
}

function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return '';
  return `
    <div class="events-calendar-pagination">
      <button type="button" class="btn btn-secondary events-calendar-page-btn" data-page="${currentPage - 1}"${currentPage <= 1 ? ' disabled' : ''}>Previous</button>
      <span class="events-calendar-page-label">Page ${currentPage} of ${totalPages}</span>
      <button type="button" class="btn btn-secondary events-calendar-page-btn" data-page="${currentPage + 1}"${currentPage >= totalPages ? ' disabled' : ''}>Next</button>
    </div>`;
}

function getFilteredEvents(state) {
  return filterEventsBySearch(
    filterEventsByCategory(state.events, state.categoryFilter),
    state.searchQuery,
  );
}

function getEventsForMonth(events, monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const gridStart = new Date(year, month, 1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 41);
  const startKey = toDateParam(gridStart);
  const endKey = toDateParam(gridEnd);

  return events.filter((event) => {
    const key = eventDateKey(event);
    return key >= startKey && key <= endKey;
  });
}

function renderMonthDayEvents(dayEvents) {
  const maxVisible = 2;
  const visible = dayEvents.slice(0, maxVisible);
  const hiddenCount = dayEvents.length - visible.length;

  let html = visible
    .map((event) => {
      const classes = [
        'events-calendar-day-event',
        event.category === 'training' ? 'events-calendar-day-event--training' : '',
        event.cancelled ? 'events-calendar-day-event--cancelled' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const seriesId = event.series_id || event.id.split(':')[0];
      return `<button type="button" class="${classes}" title="${escapeHtml(event.title)}" data-series-id="${escapeHtml(seriesId)}" data-occurrence="${escapeHtml(event.occurrence_date)}" data-title="${escapeHtml(event.title)}" data-registerable="${event.registration_enabled && !event.cancelled ? '1' : '0'}">${escapeHtml(event.title)}</button>`;
    })
    .join('');

  if (hiddenCount > 0) {
    html += `<div class="events-calendar-day-more">+${hiddenCount} more</div>`;
  }
  return html;
}

function renderMonthView(events, monthDate) {
  const todayKey = nevadaTodayKey();
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const eventsByDate = new Map();
  for (const event of events) {
    const key = eventDateKey(event);
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key).push(event);
  }

  let cells = WEEKDAY_LABELS.map(
    (label) => `<div class="events-calendar-weekday">${label}</div>`,
  ).join('');

  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i += 1) {
    let dayNum;
    let cellDate;
    let outside = false;

    if (i < firstWeekday) {
      dayNum = daysInPrevMonth - firstWeekday + i + 1;
      cellDate = new Date(year, month - 1, dayNum);
      outside = true;
    } else if (i >= firstWeekday + daysInMonth) {
      dayNum = i - firstWeekday - daysInMonth + 1;
      cellDate = new Date(year, month + 1, dayNum);
      outside = true;
    } else {
      dayNum = i - firstWeekday + 1;
      cellDate = new Date(year, month, dayNum);
    }

    const dateKey = toDateParam(cellDate);
    const dayEvents = eventsByDate.get(dateKey) || [];
    const todayClass = dateKey === todayKey ? ' events-calendar-day--today' : '';
    const outsideClass = outside ? ' events-calendar-day--outside' : '';

    cells += `
      <div class="events-calendar-day${todayClass}${outsideClass}">
        <div class="events-calendar-day-num">${dayNum}</div>
        ${renderMonthDayEvents(dayEvents)}
      </div>`;
  }

  return `
    <div class="events-calendar-month">
      <div class="events-calendar-month-header">
        <button type="button" class="btn btn-secondary events-calendar-month-nav" data-month-delta="-1" aria-label="Previous month">←</button>
        <h3 class="events-calendar-month-title">${MONTH_LABELS[month]} ${year}</h3>
        <button type="button" class="btn btn-secondary events-calendar-month-nav" data-month-delta="1" aria-label="Next month">→</button>
      </div>
      <div class="events-calendar-month-grid">${cells}</div>
    </div>`;
}

async function renderListView(container, state) {
  const events = getFilteredEvents(state);
  const totalPages = Math.max(1, Math.ceil(events.length / EVENTS_PAGE_SIZE));
  const page = Math.min(state.listPage, totalPages);
  state.listPage = page;

  const start = (page - 1) * EVENTS_PAGE_SIZE;
  const pageEvents = events.slice(start, start + EVENTS_PAGE_SIZE);

  if (!pageEvents.length) {
    const emptyMessage = normalizeSearchText(state.searchQuery)
      ? 'No events match your search.'
      : 'No upcoming events scheduled.';
    return `<p class="events-calendar-empty">${emptyMessage}</p>`;
  }

  const cards = await Promise.all(pageEvents.map((event) => buildEventCard(event)));
  return `
    <div class="events-calendar-list">
      ${cards.join('')}
      ${renderPagination(page, totalPages)}
    </div>`;
}

function restoreSearchFocus(container, state) {
  const input = container.querySelector('.events-calendar-search-input');
  if (!input) return;
  input.focus({ preventScroll: true });
  const selection = state.searchSelection;
  const fallback = input.value.length;
  const start = Number.isInteger(selection?.[0]) ? selection[0] : fallback;
  const end = Number.isInteger(selection?.[1]) ? selection[1] : fallback;
  try {
    input.setSelectionRange(start, end);
  } catch {
    /* some browsers reject setSelectionRange on type=search */
  }
}

function bindSearchInput(container, state) {
  const input = container.querySelector('.events-calendar-search-input');
  if (!input) return;

  const applySearch = () => {
    const liveInput = container.querySelector('.events-calendar-search-input') || input;
    const nextQuery = liveInput.value;
    state.searchQuery = nextQuery;
    state.searchSelection = [liveInput.selectionStart, liveInput.selectionEnd];
    if (nextQuery === state.appliedSearchQuery) return;
    state.listPage = 1;
    renderEventsCalendar(container, { preserveView: true, restoreSearchFocus: true });
  };

  input.addEventListener('input', () => {
    state.searchQuery = input.value;
    state.searchSelection = [input.selectionStart, input.selectionEnd];
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(applySearch, 200);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      clearTimeout(state.searchTimer);
      applySearch();
    }
  });

  input.addEventListener('search', () => {
    clearTimeout(state.searchTimer);
    applySearch();
  });
}

function bindCalendarControls(container, state) {
  bindSearchInput(container, state);

  container.querySelectorAll('.events-calendar-filter-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.categoryFilter = btn.dataset.filter;
      state.listPage = 1;
      await renderEventsCalendar(container, { preserveView: true });
    });
  });

  container.querySelectorAll('.events-calendar-view-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.view = btn.dataset.view;
      await renderEventsCalendar(container, { preserveView: true });
    });
  });

  container.querySelectorAll('.events-calendar-page-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      state.listPage = Number(btn.dataset.page);
      await renderEventsCalendar(container, { preserveView: true });
    });
  });

  container.querySelectorAll('.events-calendar-month-nav').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.monthDate = addMonths(state.monthDate, Number(btn.dataset.monthDelta));
      await renderEventsCalendar(container, { preserveView: true });
    });
  });

  bindRegisterButtons(container, container);

  container.querySelectorAll('.events-calendar-day-event').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.registerable === '1') {
        showRegistrationModal(btn.dataset.seriesId, btn.dataset.occurrence, btn.dataset.title, container);
      }
    });
  });
}

async function renderEventsCalendar(container, options = {}) {
  const state = getCalendarState(container);
  if (!options.preserveView) {
    state.view = 'list';
    state.listPage = 1;
  }

  const renderGen = (state.renderGen || 0) + 1;
  state.renderGen = renderGen;

  const needsFetch = !state.events.length || options.reload;
  if (needsFetch) {
    container.innerHTML = '<p class="events-calendar-loading">Loading events…</p>';
  }

  try {
    const scope = container.dataset.eventsScope || 'all';
    if (needsFetch) {
      state.events = await fetchEvents(scope === 'training' ? 'training' : undefined);
    }

    let content = '';
    const queryUsed = state.searchQuery;
    if (state.view === 'month') {
      const monthEvents = getEventsForMonth(getFilteredEvents(state), state.monthDate);
      content = renderMonthView(monthEvents, state.monthDate);
    } else {
      content = await renderListView(container, state);
    }

    if (state.renderGen !== renderGen) return;

    const toolbar = renderToolbar(container, state);
    container.innerHTML = `<div class="events-calendar-widget">${toolbar}${content}</div>`;
    state.appliedSearchQuery = queryUsed;
    bindCalendarControls(container, state);
    if (options.restoreSearchFocus) restoreSearchFocus(container, state);
    if (state.view === 'list') {
      try {
        await ensureEventMapThumbs();
        if (state.renderGen !== renderGen) return;
        if (window.initEventMapThumbs) window.initEventMapThumbs(container);
      } catch (err) {
        console.warn('Event map thumbnails unavailable', err);
      }
    }
  } catch (err) {
    if (state.renderGen !== renderGen) return;
    console.error(err);
    container.innerHTML =
      '<p class="events-calendar-empty">Unable to load events. Please try again later.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-events-container]').forEach((el) => {
    renderEventsCalendar(el);
  });
});
