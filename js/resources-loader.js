async function loadResourceLinks() {
  const container = document.getElementById('resources-list');
  if (!container || !window.NRCGA_API) return;
  try {
    const rows = await window.NRCGA_API.get('/resources');
    if (!Array.isArray(rows) || !rows.length) {
      container.innerHTML = '<p class="muted">No resources published yet.</p>';
      return;
    }
    const byCategory = {};
    for (const row of rows) {
      const cat = row.category || 'Resources';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(row);
    }
    container.innerHTML = Object.entries(byCategory)
      .map(([category, items]) => {
        const links = items
          .map(
            (item) =>
              `<li><a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>${
                item.description ? `<p>${escapeHtml(item.description)}</p>` : ''
              }</li>`,
          )
          .join('');
        return `<section class="resources-group"><h3>${escapeHtml(category)}</h3><ul>${links}</ul></section>`;
      })
      .join('');
  } catch (err) {
    console.warn('Resources API unavailable', err);
  }
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

document.addEventListener('DOMContentLoaded', loadResourceLinks);
