// Archive Data Loader — unified feed with type filters and pagination (20/page)

const ARCHIVE_PAGE_SIZE = 20;
const ARCHIVE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'meeting-minute', label: 'Meeting Minutes' },
  { id: 'historical-document', label: 'Historical Documents' },
  { id: 'post', label: 'Updates & Posts' },
];

const TYPE_LABELS = {
  'meeting-minute': 'Meeting Minutes',
  'historical-document': 'Historical Documents',
  post: 'Updates & Posts',
};

function parseLocalDate(dateString) {
  const match = typeof dateString === 'string' && dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date(dateString);
}

function formatDate(dateString) {
  try {
    const date = parseLocalDate(dateString);
    if (isNaN(date.getTime())) return dateString || '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    return dateString || '';
  }
}

function normalizeArchiveRowType(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/_/g, '-');
  if (s === 'meeting-minute' || s === 'meeting minute' || s === 'minutes' || s === 'meeting minutes') {
    return 'meeting-minute';
  }
  if (
    s === 'historical-document' ||
    s === 'historical document' ||
    s === 'document' ||
    s === 'news' ||
    s === 'newsletter'
  ) {
    return 'historical-document';
  }
  if (s === 'post' || s === 'update' || s === 'updates' || s === 'updates-posts') {
    return 'post';
  }
  return s;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function getItemHref(item) {
  if (item.type === 'post' && item.slug) {
    return `post.html?slug=${encodeURIComponent(item.slug)}`;
  }
  return item.link || '#';
}

function getItemIcon(item) {
  if (item.type === 'post') return '📰';
  const link = String(item.link || '');
  const title = String(item.title || '');
  if (
    link.includes('photos') ||
    link.includes('photo') ||
    /photos?/i.test(title)
  ) {
    return '📷';
  }
  if (link.includes('youtube.com') || link.includes('video')) return '🎥';
  return '📄';
}

function readArchiveStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const typeRaw = params.get('type') || 'all';
  const type = ARCHIVE_FILTERS.some((f) => f.id === typeRaw) ? typeRaw : 'all';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  return { type, page };
}

function writeArchiveStateToUrl(state) {
  const params = new URLSearchParams();
  if (state.type && state.type !== 'all') params.set('type', state.type);
  if (state.page > 1) params.set('page', String(state.page));
  const qs = params.toString();
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, '', next);
}

function itemSortDate(item) {
  return item.sort_date || item.published_at || item.date || item.created_at || '';
}

function dedupeByLink(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.type === 'post' ? `post:${item.id || item.slug}` : String(item.link || item.id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function fetchArchivePage(type, page) {
  if (window.NRCGA_API) {
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (type && type !== 'all') qs.set('type', type);
      const result = await window.NRCGA_API.get(`/archive?${qs.toString()}`);
      if (result && Array.isArray(result.items)) {
        return {
          items: result.items,
          page: result.page || page,
          totalPages: result.totalPages || 1,
          total: result.total ?? result.items.length,
        };
      }
      // Legacy array response
      if (Array.isArray(result)) {
        return paginateClientSide(normalizeCsvItems(result), type, page);
      }
    } catch (e) {
      console.warn('Archive API unavailable, falling back to CSV', e);
    }
  }

  const rows = await loadCSV('data/archive.csv');
  return paginateClientSide(normalizeCsvItems(rows), type, page);
}

function normalizeCsvItems(rows) {
  return rows.map((item) => {
    const type = normalizeArchiveRowType(
      typeof pickCsvField === 'function' ? pickCsvField(item, 'type') : item.type,
    );
    const title =
      typeof pickCsvField === 'function' ? pickCsvField(item, 'title') : item.title;
    const date =
      typeof pickCsvField === 'function' ? pickCsvField(item, 'date') : item.date;
    const link =
      typeof pickCsvField === 'function' ? pickCsvField(item, 'link') : item.link;
    return {
      ...item,
      type,
      title,
      date,
      sort_date: date,
      link,
    };
  });
}

function paginateClientSide(allItems, type, page) {
  let filtered = dedupeByLink(allItems);
  if (type && type !== 'all') {
    filtered = filtered.filter((item) => item.type === type);
  }
  filtered.sort((a, b) => {
    const dateA = parseLocalDate(itemSortDate(a));
    const dateB = parseLocalDate(itemSortDate(b));
    return dateB - dateA;
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * ARCHIVE_PAGE_SIZE;
  return {
    items: filtered.slice(start, start + ARCHIVE_PAGE_SIZE),
    page: safePage,
    totalPages,
    total,
  };
}

function renderFilters(activeType) {
  return `
    <div class="archive-filters" role="group" aria-label="Archive type filter">
      ${ARCHIVE_FILTERS.map(
        (f) =>
          `<button type="button" class="btn btn-secondary archive-filter-btn${
            activeType === f.id ? ' active' : ''
          }" data-filter="${f.id}">${escapeHtml(f.label)}</button>`,
      ).join('')}
    </div>`;
}

function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return '';
  return `
    <div class="archive-pagination">
      <button type="button" class="btn btn-secondary archive-page-btn" data-page="${
        currentPage - 1
      }"${currentPage <= 1 ? ' disabled' : ''}>Previous</button>
      <span class="archive-page-label">Page ${currentPage} of ${totalPages}</span>
      <button type="button" class="btn btn-secondary archive-page-btn" data-page="${
        currentPage + 1
      }"${currentPage >= totalPages ? ' disabled' : ''}>Next</button>
    </div>`;
}

function renderItems(items) {
  if (!items.length) {
    return '<p class="archive-empty">No archive items found for this filter.</p>';
  }
  return `<ul class="archive-list">${items
    .map((item) => {
      const href = getItemHref(item);
      const isExternal =
        item.type !== 'post' &&
        (String(href).startsWith('http://') || String(href).startsWith('https://'));
      const linkTarget = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      const typeLabel = TYPE_LABELS[item.type] || item.type || '';
      const dateLabel = formatDate(itemSortDate(item));
      const excerpt =
        item.type === 'post' && item.excerpt
          ? `<p class="archive-item-excerpt">${escapeHtml(item.excerpt)}</p>`
          : '';
      return `<li class="archive-item">
        <span class="archive-item-icon" aria-hidden="true">${getItemIcon(item)}</span>
        <div class="archive-item-body">
          <a href="${escapeAttr(href)}"${linkTarget} class="archive-item-title">${escapeHtml(
            item.title,
          )}</a>
          <p class="archive-item-meta">
            <span class="archive-item-type">${escapeHtml(typeLabel)}</span>
            ${dateLabel ? `<span class="archive-item-date">${escapeHtml(dateLabel)}</span>` : ''}
          </p>
          ${excerpt}
        </div>
      </li>`;
    })
    .join('')}</ul>`;
}

async function renderArchive(state) {
  const container = document.getElementById('archive-content');
  if (!container) return;

  container.innerHTML = `
    <p class="archive-intro">Browse the most recent materials across meeting minutes, historical documents, and updates &amp; posts. Use the filters to narrow the list.</p>
    ${renderFilters(state.type)}
    <div class="archive-loading">Loading archive...</div>`;

  try {
    const result = await fetchArchivePage(state.type, state.page);
    state.page = result.page;
    writeArchiveStateToUrl(state);

    container.innerHTML = `
      <p class="archive-intro">Browse the most recent materials across meeting minutes, historical documents, and updates &amp; posts. Use the filters to narrow the list.</p>
      ${renderFilters(state.type)}
      <p class="archive-count">${result.total} item${result.total === 1 ? '' : 's'}</p>
      ${renderItems(result.items)}
      ${renderPagination(result.page, result.totalPages)}`;

    bindArchiveControls(state);
  } catch (error) {
    console.error('Error loading archive:', error);
    container.innerHTML = `
      <p class="archive-intro">Browse the most recent materials across meeting minutes, historical documents, and updates &amp; posts.</p>
      ${renderFilters(state.type)}
      <p class="archive-empty">Unable to load archive. Please try again later.</p>`;
    bindArchiveControls(state);
  }
}

function bindArchiveControls(state) {
  const container = document.getElementById('archive-content');
  if (!container) return;

  container.querySelectorAll('.archive-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextType = btn.getAttribute('data-filter') || 'all';
      renderArchive({ type: nextType, page: 1 });
    });
  });

  container.querySelectorAll('.archive-page-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const nextPage = parseInt(btn.getAttribute('data-page') || '1', 10) || 1;
      renderArchive({ type: state.type, page: nextPage });
      const top = document.getElementById('archive-content');
      if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('archive-content')) return;
  await renderArchive(readArchiveStateFromUrl());
});
