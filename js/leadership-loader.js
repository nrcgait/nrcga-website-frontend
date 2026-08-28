async function loadLeadershipRoster() {
  const container = document.getElementById('leadership-roster');
  if (!container || !window.NRCGA_API) return;
  try {
    const rows = await window.NRCGA_API.get('/leadership');
    if (!Array.isArray(rows) || !rows.length) {
      container.innerHTML = '<p class="muted">Leadership roster coming soon.</p>';
      return;
    }
    container.innerHTML = rows
      .map((person) => {
        const photo = person.photo_url
          ? `<img src="${escapeHtml(person.photo_url)}" alt="${escapeHtml(person.name)}" class="leadership-photo">`
          : '';
        const bio = person.bio ? `<p>${escapeHtml(person.bio)}</p>` : '';
        return `<article class="leadership-card">${photo}<h3>${escapeHtml(person.name)}</h3><p class="leadership-title">${escapeHtml(person.title || '')}</p>${bio}</article>`;
      })
      .join('');
  } catch (err) {
    console.warn('Leadership API unavailable', err);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', loadLeadershipRoster);
