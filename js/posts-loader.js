async function loadPostsList() {
  const container = document.getElementById('posts-list');
  if (!container || !window.NRCGA_API) return;
  try {
    const rows = await window.NRCGA_API.get('/posts');
    if (!Array.isArray(rows) || !rows.length) {
      container.innerHTML = '<p class="muted">No posts published yet.</p>';
      return;
    }
    container.innerHTML = rows
      .map((post) => {
        const date = post.published_at ? new Date(post.published_at).toLocaleDateString() : '';
        const excerpt = post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : '';
        const cover = post.cover_url
          ? `<img src="${escapeAttr(post.cover_url)}" alt="" class="post-cover">`
          : '';
        return `<article class="post-card">
          ${cover}
          <h3><a href="post.html?slug=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h3>
          <p class="post-meta">${escapeHtml(date)}</p>
          ${excerpt}
        </article>`;
      })
      .join('');
  } catch (err) {
    console.warn('Posts API unavailable', err);
  }
}

async function loadSinglePost() {
  const container = document.getElementById('post-article');
  if (!container || !window.NRCGA_API) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) {
    container.innerHTML = '<p>Post not found.</p>';
    return;
  }
  try {
    const post = await window.NRCGA_API.get(`/posts/${encodeURIComponent(slug)}`);
    document.title = `${post.title} - NRCGA`;
    const date = post.published_at ? new Date(post.published_at).toLocaleDateString() : '';
    const cover = post.cover_url ? `<img src="${escapeAttr(post.cover_url)}" alt="" class="post-cover">` : '';
    const pdf = post.pdf_url
      ? `<p><a class="btn btn-secondary" href="${escapeAttr(post.pdf_url)}" target="_blank" rel="noopener">Download PDF</a></p>`
      : '';
    container.innerHTML = `
      <header class="page-header"><div class="container">
        <span class="section-label">Updates</span>
        <h1 class="page-title">${escapeHtml(post.title)}</h1>
        <p class="page-subtitle">${escapeHtml(date)}</p>
      </div></header>
      <section class="content-section"><div class="container post-body">
        ${cover}
        ${pdf}
        <div class="post-html">${post.body_html || ''}</div>
      </div></section>`;
  } catch (err) {
    container.innerHTML = '<p>Post not found.</p>';
    console.warn(err);
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

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('posts-list')) loadPostsList();
  if (document.getElementById('post-article')) loadSinglePost();
});
