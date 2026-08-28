// Loads 811 FAQ items from the CMS API into about-811-questions.html

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(md) {
  const lines = String(md ?? '').split('\n');
  const parts = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    const tag = listType === 'ol' ? 'ol' : 'ul';
    parts.push(`<${tag}>${listItems.map((item) => `<li>${formatInline(item)}</li>`).join('')}</${tag}>`);
    listItems = [];
    listType = null;
  };

  const formatInline = (text) =>
    escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      continue;
    }

    flushList();
    parts.push(`<p>${formatInline(line)}</p>`);
  }

  flushList();
  return parts.join('');
}

function bindFaqAccordion(container) {
  container.querySelectorAll('.faq-question').forEach((question) => {
    question.addEventListener('click', () => {
      const faqItem = question.parentElement;
      const isActive = faqItem.classList.contains('active');
      container.querySelectorAll('.faq-item').forEach((item) => item.classList.remove('active'));
      if (!isActive) faqItem.classList.add('active');
    });
  });
}

function renderFaqItem(item) {
  return `
    <div class="faq-item">
      <h3 class="faq-question">${escapeHtml(item.question)}</h3>
      <div class="faq-answer">${renderMarkdown(item.answer_md)}</div>
    </div>
  `;
}

async function loadQa() {
  const container = document.querySelector('.faq-container');
  if (!container) return;

  if (!window.NRCGA_API) return;

  try {
    const items = await window.NRCGA_API.get('/qa');
    if (!Array.isArray(items) || items.length === 0) {
      bindFaqAccordion(container);
      return;
    }
    container.innerHTML = items.map(renderFaqItem).join('');
    bindFaqAccordion(container);
  } catch (error) {
    console.warn('Q&A API unavailable, using static FAQ content', error);
    bindFaqAccordion(container);
  }
}

document.addEventListener('DOMContentLoaded', loadQa);
