// Page content loader — renders CMS page metadata and HTML/blocks into the page shell.
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

function parseRegions(page) {
  if (!page || !page.regions_json) return null;
  try {
    return typeof page.regions_json === 'string'
      ? JSON.parse(page.regions_json)
      : page.regions_json;
  } catch {
    return null;
  }
}

function fillRegion(id, html) {
  if (!html) return;
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

async function ensureNativeFormsScript() {
  if (window.NRCGA_mountForms) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'js/native-forms.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load native-forms.js'));
    document.body.appendChild(script);
  });
}

async function mountPageForms(container) {
  if (!container) return;
  const needsForms = container.querySelector('[data-nrcga-form-mount], form[data-nrcga-form]');
  if (!needsForms) return;
  await ensureNativeFormsScript();
  if (window.NRCGA_mountForms) {
    await window.NRCGA_mountForms(container);
  }
}

function contentIncludesEnrollment(html) {
  return String(html || '').includes('committee-enrollment.html')
}

function extractStaticEnrollmentCta(container) {
  if (!container) return null
  for (const section of container.querySelectorAll('section')) {
    if (section.querySelector('a[href*="committee-enrollment.html"]')) {
      return section.outerHTML
    }
  }
  return null
}

async function loadPageContent() {
  let slug = document.body.dataset.pageSlug;
  if (!slug) {
    const params = new URLSearchParams(window.location.search);
    slug = params.get('slug') || '';
    if (slug) document.body.dataset.pageSlug = slug;
  }
  if (!slug || !window.NRCGA_API || !window.NRCGA_pageBlocks) return;

  const bodyContainer = document.getElementById('page-body')
  if (!bodyContainer) return

  const staticEnrollmentCta = extractStaticEnrollmentCta(bodyContainer)

  try {
    const page = await window.NRCGA_API.get(`/pages/${encodeURIComponent(slug)}`);
    updatePageHeader(page);

    let bodyHtml = window.NRCGA_pageBlocks.renderPageBody(page);
    if (bodyHtml && !contentIncludesEnrollment(bodyHtml) && staticEnrollmentCta) {
      bodyHtml += staticEnrollmentCta;
    }
    if (bodyHtml) {
      bodyContainer.innerHTML = bodyHtml;
      window.NRCGA_pageBlocks.initParallaxFigures(bodyContainer);
    }

    const regions = parseRegions(page);
    if (regions) {
      fillRegion('page-hero', regions.hero_html);
      fillRegion('page-contact', regions.contact_html);
    }

    await mountPageForms(bodyContainer);
    await mountPageForms(document.getElementById('page-hero'));
    await mountPageForms(document.getElementById('page-contact'));

    if (page.title && slug !== 'home') {
      const suffix = document.title.includes(' - ') ? document.title.split(' - ').pop() : 'NRCGA';
      document.title = `${page.title} - ${suffix}`;
    }
  } catch (err) {
    console.warn('Page content not loaded from API:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadPageContent);
