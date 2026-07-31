// Page content loader — renders CMS page metadata and blocks into the page shell.
// Depends on page-blocks-render.js

function updatePageHeader(page) {
  const header = document.querySelector('.page-header');
  if (!header) return;

  const label = header.querySelector('.section-label');
  const title = header.querySelector('.page-title');
  const subtitle = header.querySelector('.page-subtitle');

  if (label && page.section_label) label.textContent = page.section_label;
  if (title && page.title) title.textContent = page.title;
  if (subtitle && page.subtitle) subtitle.textContent = page.subtitle;
}

async function loadPageContent() {
  const slug = document.body.dataset.pageSlug;
  if (!slug || !window.NRCGA_API || !window.NRCGA_pageBlocks) return;

  const bodyContainer = document.getElementById('page-body');
  if (!bodyContainer) return;

  try {
    const page = await window.NRCGA_API.get(`/pages/${encodeURIComponent(slug)}`);
    updatePageHeader(page);

    const bodyHtml = window.NRCGA_pageBlocks.renderPageBody(page);
    if (bodyHtml) {
      bodyContainer.innerHTML = bodyHtml;
    }

    if (page.title) {
      const suffix = document.title.includes(' - ') ? document.title.split(' - ').pop() : 'NRCGA';
      document.title = `${page.title} - ${suffix}`;
    }
  } catch (err) {
    console.warn('Page content not loaded from API:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadPageContent);
