// Shared page block rendering, schema templates, and path utilities.
;(function (global) {
  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function styleClasses(style) {
    if (!style || typeof style !== 'object') return ''
    const classes = []
    if (style.align) classes.push(`pb-align-${style.align}`)
    if (style.textSize) classes.push(`pb-text-${style.textSize}`)
    if (style.textColor) classes.push(`pb-color-${style.textColor}`)
    return classes.join(' ')
  }

  function sectionClasses(block) {
    const classes = ['page-block-section']
    if (block.bg === 'light') classes.push('pb-section-light')
    if (block.padding === 'sm') classes.push('pb-pad-sm')
    else if (block.padding === 'lg') classes.push('pb-pad-lg')
    else classes.push('pb-pad-md')
    return classes.join(' ')
  }

  function gapClass(gap) {
    if (gap === 'sm') return 'pb-gap-sm'
    if (gap === 'lg') return 'pb-gap-lg'
    return 'pb-gap-md'
  }

  function imageWidthClass(width) {
    if (width === 'sm') return 'pb-img-sm'
    if (width === 'md') return 'pb-img-md'
    if (width === 'lg') return 'pb-img-lg'
    return 'pb-img-full'
  }

  function imageAlignClass(align) {
    if (align === 'left') return 'pb-img-align-left'
    if (align === 'right') return 'pb-img-align-right'
    return 'pb-img-align-center'
  }

  function wrapBlock(path, type, innerHtml, extraClass) {
    const cls = ['page-block', extraClass].filter(Boolean).join(' ')
    return `<div class="${cls}" data-block-path="${escapeHtml(path)}" data-block-type="${escapeHtml(type)}">${innerHtml}</div>`
  }

  function renderBlockInner(block, pathPrefix) {
    switch (block.type) {
      case 'html':
        return String(block.content || '')
      case 'section':
        return `<section class="${sectionClasses(block)}"><div class="container">${renderBlocks(block.children || [], pathPrefix)}</div></section>`
      case 'spacer': {
        const size = block.size === 'sm' ? 'pb-spacer-sm' : block.size === 'lg' ? 'pb-spacer-lg' : 'pb-spacer-md'
        return `<div class="pb-spacer ${size}"></div>`
      }
      case 'columns': {
        const cols = block.cols === 3 ? 3 : 2
        const gap = gapClass(block.gap)
        const columns = block.columns || []
        const colHtml = columns
          .map((colBlocks, colIdx) => {
            const colPath = pathPrefix !== undefined ? `${pathPrefix}.${colIdx}` : String(colIdx)
            return `<div class="pb-column">${renderBlocks(colBlocks || [], colPath)}</div>`
          })
          .join('')
        const emptyCols = Math.max(0, cols - columns.length)
        const padded =
          colHtml +
          Array.from({ length: emptyCols })
            .map(() => '<div class="pb-column"></div>')
            .join('')
        return `<div class="pb-columns pb-columns-${cols} ${gap}">${padded}</div>`
      }
      case 'grid': {
        const cols = block.columns === 4 ? 4 : block.columns === 2 ? 2 : 3
        const gap = gapClass(block.gap)
        const items = (block.items || [])
          .map(
            (item) =>
              `<div class="pb-grid-item">${item.icon ? `<div class="pb-grid-icon">${escapeHtml(item.icon)}</div>` : ''}<h3>${escapeHtml(item.title || '')}</h3><p>${escapeHtml(item.body || '')}</p></div>`,
          )
          .join('')
        return `<div class="pb-grid pb-grid-cols-${cols} ${gap}">${items}</div>`
      }
      case 'heading': {
        const tag = block.level === 3 ? 'h3' : block.level === 4 ? 'h4' : 'h2'
        const cls = ['page-block-heading', styleClasses(block.style)].filter(Boolean).join(' ')
        return `<${tag} class="${cls}">${escapeHtml(block.text)}</${tag}>`
      }
      case 'text': {
        const cls = ['page-block-text', styleClasses(block.style)].filter(Boolean).join(' ')
        return `<div class="${cls}">${escapeHtml(block.body).replace(/\n/g, '<br>')}</div>`
      }
      case 'image': {
        const widthCls = imageWidthClass(block.width)
        const alignCls = imageAlignClass(block.align)
        return `<figure class="page-block-image ${widthCls} ${alignCls}"><img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt || '')}" />${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}</figure>`
      }
      case 'callout':
        return `<div class="page-block-callout"><strong>${escapeHtml(block.title || '')}</strong><p>${escapeHtml(block.body)}</p></div>`
      case 'cta_button':
        return `<p class="pb-cta-wrap ${styleClasses(block.style)}"><a href="${escapeHtml(block.url)}" class="btn btn-primary">${escapeHtml(block.label)}</a></p>`
      case 'winner_card':
        return `<div class="page-block-winner">${block.image_url ? `<img src="${escapeHtml(block.image_url)}" alt="" />` : ''}<h3>${escapeHtml(block.winner_name)}</h3><p>${escapeHtml(block.year_label || '')}</p>${block.celebration_date ? `<p>${escapeHtml(block.celebration_date)}</p>` : ''}</div>`
      case 'hall_of_fame_grid': {
        const items = (block.items || [])
          .map(
            (item) =>
              `<div class="pb-hof-item">${escapeHtml(item.name)}<br><span>${escapeHtml(item.year)}</span></div>`,
          )
          .join('')
        return `<div class="pb-hof-grid">${items}</div>`
      }
      case 'embed':
        if (block.embed_type === 'youtube') {
          return `<div class="page-block-embed"><iframe src="${escapeHtml(block.url)}" allowfullscreen></iframe></div>`
        }
        if (block.embed_type === 'pdf') {
          return `<div class="page-block-embed pb-embed-pdf"><iframe src="${escapeHtml(block.url)}"></iframe></div>`
        }
        return `<div class="page-block-embed pb-embed-form"><iframe src="${escapeHtml(block.url)}"></iframe></div>`
      default:
        return ''
    }
  }

  function renderBlock(block, path) {
    const inner = renderBlockInner(block, path)
    return wrapBlock(path, block.type, inner)
  }

  function renderBlocks(blocks, pathPrefix) {
    if (!Array.isArray(blocks)) return ''
    return blocks
      .map((block, index) => {
        const path = pathPrefix === '' ? String(index) : `${pathPrefix}.${index}`
        return renderBlock(block, path)
      })
      .join('\n')
  }

  function renderPageBody(page) {
    if (page.body_html) {
      return String(page.body_html)
    }
    if (page.body_json) {
      try {
        const blocks = JSON.parse(page.body_json)
        return renderBlocks(blocks, '')
      } catch {
        return ''
      }
    }
    if (page.body_md) {
      return `<div class="content-text">${escapeHtml(page.body_md).replace(/\n/g, '<br>')}</div>`
    }
    return ''
  }

  function buildPreviewDocument(page, siteOrigin, previewMode) {
    const origin = String(siteOrigin || '').replace(/\/$/, '')
    const sectionLabel = page.section_label
      ? `<span class="section-label">${escapeHtml(page.section_label)}</span>`
      : ''
    const title = page.title ? `<h1 class="page-title">${escapeHtml(page.title)}</h1>` : ''
    const subtitle = page.subtitle ? `<p class="page-subtitle">${escapeHtml(page.subtitle)}</p>` : ''
    const body = renderPageBody(page)
    const previewCss = previewMode
      ? `<style>
body { margin: 0; }
.page-block { position: relative; cursor: pointer; transition: outline 0.15s; }
.page-block:hover { outline: 2px dashed rgba(43, 108, 176, 0.5); outline-offset: 2px; }
.page-block--selected { outline: 2px solid #2b6cb0 !important; outline-offset: 2px; }
.page-block a { pointer-events: none; }
</style>`
      : '<style>body { margin: 0; }</style>'

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base href="${escapeHtml(origin)}/">
  <link rel="stylesheet" href="${escapeHtml(origin)}/css/styles.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  ${previewCss}
</head>
<body${previewMode ? ' class="page-preview-mode"' : ''}>
  <section class="page-header">
    <div class="container">
      ${sectionLabel}
      ${title}
      ${subtitle}
    </div>
  </section>
  <div id="page-body">${body}</div>
</body>
</html>`
  }

  const BLOCK_TEMPLATES = {
    section: () => ({ type: 'section', bg: 'default', padding: 'md', children: [] }),
    heading: () => ({ type: 'heading', level: 2, text: 'Section heading', style: { align: 'left', textSize: 'lg', textColor: 'default' } }),
    text: () => ({ type: 'text', body: 'Paragraph text goes here.', style: { align: 'left', textSize: 'md', textColor: 'default' } }),
    image: () => ({ type: 'image', url: 'assets/images/programs/nrcga-meeting.jpg', alt: '', caption: '', width: 'full', align: 'center' }),
    columns: () => ({ type: 'columns', cols: 2, gap: 'md', columns: [[{ type: 'text', body: 'Left column content.', style: { align: 'left', textSize: 'md', textColor: 'default' } }], [{ type: 'text', body: 'Right column content.', style: { align: 'left', textSize: 'md', textColor: 'default' } }]] }),
    grid: () => ({
      type: 'grid',
      columns: 3,
      gap: 'md',
      items: [
        { icon: '✓', title: 'Item one', body: 'Description here.' },
        { icon: '✓', title: 'Item two', body: 'Description here.' },
        { icon: '✓', title: 'Item three', body: 'Description here.' },
      ],
    }),
    spacer: () => ({ type: 'spacer', size: 'md' }),
    callout: () => ({ type: 'callout', title: 'Note', body: 'Important information.' }),
    cta_button: () => ({ type: 'cta_button', label: 'Learn more', url: '#', style: { align: 'left' } }),
    winner_card: () => ({ type: 'winner_card', winner_name: 'Company Name', year_label: '2026 Winner', celebration_date: '', image_url: '' }),
    hall_of_fame_grid: () => ({
      type: 'hall_of_fame_grid',
      items: [
        { name: 'Company A', year: '2025' },
        { name: 'Company B', year: '2024' },
      ],
    }),
    embed: () => ({ type: 'embed', embed_type: 'youtube', url: 'https://www.youtube.com/embed/VIDEO_ID' }),
    html: () => ({ type: 'html', content: '<p>Custom HTML content.</p>' }),
  }

  const BLOCK_LABELS = {
    section: 'Section',
    heading: 'Heading',
    text: 'Text',
    image: 'Photo',
    columns: 'Side by side',
    grid: 'Feature grid',
    spacer: 'Spacer',
    callout: 'Callout',
    cta_button: 'Button',
    winner_card: 'Winner card',
    hall_of_fame_grid: 'Hall of fame',
    embed: 'Embed',
    html: 'HTML (advanced)',
  }

  function parsePath(path) {
    return String(path || '')
      .split('.')
      .filter((p) => p.length > 0)
      .map((p) => Number(p))
  }

  function getBlockAtPath(blocks, path) {
    const indices = parsePath(path)
    if (!indices.length) return null
    let current = blocks
    let block = null
    let i = 0
    while (i < indices.length) {
      block = current[indices[i]]
      if (!block) return null
      if (i === indices.length - 1) return block
      i++
      if (block.type === 'section') {
        current = block.children || []
      } else if (block.type === 'columns') {
        const colIdx = indices[i]
        if (colIdx === undefined) return null
        current = (block.columns || [])[colIdx] || []
        i++
      } else {
        return null
      }
    }
    return block
  }

  function getParentArray(blocks, path) {
    const indices = parsePath(path)
    if (!indices.length) return null
    if (indices.length === 1) return { arr: blocks, index: indices[0] }
    let current = blocks
    let i = 0
    while (i < indices.length - 1) {
      const block = current[indices[i]]
      if (!block) return null
      i++
      if (block.type === 'section') {
        if (!block.children) block.children = []
        current = block.children
      } else if (block.type === 'columns') {
        const colIdx = indices[i]
        if (colIdx === undefined) return null
        if (!block.columns) block.columns = []
        if (!block.columns[colIdx]) block.columns[colIdx] = []
        current = block.columns[colIdx]
        i++
      } else {
        return null
      }
    }
    return { arr: current, index: indices[indices.length - 1] }
  }

  function setBlockAtPath(blocks, path, value) {
    const parent = getParentArray(blocks, path)
    if (!parent) return false
    parent.arr[parent.index] = value
    return true
  }

  function deleteBlockAtPath(blocks, path) {
    const parent = getParentArray(blocks, path)
    if (!parent) return false
    parent.arr.splice(parent.index, 1)
    return true
  }

  function cloneBlock(block) {
    return JSON.parse(JSON.stringify(block))
  }

  global.NRCGA_pageBlocks = {
    escapeHtml,
    styleClasses,
    renderBlocks,
    renderBlockInner,
    renderPageBody,
    buildPreviewDocument,
    BLOCK_TEMPLATES,
    BLOCK_LABELS,
    parsePath,
    getBlockAtPath,
    getParentArray,
    setBlockAtPath,
    deleteBlockAtPath,
    cloneBlock,
  }
})(window)
