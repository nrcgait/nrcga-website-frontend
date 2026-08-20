/**
 * Lightweight rich-text editor for posts and pages.
 * Syncs contenteditable HTML into hidden fields before submit.
 * Supports multiple hosts via [data-rich-editor] and insertable content blocks.
 * Images, buttons, callouts, embeds, and grids support right-click property editing.
 */
;(function () {
  const WIDTH_CLASSES = ['pb-img-sm', 'pb-img-md', 'pb-img-lg', 'pb-img-full']
  const ALIGN_CLASSES = ['pb-img-align-left', 'pb-img-align-center', 'pb-img-align-right']
  const CTA_ALIGN_CLASSES = ['pb-align-left', 'pb-align-center', 'pb-align-right']
  const LAYOUT_CLASSES = [
    'pb-img-layout-inline',
    'pb-img-layout-float-left',
    'pb-img-layout-float-right',
    'pb-img-layout-full',
    'pb-img-layout-parallax',
  ]
  const GRID_COL_CLASSES = ['pb-grid-cols-2', 'pb-grid-cols-3', 'pb-grid-cols-4']
  const SELECTED_CLASSES = [
    'page-block-image--selected',
    'pb-cta-wrap--selected',
    'page-block-callout--selected',
    'page-block-embed--selected',
    'page-block-form--selected',
    'pb-grid--selected',
  ]
  const FONT_CLASSES = ['pb-font-default', 'pb-font-sans', 'pb-font-serif', 'pb-font-display', 'pb-font-mono']
  const COLOR_CLASSES = [
    'pb-color-default',
    'pb-color-primary',
    'pb-color-secondary',
    'pb-color-accent',
    'pb-color-navy',
    'pb-color-dark',
    'pb-color-muted',
    'pb-color-warning',
    'pb-color-danger',
    'pb-color-white',
  ]
  const SIZE_CLASSES = ['pb-text-sm', 'pb-text-md', 'pb-text-lg', 'pb-text-xl', 'pb-text-2xl']

  const FONTS = [
    { id: 'default', label: 'Default', className: 'pb-font-default' },
    { id: 'sans', label: 'Source Sans', className: 'pb-font-sans' },
    { id: 'serif', label: 'Source Serif', className: 'pb-font-serif' },
    { id: 'display', label: 'Barlow', className: 'pb-font-display' },
    { id: 'mono', label: 'Mono', className: 'pb-font-mono' },
  ]

  const COLORS = [
    { id: 'default', label: 'Default', className: 'pb-color-default' },
    { id: 'primary', label: 'Primary blue', className: 'pb-color-primary' },
    { id: 'secondary', label: 'Green', className: 'pb-color-secondary' },
    { id: 'accent', label: 'Orange', className: 'pb-color-accent' },
    { id: 'navy', label: 'Navy', className: 'pb-color-navy' },
    { id: 'dark', label: 'Dark gray', className: 'pb-color-dark' },
    { id: 'muted', label: 'Muted', className: 'pb-color-muted' },
    { id: 'warning', label: 'Warning', className: 'pb-color-warning' },
    { id: 'danger', label: 'Danger', className: 'pb-color-danger' },
    { id: 'white', label: 'White', className: 'pb-color-white' },
  ]

  const SIZES = [
    { id: 'sm', label: 'Small', className: 'pb-text-sm' },
    { id: 'md', label: 'Normal', className: 'pb-text-md' },
    { id: 'lg', label: 'Large', className: 'pb-text-lg' },
    { id: 'xl', label: 'XL', className: 'pb-text-xl' },
    { id: '2xl', label: 'Display', className: 'pb-text-2xl' },
  ]

  const LAYOUTS = [
    { id: 'inline', label: 'Inline', className: 'pb-img-layout-inline' },
    { id: 'float-left', label: 'Float left', className: 'pb-img-layout-float-left' },
    { id: 'float-right', label: 'Float right', className: 'pb-img-layout-float-right' },
    { id: 'full', label: 'Full width', className: 'pb-img-layout-full' },
    { id: 'parallax', label: 'Background parallax', className: 'pb-img-layout-parallax' },
  ]

  const CTA_ALIGNS = [
    { id: 'left', label: 'Left', className: 'pb-align-left' },
    { id: 'center', label: 'Center', className: 'pb-align-center' },
    { id: 'right', label: 'Right', className: 'pb-align-right' },
  ]

  const GRID_COLS = [
    { id: '2', label: '2 columns', className: 'pb-grid-cols-2' },
    { id: '3', label: '3 columns', className: 'pb-grid-cols-3' },
    { id: '4', label: '4 columns', className: 'pb-grid-cols-4' },
  ]

  let activeFigure = null
  let activeCta = null
  let activeCallout = null
  let activeEmbed = null
  let activeForm = null
  let activeGrid = null
  let activeKind = null // 'image' | 'button' | 'callout' | 'embed' | 'form' | 'grid'
  let activeEditor = null
  let activeSync = null
  let menuEl = null
  let propsModal = null

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function stripBlockWrappers(html) {
    if (!html || typeof document === 'undefined') return html || ''
    const div = document.createElement('div')
    div.innerHTML = html
    div.querySelectorAll('[data-block-path]').forEach((el) => {
      const parent = el.parentNode
      if (!parent) return
      while (el.firstChild) parent.insertBefore(el.firstChild, el)
      parent.removeChild(el)
    })
    return div.innerHTML
  }

  function blocksJsonToHtml(json) {
    if (!json || !window.NRCGA_pageBlocks) return ''
    try {
      const blocks = JSON.parse(json)
      const wrapped = window.NRCGA_pageBlocks.renderBlocks(blocks, '')
      return stripBlockWrappers(wrapped)
    } catch {
      return ''
    }
  }

  function insertHtmlAtCursor(editor, html) {
    editor.focus()
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) {
      editor.insertAdjacentHTML('beforeend', html)
      return
    }
    const range = sel.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) {
      editor.insertAdjacentHTML('beforeend', html)
      return
    }
    range.deleteContents()
    const temp = document.createElement('div')
    temp.innerHTML = html
    const frag = document.createDocumentFragment()
    let node
    let last = null
    while ((node = temp.firstChild)) {
      last = frag.appendChild(node)
    }
    range.insertNode(frag)
    if (last) {
      range.setStartAfter(last)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

  function buildToolbar(includeBlocks) {
    const toolbar = document.createElement('div')
    toolbar.className = 'tiptap-toolbar'
    const formatBtns = [
      '<button type="button" data-cmd="bold"><b>B</b></button>',
      '<button type="button" data-cmd="italic"><i>I</i></button>',
      '<button type="button" data-cmd="underline"><u>U</u></button>',
      '<button type="button" data-cmd="insertUnorderedList">• List</button>',
      '<button type="button" data-cmd="insertOrderedList">1. List</button>',
      '<button type="button" data-cmd="formatBlock" data-value="h2">H2</button>',
      '<button type="button" data-cmd="formatBlock" data-value="h3">H3</button>',
      '<button type="button" data-cmd="formatBlock" data-value="p">P</button>',
      '<button type="button" data-cmd="createLink">Link</button>',
      '<span class="tiptap-toolbar-sep"></span>',
      `<select data-style="font" title="Font" aria-label="Font">
        <option value="">Font</option>
        ${FONTS.map((f) => `<option value="${f.className}">${escapeHtml(f.label)}</option>`).join('')}
      </select>`,
      `<select data-style="color" title="Text color" aria-label="Text color">
        <option value="">Color</option>
        ${COLORS.map((c) => `<option value="${c.className}">${escapeHtml(c.label)}</option>`).join('')}
      </select>`,
      `<select data-style="size" title="Text size" aria-label="Text size">
        <option value="">Size</option>
        ${SIZES.map((s) => `<option value="${s.className}">${escapeHtml(s.label)}</option>`).join('')}
      </select>`,
    ]
    const blockBtns = includeBlocks
      ? [
          '<span class="tiptap-toolbar-sep"></span>',
          '<button type="button" data-insert="image">Image</button>',
          '<button type="button" data-insert="button">Button</button>',
          '<button type="button" data-insert="callout">Callout</button>',
          '<button type="button" data-insert="embed">Embed</button>',
          '<button type="button" data-insert="form">Form</button>',
          '<button type="button" data-insert="grid">Grid</button>',
          '<button type="button" data-insert="spacer">Spacer</button>',
        ]
      : []
    toolbar.innerHTML = formatBtns.concat(blockBtns).join(' ')
    return toolbar
  }

  function classGroupForStyle(styleKind) {
    if (styleKind === 'font') return FONT_CLASSES
    if (styleKind === 'color') return COLOR_CLASSES
    if (styleKind === 'size') return SIZE_CLASSES
    return []
  }

  function isDefaultStyleClass(className) {
    return className === 'pb-font-default' || className === 'pb-color-default' || className === 'pb-text-md'
  }

  function getClosestTextBlock(node, editor) {
    let el = node && node.nodeType === 3 ? node.parentElement : node
    while (el && el !== editor) {
      if (el.nodeType === 1) {
        const tag = el.tagName
        if (/^(P|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE|DIV)$/.test(tag)) return el
      }
      el = el.parentElement
    }
    return null
  }

  function findStyledSpan(range, editor, group) {
    let node = range.commonAncestorContainer
    if (node.nodeType === 3) node = node.parentElement
    while (node && node !== editor) {
      if (node.nodeType === 1 && node.tagName === 'SPAN') {
        if (group.some((c) => node.classList.contains(c))) return node
      }
      node = node.parentElement
    }
    return null
  }

  function cleanupEmptySpan(span) {
    if (!span || span.tagName !== 'SPAN') return
    if (span.classList.length === 0 && !span.getAttribute('style')) {
      const parent = span.parentNode
      if (!parent) return
      while (span.firstChild) parent.insertBefore(span.firstChild, span)
      parent.removeChild(span)
    }
  }

  function applyInlineClass(editor, styleKind, className) {
    if (!className) return
    editor.focus()
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) return

    const group = classGroupForStyle(styleKind)
    const nextClass = isDefaultStyleClass(className) ? '' : className

    if (sel.isCollapsed) {
      const block = getClosestTextBlock(range.commonAncestorContainer, editor)
      if (!block || !editor.contains(block)) return
      replaceClassGroup(block, group, nextClass || null)
      return
    }

    const existing = findStyledSpan(range, editor, group)
    if (existing && range.toString() === (existing.textContent || '') && editor.contains(existing)) {
      replaceClassGroup(existing, group, nextClass || null)
      cleanupEmptySpan(existing)
      return
    }

    try {
      const wrapper = document.createElement('span')
      if (nextClass) wrapper.className = nextClass
      range.surroundContents(wrapper)
      if (!nextClass) cleanupEmptySpan(wrapper)
      sel.removeAllRanges()
      const next = document.createRange()
      next.selectNodeContents(wrapper)
      sel.addRange(next)
    } catch {
      const contents = range.extractContents()
      const wrapper = document.createElement('span')
      if (nextClass) wrapper.className = nextClass
      wrapper.appendChild(contents)
      range.insertNode(wrapper)
      wrapper.querySelectorAll('span').forEach((inner) => {
        const hadGroup = group.some((c) => inner.classList.contains(c))
        if (!hadGroup) return
        group.forEach((c) => inner.classList.remove(c))
        cleanupEmptySpan(inner)
      })
      sel.removeAllRanges()
      const next = document.createRange()
      next.selectNodeContents(wrapper)
      sel.addRange(next)
    }
  }

  function findFigure(target) {
    if (!target || !target.closest) return null
    return target.closest('figure.page-block-image')
  }

  function findCta(target) {
    if (!target || !target.closest) return null
    return target.closest('.pb-cta-wrap')
  }

  function findCallout(target) {
    if (!target || !target.closest) return null
    return target.closest('.page-block-callout')
  }

  function findEmbed(target) {
    if (!target || !target.closest) return null
    return target.closest('.page-block-embed')
  }

  function findGrid(target) {
    if (!target || !target.closest) return null
    return target.closest('.pb-grid')
  }

  function getCtaLink(wrap) {
    return wrap ? wrap.querySelector('a.btn, a') : null
  }

  function getCtaAlignId(wrap) {
    const match = CTA_ALIGNS.find((a) => wrap.classList.contains(a.className))
    return match ? match.id : 'left'
  }

  function setCtaAlign(wrap, alignId) {
    const align = CTA_ALIGNS.find((a) => a.id === alignId) || CTA_ALIGNS[0]
    replaceClassGroup(wrap, CTA_ALIGN_CLASSES, align.className)
  }

  function isCtaMovable(wrap) {
    return wrap?.dataset?.ctaMovable !== '0'
  }

  function setCtaMovable(wrap, movable) {
    wrap.dataset.ctaMovable = movable ? '1' : '0'
  }

  function ensureCtaAttrs(wrap) {
    if (!wrap.dataset.ctaMovable) wrap.dataset.ctaMovable = '1'
    if (!CTA_ALIGNS.some((a) => wrap.classList.contains(a.className))) {
      wrap.classList.add('pb-align-left')
    }
  }

  function moveSiblingBlock(el, direction) {
    const parent = el.parentElement
    if (!parent) return false
    if (direction === 'up') {
      const prev = el.previousElementSibling
      if (!prev) return false
      parent.insertBefore(el, prev)
      return true
    }
    const next = el.nextElementSibling
    if (!next) return false
    parent.insertBefore(next, el)
    return true
  }

  function getFigureImg(figure) {
    return figure ? figure.querySelector('img') : null
  }

  function getLayoutId(figure) {
    const match = LAYOUTS.find((l) => figure.classList.contains(l.className))
    return match ? match.id : 'inline'
  }

  function getWidthId(figure) {
    if (figure.classList.contains('pb-img-sm')) return 'sm'
    if (figure.classList.contains('pb-img-md')) return 'md'
    if (figure.classList.contains('pb-img-lg')) return 'lg'
    return 'full'
  }

  function getAlignId(figure) {
    if (figure.classList.contains('pb-img-align-left')) return 'left'
    if (figure.classList.contains('pb-img-align-right')) return 'right'
    return 'center'
  }

  function replaceClassGroup(el, group, nextClass) {
    group.forEach((c) => el.classList.remove(c))
    if (nextClass) el.classList.add(nextClass)
  }

  function syncParallaxBackground(figure) {
    if (window.NRCGA_pageBlocks?.syncParallaxFigure) {
      window.NRCGA_pageBlocks.syncParallaxFigure(figure)
      return
    }
    const img = getFigureImg(figure)
    if (figure.classList.contains('pb-img-layout-parallax') && img) {
      const src = img.currentSrc || img.getAttribute('src') || ''
      figure.style.backgroundImage = src ? `url("${src.replace(/"/g, '\\"')}")` : ''
    } else {
      figure.style.backgroundImage = ''
    }
  }

  function setLayout(figure, layoutId) {
    const layout = LAYOUTS.find((l) => l.id === layoutId) || LAYOUTS[0]
    replaceClassGroup(figure, LAYOUT_CLASSES, layout.className)
    figure.dataset.imgLayout = layout.id
    if (layout.id === 'full' || layout.id === 'parallax') {
      replaceClassGroup(figure, WIDTH_CLASSES, 'pb-img-full')
    }
    syncParallaxBackground(figure)
  }

  function setWidth(figure, widthId) {
    const map = { sm: 'pb-img-sm', md: 'pb-img-md', lg: 'pb-img-lg', full: 'pb-img-full' }
    replaceClassGroup(figure, WIDTH_CLASSES, map[widthId] || 'pb-img-full')
  }

  function setAlign(figure, alignId) {
    const map = {
      left: 'pb-img-align-left',
      center: 'pb-img-align-center',
      right: 'pb-img-align-right',
    }
    replaceClassGroup(figure, ALIGN_CLASSES, map[alignId] || 'pb-img-align-center')
  }

  function ensureLayoutClass(figure) {
    if (!LAYOUTS.some((l) => figure.classList.contains(l.className))) {
      figure.classList.add('pb-img-layout-inline')
      figure.dataset.imgLayout = 'inline'
    }
    syncParallaxBackground(figure)
  }

  function getLinkEl(figure) {
    const img = getFigureImg(figure)
    if (!img) return null
    const parent = img.parentElement
    return parent && parent.tagName === 'A' ? parent : null
  }

  function setImageLink(figure, url, newTab) {
    const img = getFigureImg(figure)
    if (!img) return
    let link = getLinkEl(figure)
    if (!url) {
      if (link) {
        link.replaceWith(img)
      }
      return
    }
    if (!link) {
      link = document.createElement('a')
      img.replaceWith(link)
      link.appendChild(img)
    }
    link.setAttribute('href', url)
    if (newTab) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    } else {
      link.removeAttribute('target')
      link.removeAttribute('rel')
    }
  }

  function setCaption(figure, caption) {
    let figcaption = figure.querySelector('figcaption')
    const text = String(caption || '').trim()
    if (!text) {
      if (figcaption) figcaption.remove()
      return
    }
    if (!figcaption) {
      figcaption = document.createElement('figcaption')
      figure.appendChild(figcaption)
    }
    figcaption.textContent = text
  }

  function getCalloutTitle(el) {
    return el.querySelector('strong')?.textContent || ''
  }

  function getCalloutBody(el) {
    return el.querySelector('p')?.textContent || ''
  }

  function setCalloutTitle(el, title) {
    let strong = el.querySelector('strong')
    if (!strong) {
      strong = document.createElement('strong')
      el.insertBefore(strong, el.firstChild)
    }
    strong.textContent = title
  }

  function setCalloutBody(el, body) {
    let p = el.querySelector('p')
    if (!p) {
      p = document.createElement('p')
      el.appendChild(p)
    }
    p.textContent = body
  }

  function normalizeEmbedUrl(url) {
    const raw = String(url || '').trim()
    if (!raw) return ''

    if (/youtube\.com\/embed\//i.test(raw)) return raw

    let match = raw.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/i)
    if (match) return `https://www.youtube.com/embed/${match[1]}`

    match = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i)
    if (match) return `https://www.youtube.com/embed/${match[1]}`

    match = raw.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i)
    if (match) return `https://www.youtube.com/embed/${match[1]}`

    return raw
  }

  const IFRAME_ATTRS = [
    'src',
    'width',
    'height',
    'title',
    'allow',
    'allowfullscreen',
    'loading',
    'referrerpolicy',
    'name',
    'id',
    'sandbox',
  ]

  function isFormEmbedUrl(url) {
    return /forms\.office\.com|forms\.microsoft\.com|google\.com\/forms|typeform\.com|jotform\.com|form\.jotform/i.test(
      String(url || ''),
    )
  }

  function embedWrapperClass(src, custom) {
    if (custom) return 'page-block-embed pb-embed-custom'
    if (/\.pdf(\?|$)/i.test(src)) return 'page-block-embed pb-embed-pdf'
    if (isFormEmbedUrl(src)) return 'page-block-embed pb-embed-form'
    return 'page-block-embed'
  }

  function buildSanitizedIframe(input) {
    if (typeof document === 'undefined') return null
    const raw = String(input || '').trim()
    if (!/<iframe[\s>]/i.test(raw)) return null

    const div = document.createElement('div')
    div.innerHTML = raw
    const source = div.querySelector('iframe')
    if (!source) return null

    const iframe = document.createElement('iframe')
    IFRAME_ATTRS.forEach((attr) => {
      if (!source.hasAttribute(attr)) return
      let value = source.getAttribute(attr) || ''
      if (attr === 'src') value = normalizeEmbedUrl(value)
      if (!value) return
      iframe.setAttribute(attr, value)
    })

    const style = source.getAttribute('style')
    if (style && !/<|>|javascript:/i.test(style)) {
      iframe.setAttribute('style', style)
    }

    if (!iframe.getAttribute('src')) return null
    return iframe
  }

  function parseEmbedInput(input) {
    const raw = String(input || '').trim()
    if (!raw) return null

    const customIframe = buildSanitizedIframe(raw)
    if (customIframe) {
      const src = customIframe.getAttribute('src') || ''
      return {
        wrapperClass: embedWrapperClass(src, true),
        iframeHtml: customIframe.outerHTML,
      }
    }

    const url = normalizeEmbedUrl(raw)
    if (!url) return null
    const isPdf = /\.pdf(\?|$)/i.test(url)
    return {
      wrapperClass: embedWrapperClass(url, false),
      iframeHtml: `<iframe src="${escapeHtml(url)}"${isPdf ? '' : ' allowfullscreen'}></iframe>`,
    }
  }

  function buildEmbedBlockHtml(parsed) {
    return `<div class="${parsed.wrapperClass}">${parsed.iframeHtml}</div>`
  }

  function getEmbedContentForEdit(el) {
    const iframe = el.querySelector('iframe')
    if (!iframe) return ''
    return iframe.outerHTML
  }

  function setEmbedContent(el, input) {
    const parsed = parseEmbedInput(input)
    if (!parsed) return false
    el.className = parsed.wrapperClass
    el.innerHTML = parsed.iframeHtml
    return true
  }

  function getGridColsId(grid) {
    const match = GRID_COLS.find((c) => grid.classList.contains(c.className))
    return match ? match.id : '3'
  }

  function setGridCols(grid, colsId) {
    const cols = GRID_COLS.find((c) => c.id === colsId) || GRID_COLS[1]
    replaceClassGroup(grid, GRID_COL_CLASSES, cols.className)
  }

  function ensureGridAttrs(grid) {
    if (!GRID_COLS.some((c) => grid.classList.contains(c.className))) {
      grid.classList.add('pb-grid-cols-3')
    }
  }

  function readGridItem(item) {
    return {
      icon: item.querySelector('.pb-grid-icon')?.textContent || '',
      title: item.querySelector('h3')?.textContent || '',
      body: item.querySelector('p')?.textContent || '',
    }
  }

  function writeGridItem(item, data) {
    let icon = item.querySelector('.pb-grid-icon')
    const iconText = String(data.icon || '').trim()
    if (iconText) {
      if (!icon) {
        icon = document.createElement('div')
        icon.className = 'pb-grid-icon'
        item.insertBefore(icon, item.firstChild)
      }
      icon.textContent = iconText
    } else if (icon) {
      icon.remove()
    }

    let title = item.querySelector('h3')
    if (!title) {
      title = document.createElement('h3')
      item.appendChild(title)
    }
    title.textContent = data.title || ''

    let body = item.querySelector('p')
    if (!body) {
      body = document.createElement('p')
      item.appendChild(body)
    }
    body.textContent = data.body || ''
  }

  function createGridItemHtml(item) {
    const icon = item.icon
      ? `<div class="pb-grid-icon">${escapeHtml(item.icon)}</div>`
      : ''
    return `<div class="pb-grid-item">${icon}<h3>${escapeHtml(item.title || '')}</h3><p>${escapeHtml(item.body || '')}</p></div>`
  }

  function addGridItem(grid) {
    grid.insertAdjacentHTML(
      'beforeend',
      createGridItemHtml({ icon: '✓', title: 'New item', body: 'Description here.' }),
    )
  }

  function removeGridItemAt(grid, index) {
    const items = grid.querySelectorAll('.pb-grid-item')
    if (items[index]) items[index].remove()
  }

  function notifyChange() {
    if (typeof activeSync === 'function') activeSync()
    if (activeEditor) {
      activeEditor.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  function clearSelectionOutline() {
    document.querySelectorAll(SELECTED_CLASSES.map((c) => `.${c}`).join(', ')).forEach((el) => {
      SELECTED_CLASSES.forEach((c) => el.classList.remove(c))
    })
  }

  function clearActiveBlock() {
    activeFigure = null
    activeCta = null
    activeCallout = null
    activeEmbed = null
    activeForm = null
    activeGrid = null
    activeKind = null
  }

  function hideMenu() {
    if (menuEl) menuEl.hidden = true
  }

  function ensureMenu() {
    if (menuEl) return menuEl
    menuEl = document.createElement('div')
    menuEl.className = 'pb-img-context-menu'
    menuEl.hidden = true
    menuEl.setAttribute('role', 'menu')
    document.body.appendChild(menuEl)

    menuEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn || btn.disabled) return
      e.preventDefault()
      const action = btn.getAttribute('data-action')
      const value = btn.getAttribute('data-value') || ''
      if (activeKind === 'button' && activeCta) {
        runButtonAction(action, value)
      } else if (activeKind === 'image' && activeFigure) {
        runImageAction(action, value)
      } else if (activeKind === 'callout' && activeCallout) {
        runCalloutAction(action, value)
      } else if (activeKind === 'embed' && activeEmbed) {
        runEmbedAction(action, value)
      } else if (activeKind === 'form' && activeForm) {
        runFormAction(action, value)
      } else if (activeKind === 'grid' && activeGrid) {
        runGridAction(action, value)
      }
    })

    document.addEventListener('click', (e) => {
      if (!menuEl || menuEl.hidden) return
      if (menuEl.contains(e.target)) return
      hideMenu()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideMenu()
        hidePropsModal()
      }
    })
    window.addEventListener('scroll', hideMenu, true)
    window.addEventListener('resize', hideMenu)
    return menuEl
  }

  function positionMenu(menu, x, y) {
    menu.hidden = false
    menu.style.left = '0px'
    menu.style.top = '0px'
    const rect = menu.getBoundingClientRect()
    const left = Math.min(x, window.innerWidth - rect.width - 8)
    const top = Math.min(y, window.innerHeight - rect.height - 8)
    menu.style.left = `${Math.max(8, left)}px`
    menu.style.top = `${Math.max(8, top)}px`
  }

  function showMenu(x, y, figure) {
    const menu = ensureMenu()
    const layout = getLayoutId(figure)
    const hasLink = !!getLinkEl(figure)
    const hasCaption = !!figure.querySelector('figcaption')?.textContent?.trim()

    menu.innerHTML = [
      '<div class="pb-img-menu-label">Layout</div>',
      ...LAYOUTS.map(
        (l) =>
          `<button type="button" role="menuitem" data-action="layout" data-value="${l.id}" class="${layout === l.id ? 'is-active' : ''}">${escapeHtml(l.label)}</button>`,
      ),
      '<div class="pb-img-menu-sep"></div>',
      '<button type="button" role="menuitem" data-action="replace">Replace image…</button>',
      '<button type="button" role="menuitem" data-action="alt">Edit alt text…</button>',
      `<button type="button" role="menuitem" data-action="caption">${hasCaption ? 'Edit caption…' : 'Add caption…'}</button>`,
      `<button type="button" role="menuitem" data-action="link">${hasLink ? 'Edit link…' : 'Add link…'}</button>`,
      '<button type="button" role="menuitem" data-action="props">Edit properties…</button>',
      '<div class="pb-img-menu-sep"></div>',
      '<button type="button" role="menuitem" data-action="delete" class="is-danger">Delete</button>',
    ].join('')

    positionMenu(menu, x, y)
  }

  function showButtonMenu(x, y, wrap) {
    const menu = ensureMenu()
    const align = getCtaAlignId(wrap)
    const movable = isCtaMovable(wrap)
    const canMoveUp = !!wrap.previousElementSibling
    const canMoveDown = !!wrap.nextElementSibling

    menu.innerHTML = [
      '<div class="pb-img-menu-label">Button</div>',
      '<button type="button" role="menuitem" data-action="label">Edit label…</button>',
      '<button type="button" role="menuitem" data-action="url">Edit URL…</button>',
      '<div class="pb-img-menu-sep"></div>',
      '<div class="pb-img-menu-label">Alignment</div>',
      ...CTA_ALIGNS.map(
        (a) =>
          `<button type="button" role="menuitem" data-action="align" data-value="${a.id}" class="${align === a.id ? 'is-active' : ''}">${escapeHtml(a.label)}</button>`,
      ),
      '<div class="pb-img-menu-sep"></div>',
      `<button type="button" role="menuitem" data-action="toggle-move" class="${movable ? 'is-active' : ''}">${movable ? '✓ Allow moving' : 'Allow moving'}</button>`,
      ...(movable
        ? [
            `<button type="button" role="menuitem" data-action="move-up"${canMoveUp ? '' : ' disabled'}>Move up</button>`,
            `<button type="button" role="menuitem" data-action="move-down"${canMoveDown ? '' : ' disabled'}>Move down</button>`,
          ]
        : ['<div class="pb-img-menu-hint">Moving is off — turn it on to reposition</div>']),
      '<div class="pb-img-menu-sep"></div>',
      '<button type="button" role="menuitem" data-action="delete" class="is-danger">Delete</button>',
    ].join('')

    positionMenu(menu, x, y)
  }

  function showCalloutMenu(x, y) {
    const menu = ensureMenu()
    menu.innerHTML = [
      '<div class="pb-img-menu-label">Callout</div>',
      '<button type="button" role="menuitem" data-action="title">Edit title…</button>',
      '<button type="button" role="menuitem" data-action="body">Edit text…</button>',
      '<div class="pb-img-menu-sep"></div>',
      '<button type="button" role="menuitem" data-action="delete" class="is-danger">Delete</button>',
    ].join('')
    positionMenu(menu, x, y)
  }

  function showEmbedMenu(x, y) {
    const menu = ensureMenu()
    menu.innerHTML = [
      '<div class="pb-img-menu-label">Embed</div>',
      '<button type="button" role="menuitem" data-action="url">Edit embed…</button>',
      '<div class="pb-img-menu-sep"></div>',
      '<button type="button" role="menuitem" data-action="delete" class="is-danger">Delete</button>',
    ].join('')
    positionMenu(menu, x, y)
  }

  function showGridMenu(x, y, grid) {
    const menu = ensureMenu()
    const cols = getGridColsId(grid)
    const items = grid.querySelectorAll('.pb-grid-item')
    const itemButtons = Array.from(items).map(
      (item, i) =>
        `<button type="button" role="menuitem" data-action="edit-item" data-value="${i}">Edit item ${i + 1}…</button>`,
    )

    menu.innerHTML = [
      '<div class="pb-img-menu-label">Feature grid</div>',
      '<div class="pb-img-menu-label">Columns</div>',
      ...GRID_COLS.map(
        (c) =>
          `<button type="button" role="menuitem" data-action="cols" data-value="${c.id}" class="${cols === c.id ? 'is-active' : ''}">${escapeHtml(c.label)}</button>`,
      ),
      '<div class="pb-img-menu-sep"></div>',
      ...itemButtons,
      '<button type="button" role="menuitem" data-action="add-item">Add item</button>',
      items.length
        ? `<button type="button" role="menuitem" data-action="remove-item">Remove last item</button>`
        : '',
      '<div class="pb-img-menu-sep"></div>',
      '<button type="button" role="menuitem" data-action="delete" class="is-danger">Delete</button>',
    ].join('')

    positionMenu(menu, x, y)
  }

  function parseFormInboxes(host) {
    const raw = host?.getAttribute('data-form-inboxes')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed
            .map((item) => ({
              slug: String(item.slug || '').trim(),
              title: String(item.title || item.slug || '').trim(),
            }))
            .filter((item) => item.slug)
        : []
    } catch {
      return []
    }
  }

  function createFormBlockHtml(slug, title) {
    const safeSlug = escapeHtml(slug)
    const safeTitle = escapeHtml(title || slug)
    return `<div class="page-block-form" data-nrcga-form-mount="${safeSlug}" data-form-title="${safeTitle}"><p class="page-block-form-label">Form: ${safeTitle}</p></div>`
  }

  function showFormPicker(inboxes, callback) {
    const list = Array.isArray(inboxes) ? inboxes.filter((item) => item.slug) : []
    if (!list.length) {
      window.alert('No form inboxes yet. Create one under Admin → Inboxes, then try again.')
      return
    }
    if (list.length === 1) {
      callback(list[0])
      return
    }
    const options = list.map((item, index) => `${index + 1}. ${item.title} (${item.slug})`).join('\n')
    const answer = window.prompt(`Choose a form inbox:\n\n${options}\n\nEnter number or slug:`)
    if (answer == null) return
    const trimmed = answer.trim()
    if (!trimmed) return
    const byIndex = Number(trimmed)
    if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= list.length) {
      callback(list[byIndex - 1])
      return
    }
    const match = list.find((item) => item.slug === trimmed)
    if (match) {
      callback(match)
      return
    }
    window.alert('Could not find that inbox. Enter a list number or exact slug.')
  }

  function showAssetPicker(callback, options) {
    const opts = options || {}
    if (window.NrcgaAssetPicker?.open) {
      window.NrcgaAssetPicker.open(
        (url) => {
          if (url) callback(url)
        },
        { defaultUrl: opts.defaultUrl || 'assets/images/', imagesOnly: true },
      )
      return
    }
    const next = window.prompt('Image URL', opts.defaultUrl || 'assets/images/')
    if (next == null || !next.trim()) return
    callback(next.trim())
  }

  function hidePropsModal() {
    if (propsModal) propsModal.hidden = true
  }

  function ensurePropsModal() {
    if (propsModal) return propsModal
    propsModal = document.createElement('div')
    propsModal.className = 'pb-img-props-modal'
    propsModal.hidden = true
    propsModal.innerHTML = `
      <div class="pb-img-props-panel" role="dialog" aria-label="Image properties">
        <h4>Image properties</h4>
        <div class="inspector-field">
          <label for="pb-img-prop-url">Image URL</label>
          <input type="text" id="pb-img-prop-url" data-prop="url" />
        </div>
        <div class="inspector-field">
          <button type="button" class="btn btn-secondary btn-sm" data-prop-pick>Choose from assets</button>
          <button type="button" class="btn btn-secondary btn-sm" data-prop-url-prompt>Enter URL…</button>
        </div>
        <div class="inspector-field">
          <label for="pb-img-prop-alt">Alt text</label>
          <input type="text" id="pb-img-prop-alt" data-prop="alt" />
        </div>
        <div class="inspector-field">
          <label for="pb-img-prop-caption">Caption</label>
          <input type="text" id="pb-img-prop-caption" data-prop="caption" />
        </div>
        <div class="inspector-field">
          <label for="pb-img-prop-link">Link URL</label>
          <input type="text" id="pb-img-prop-link" data-prop="link" placeholder="https://…" />
        </div>
        <div class="inspector-field">
          <label><input type="checkbox" data-prop="newtab" /> Open link in new tab</label>
        </div>
        <div class="inspector-field">
          <label for="pb-img-prop-layout">Layout</label>
          <select id="pb-img-prop-layout" data-prop="layout">
            ${LAYOUTS.map((l) => `<option value="${l.id}">${escapeHtml(l.label)}</option>`).join('')}
          </select>
        </div>
        <div class="inspector-field">
          <label for="pb-img-prop-width">Width</label>
          <select id="pb-img-prop-width" data-prop="width">
            <option value="sm">Small (33%)</option>
            <option value="md">Medium (50%)</option>
            <option value="lg">Large (75%)</option>
            <option value="full">Full</option>
          </select>
        </div>
        <div class="inspector-field">
          <label for="pb-img-prop-align">Alignment</label>
          <select id="pb-img-prop-align" data-prop="align">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div class="inspector-field">
          <label for="pb-img-prop-fit">Object fit</label>
          <select id="pb-img-prop-fit" data-prop="fit">
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </div>
        <div class="inspector-field">
          <label for="pb-img-prop-pos">Focal point</label>
          <select id="pb-img-prop-pos" data-prop="pos">
            <option value="center center">Center</option>
            <option value="top center">Top</option>
            <option value="bottom center">Bottom</option>
            <option value="center left">Left</option>
            <option value="center right">Right</option>
          </select>
        </div>
        <div class="pb-img-props-actions">
          <button type="button" class="btn btn-primary" data-prop-save>Apply</button>
          <button type="button" class="btn btn-secondary" data-prop-cancel>Cancel</button>
        </div>
      </div>
    `
    document.body.appendChild(propsModal)

    propsModal.addEventListener('click', (e) => {
      if (e.target === propsModal || e.target.closest('[data-prop-cancel]')) {
        hidePropsModal()
      }
    })

    propsModal.querySelector('[data-prop-pick]')?.addEventListener('click', () => {
      const input = propsModal.querySelector('[data-prop="url"]')
      showAssetPicker(
        (url) => {
          if (input) input.value = url
        },
        { defaultUrl: input?.value || 'assets/images/' },
      )
    })

    propsModal.querySelector('[data-prop-url-prompt]')?.addEventListener('click', () => {
      const input = propsModal.querySelector('[data-prop="url"]')
      const next = window.prompt('Image URL', input?.value || 'assets/images/')
      if (next != null && next.trim() && input) input.value = next.trim()
    })

    propsModal.querySelector('[data-prop-save]')?.addEventListener('click', () => {
      applyPropsFromModal()
    })

    return propsModal
  }

  function openPropsModal(figure) {
    const modal = ensurePropsModal()
    const img = getFigureImg(figure)
    const link = getLinkEl(figure)
    modal.querySelector('[data-prop="url"]').value = img?.getAttribute('src') || ''
    modal.querySelector('[data-prop="alt"]').value = img?.getAttribute('alt') || ''
    modal.querySelector('[data-prop="caption"]').value = figure.querySelector('figcaption')?.textContent || ''
    modal.querySelector('[data-prop="link"]').value = link?.getAttribute('href') || ''
    modal.querySelector('[data-prop="newtab"]').checked = link?.getAttribute('target') === '_blank'
    modal.querySelector('[data-prop="layout"]').value = getLayoutId(figure)
    modal.querySelector('[data-prop="width"]').value = getWidthId(figure)
    modal.querySelector('[data-prop="align"]').value = getAlignId(figure)
    modal.querySelector('[data-prop="fit"]').value =
      (figure.style.getPropertyValue('--pb-img-fit') || 'cover').trim() || 'cover'
    modal.querySelector('[data-prop="pos"]').value =
      (figure.style.getPropertyValue('--pb-img-pos') || 'center center').trim() || 'center center'
    modal.hidden = false
  }

  function applyPropsFromModal() {
    if (!activeFigure || !propsModal) return
    const figure = activeFigure
    const img = getFigureImg(figure)
    if (!img) return

    const url = propsModal.querySelector('[data-prop="url"]').value.trim()
    const alt = propsModal.querySelector('[data-prop="alt"]').value
    const caption = propsModal.querySelector('[data-prop="caption"]').value
    const link = propsModal.querySelector('[data-prop="link"]').value.trim()
    const newTab = propsModal.querySelector('[data-prop="newtab"]').checked
    const layout = propsModal.querySelector('[data-prop="layout"]').value
    const width = propsModal.querySelector('[data-prop="width"]').value
    const align = propsModal.querySelector('[data-prop="align"]').value
    const fit = propsModal.querySelector('[data-prop="fit"]').value
    const pos = propsModal.querySelector('[data-prop="pos"]').value

    if (url) img.setAttribute('src', url)
    img.setAttribute('alt', alt)
    setCaption(figure, caption)
    setImageLink(figure, link, newTab)
    setLayout(figure, layout)
    if (layout !== 'full' && layout !== 'parallax') setWidth(figure, width)
    setAlign(figure, align)
    figure.style.setProperty('--pb-img-fit', fit)
    figure.style.setProperty('--pb-img-pos', pos)
    syncParallaxBackground(figure)
    hidePropsModal()
    notifyChange()
  }

  function runImageAction(action, value) {
    if (!activeFigure) return
    const figure = activeFigure
    const img = getFigureImg(figure)
    hideMenu()

    if (action === 'layout') {
      setLayout(figure, value)
      notifyChange()
      return
    }
    if (action === 'replace') {
      showAssetPicker(
        (url) => {
          if (!url || !img) return
          img.setAttribute('src', url)
          syncParallaxBackground(figure)
          notifyChange()
        },
        { defaultUrl: img?.getAttribute('src') || 'assets/images/' },
      )
      return
    }
    if (action === 'alt') {
      const next = window.prompt('Alt text', img?.getAttribute('alt') || '')
      if (next == null || !img) return
      img.setAttribute('alt', next)
      notifyChange()
      return
    }
    if (action === 'caption') {
      const current = figure.querySelector('figcaption')?.textContent || ''
      const next = window.prompt('Caption (leave blank to remove)', current)
      if (next == null) return
      setCaption(figure, next)
      notifyChange()
      return
    }
    if (action === 'link') {
      const link = getLinkEl(figure)
      const next = window.prompt('Link URL (leave blank to remove)', link?.getAttribute('href') || '')
      if (next == null) return
      let newTab = link?.getAttribute('target') === '_blank'
      if (next.trim()) {
        newTab = window.confirm('Open link in a new tab?')
      }
      setImageLink(figure, next.trim(), newTab)
      notifyChange()
      return
    }
    if (action === 'props') {
      openPropsModal(figure)
      return
    }
    if (action === 'delete') {
      if (!window.confirm('Delete this image?')) return
      figure.remove()
      clearActiveBlock()
      clearSelectionOutline()
      notifyChange()
    }
  }

  function runButtonAction(action, value) {
    if (!activeCta) return
    const wrap = activeCta
    const link = getCtaLink(wrap)
    const keepMenuOpen = action === 'toggle-move' || action === 'move-up' || action === 'move-down'

    if (!keepMenuOpen) hideMenu()

    if (action === 'label') {
      const next = window.prompt('Button label', link?.textContent || '')
      if (next == null || !link) return
      const trimmed = next.trim()
      if (!trimmed) return
      link.textContent = trimmed
      notifyChange()
      return
    }
    if (action === 'url') {
      const next = window.prompt('Button URL', link?.getAttribute('href') || '#')
      if (next == null || !link) return
      link.setAttribute('href', next.trim() || '#')
      notifyChange()
      return
    }
    if (action === 'align') {
      setCtaAlign(wrap, value)
      notifyChange()
      return
    }
    if (action === 'toggle-move') {
      setCtaMovable(wrap, !isCtaMovable(wrap))
      notifyChange()
      const rect = menuEl?.getBoundingClientRect()
      const x = rect ? rect.left : 8
      const y = rect ? rect.top : 8
      showButtonMenu(x, y, wrap)
      return
    }
    if (action === 'move-up' || action === 'move-down') {
      if (!isCtaMovable(wrap)) return
      const moved = moveSiblingBlock(wrap, action === 'move-up' ? 'up' : 'down')
      if (moved) {
        notifyChange()
        const rect = menuEl?.getBoundingClientRect()
        const x = rect ? rect.left : 8
        const y = rect ? rect.top : 8
        showButtonMenu(x, y, wrap)
      }
      return
    }
    if (action === 'delete') {
      if (!window.confirm('Delete this button?')) return
      wrap.remove()
      clearActiveBlock()
      clearSelectionOutline()
      notifyChange()
    }
  }

  function runCalloutAction(action) {
    if (!activeCallout) return
    const el = activeCallout
    hideMenu()

    if (action === 'title') {
      const next = window.prompt('Callout title', getCalloutTitle(el))
      if (next == null) return
      setCalloutTitle(el, next.trim() || 'Note')
      notifyChange()
      return
    }
    if (action === 'body') {
      const next = window.prompt('Callout text', getCalloutBody(el))
      if (next == null) return
      setCalloutBody(el, next)
      notifyChange()
      return
    }
    if (action === 'delete') {
      if (!window.confirm('Delete this callout?')) return
      el.remove()
      clearActiveBlock()
      clearSelectionOutline()
      notifyChange()
    }
  }

  function runEmbedAction(action) {
    if (!activeEmbed) return
    const el = activeEmbed
    hideMenu()

    if (action === 'url') {
      const next = window.prompt('Embed URL or iframe HTML', getEmbedContentForEdit(el))
      if (next == null) return
      const trimmed = next.trim()
      if (!trimmed) return
      if (!setEmbedContent(el, trimmed)) return
      notifyChange()
      return
    }
    if (action === 'delete') {
      if (!window.confirm('Delete this embed?')) return
      el.remove()
      clearActiveBlock()
      clearSelectionOutline()
      notifyChange()
    }
  }

  function findFormBlock(target) {
    return target?.closest?.('.page-block-form[data-nrcga-form-mount]') || null
  }

  function getFormSlug(el) {
    return el?.getAttribute('data-nrcga-form-mount') || ''
  }

  function getFormTitle(el) {
    return el?.getAttribute('data-form-title') || getFormSlug(el)
  }

  function setFormInbox(el, slug, title) {
    el.setAttribute('data-nrcga-form-mount', slug)
    el.setAttribute('data-form-title', title || slug)
    el.innerHTML = `<p class="page-block-form-label">Form: ${escapeHtml(title || slug)}</p>`
  }

  function showFormMenu(x, y, el) {
    const menu = ensureMenu()
    const title = getFormTitle(el)
    menu.innerHTML = [
      `<div class="pb-img-menu-label">Form: ${escapeHtml(title)}</div>`,
      '<button type="button" role="menuitem" data-action="change">Change inbox…</button>',
      '<div class="pb-img-menu-sep"></div>',
      '<button type="button" role="menuitem" data-action="delete" class="is-danger">Delete</button>',
    ].join('')
    positionMenu(menu, x, y)
  }

  function runFormAction(action) {
    if (!activeForm) return
    const el = activeForm
    hideMenu()

    if (action === 'change') {
      const inboxes = parseFormInboxes(activeEditor?.closest('[data-rich-editor]'))
      showFormPicker(inboxes, (picked) => {
        setFormInbox(el, picked.slug, picked.title)
        notifyChange()
      })
      return
    }
    if (action === 'delete') {
      if (!window.confirm('Delete this form block?')) return
      el.remove()
      clearActiveBlock()
      clearSelectionOutline()
      notifyChange()
    }
  }

  function runGridAction(action, value) {
    if (!activeGrid) return
    const grid = activeGrid
    const keepMenuOpen = action === 'cols' || action === 'add-item' || action === 'remove-item'

    if (!keepMenuOpen) hideMenu()

    if (action === 'cols') {
      setGridCols(grid, value)
      notifyChange()
      const rect = menuEl?.getBoundingClientRect()
      showGridMenu(rect ? rect.left : 8, rect ? rect.top : 8, grid)
      return
    }
    if (action === 'edit-item') {
      const items = grid.querySelectorAll('.pb-grid-item')
      const item = items[Number(value)]
      if (!item) return
      const current = readGridItem(item)
      const icon = window.prompt('Item icon (emoji or leave blank)', current.icon)
      if (icon == null) return
      const title = window.prompt('Item title', current.title)
      if (title == null) return
      const body = window.prompt('Item description', current.body)
      if (body == null) return
      writeGridItem(item, { icon, title, body })
      notifyChange()
      return
    }
    if (action === 'add-item') {
      addGridItem(grid)
      notifyChange()
      const rect = menuEl?.getBoundingClientRect()
      showGridMenu(rect ? rect.left : 8, rect ? rect.top : 8, grid)
      return
    }
    if (action === 'remove-item') {
      const items = grid.querySelectorAll('.pb-grid-item')
      if (!items.length) return
      removeGridItemAt(grid, items.length - 1)
      notifyChange()
      const rect = menuEl?.getBoundingClientRect()
      showGridMenu(rect ? rect.left : 8, rect ? rect.top : 8, grid)
      return
    }
    if (action === 'delete') {
      if (!window.confirm('Delete this grid?')) return
      grid.remove()
      clearActiveBlock()
      clearSelectionOutline()
      notifyChange()
    }
  }

  function selectImage(figure, editor, sync) {
    ensureLayoutClass(figure)
    clearSelectionOutline()
    figure.classList.add('page-block-image--selected')
    clearActiveBlock()
    activeFigure = figure
    activeKind = 'image'
    activeEditor = editor
    activeSync = sync
  }

  function selectCta(wrap, editor, sync) {
    ensureCtaAttrs(wrap)
    clearSelectionOutline()
    wrap.classList.add('pb-cta-wrap--selected')
    clearActiveBlock()
    activeCta = wrap
    activeKind = 'button'
    activeEditor = editor
    activeSync = sync
  }

  function selectCallout(el, editor, sync) {
    clearSelectionOutline()
    el.classList.add('page-block-callout--selected')
    clearActiveBlock()
    activeCallout = el
    activeKind = 'callout'
    activeEditor = editor
    activeSync = sync
  }

  function selectEmbed(el, editor, sync) {
    clearSelectionOutline()
    el.classList.add('page-block-embed--selected')
    clearActiveBlock()
    activeEmbed = el
    activeKind = 'embed'
    activeEditor = editor
    activeSync = sync
  }

  function selectForm(el, editor, sync) {
    clearSelectionOutline()
    el.classList.add('page-block-form--selected')
    clearActiveBlock()
    activeForm = el
    activeKind = 'form'
    activeEditor = editor
    activeSync = sync
  }

  function selectGrid(el, editor, sync) {
    ensureGridAttrs(el)
    clearSelectionOutline()
    el.classList.add('pb-grid--selected')
    clearActiveBlock()
    activeGrid = el
    activeKind = 'grid'
    activeEditor = editor
    activeSync = sync
  }

  function resolveEditableBlock(target, editor) {
    if (!target || !editor) return null
    const figure = findFigure(target)
    if (figure && editor.contains(figure)) return { kind: 'image', el: figure }
    const wrap = findCta(target)
    if (wrap && editor.contains(wrap)) return { kind: 'button', el: wrap }
    const callout = findCallout(target)
    if (callout && editor.contains(callout)) return { kind: 'callout', el: callout }
    const embed = findEmbed(target)
    if (embed && editor.contains(embed)) return { kind: 'embed', el: embed }
    const form = findFormBlock(target)
    if (form && editor.contains(form)) return { kind: 'form', el: form }
    const grid = findGrid(target)
    if (grid && editor.contains(grid)) return { kind: 'grid', el: grid }
    return null
  }

  function selectByKind(kind, el, editor, sync) {
    if (kind === 'image') selectImage(el, editor, sync)
    else if (kind === 'button') selectCta(el, editor, sync)
    else if (kind === 'callout') selectCallout(el, editor, sync)
    else if (kind === 'embed') selectEmbed(el, editor, sync)
    else if (kind === 'form') selectForm(el, editor, sync)
    else if (kind === 'grid') selectGrid(el, editor, sync)
  }

  function showMenuForKind(kind, el, x, y) {
    if (kind === 'image') showMenu(x, y, el)
    else if (kind === 'button') showButtonMenu(x, y, el)
    else if (kind === 'callout') showCalloutMenu(x, y)
    else if (kind === 'embed') showEmbedMenu(x, y)
    else if (kind === 'form') showFormMenu(x, y, el)
    else if (kind === 'grid') showGridMenu(x, y, el)
  }

  function bindBlockEditing(editor, sync) {
    editor.addEventListener('contextmenu', (e) => {
      const hit = resolveEditableBlock(e.target, editor)
      if (!hit) return
      e.preventDefault()
      selectByKind(hit.kind, hit.el, editor, sync)
      showMenuForKind(hit.kind, hit.el, e.clientX, e.clientY)
    })

    editor.addEventListener('click', (e) => {
      const hit = resolveEditableBlock(e.target, editor)
      if (hit && (hit.kind === 'button' || hit.kind === 'embed' || hit.kind === 'form')) {
        e.preventDefault()
      }
      clearSelectionOutline()
      if (hit) {
        selectByKind(hit.kind, hit.el, editor, sync)
      } else if (!menuEl || menuEl.hidden) {
        clearActiveBlock()
      }
    })

    editor.querySelectorAll('figure.page-block-image').forEach(ensureLayoutClass)
    editor.querySelectorAll('.pb-cta-wrap').forEach(ensureCtaAttrs)
    editor.querySelectorAll('.pb-grid').forEach(ensureGridAttrs)
  }

  function handleInsert(editor, kind) {
    if (kind === 'image') {
      showAssetPicker((url) => {
        if (!url) return
        const alt = window.prompt('Alt text', '') || ''
        insertHtmlAtCursor(
          editor,
          `<figure class="page-block-image pb-img-full pb-img-align-center pb-img-layout-inline" data-img-layout="inline"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" /></figure>`,
        )
        editor.dispatchEvent(new Event('input', { bubbles: true }))
      })
      return
    }
    if (kind === 'button') {
      const label = window.prompt('Button label', 'Learn more')
      if (!label) return
      const url = window.prompt('Button URL', '#') || '#'
      insertHtmlAtCursor(
        editor,
        `<p class="pb-cta-wrap pb-align-left" data-cta-movable="1"><a href="${escapeHtml(url)}" class="btn btn-primary">${escapeHtml(label)}</a></p>`,
      )
      return
    }
    if (kind === 'callout') {
      const title = window.prompt('Callout title', 'Note') || 'Note'
      const body = window.prompt('Callout text', 'Important information.') || ''
      insertHtmlAtCursor(
        editor,
        `<div class="page-block-callout"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>`,
      )
      return
    }
    if (kind === 'embed') {
      const input = window.prompt('Embed URL or iframe HTML', '')
      if (!input) return
      const parsed = parseEmbedInput(input)
      if (!parsed) return
      insertHtmlAtCursor(editor, buildEmbedBlockHtml(parsed))
      return
    }
    if (kind === 'form') {
      const host = editor.closest('[data-rich-editor]')
      const inboxes = parseFormInboxes(host)
      showFormPicker(inboxes, (picked) => {
        insertHtmlAtCursor(editor, createFormBlockHtml(picked.slug, picked.title))
        editor.dispatchEvent(new Event('input', { bubbles: true }))
      })
      return
    }
    if (kind === 'grid') {
      const items = [
        { icon: '✓', title: 'Item one', body: 'Description here.' },
        { icon: '✓', title: 'Item two', body: 'Description here.' },
        { icon: '✓', title: 'Item three', body: 'Description here.' },
      ]
      insertHtmlAtCursor(
        editor,
        `<div class="pb-grid pb-grid-cols-3">${items.map(createGridItemHtml).join('')}</div>`,
      )
      return
    }
    if (kind === 'spacer') {
      insertHtmlAtCursor(editor, '<div class="pb-spacer pb-spacer-md"></div>')
    }
  }

  function mountEditor(host) {
    if (!host || host.dataset.richMounted === '1') return
    const fieldId = host.getAttribute('data-field')
    const field = fieldId ? document.getElementById(fieldId) : null
    if (!field) return

    const includeBlocks = host.getAttribute('data-blocks') !== '0'
    const formInboxes = parseFormInboxes(host)
    if (formInboxes.length) {
      host.setAttribute('data-form-inboxes', JSON.stringify(formInboxes))
    }
    let initial = host.getAttribute('data-initial')
    if (initial == null || initial === '') {
      initial = field.value || ''
    }
    if (!initial && host.getAttribute('data-fallback-json')) {
      initial = blocksJsonToHtml(host.getAttribute('data-fallback-json'))
      if (initial) field.value = initial
    }

    const toolbar = buildToolbar(includeBlocks)
    const editor = document.createElement('div')
    editor.className = 'tiptap-surface'
    editor.contentEditable = 'true'
    editor.innerHTML = initial

    host.appendChild(toolbar)
    host.appendChild(editor)
    host.dataset.richMounted = '1'

    const sync = () => {
      field.value = editor.innerHTML
    }

    toolbar.addEventListener('click', (e) => {
      const insertBtn = e.target.closest('button[data-insert]')
      if (insertBtn) {
        e.preventDefault()
        handleInsert(editor, insertBtn.getAttribute('data-insert'))
        sync()
        return
      }
      const btn = e.target.closest('button[data-cmd]')
      if (!btn) return
      e.preventDefault()
      editor.focus()
      const cmd = btn.getAttribute('data-cmd')
      const value = btn.getAttribute('data-value')
      if (cmd === 'createLink') {
        const url = window.prompt('Link URL')
        if (url) document.execCommand('createLink', false, url)
        sync()
        return
      }
      if (cmd === 'formatBlock' && value) {
        document.execCommand('formatBlock', false, value)
        sync()
        return
      }
      document.execCommand(cmd, false)
      sync()
    })

    toolbar.addEventListener('change', (e) => {
      const select = e.target.closest('select[data-style]')
      if (!select) return
      const styleKind = select.getAttribute('data-style')
      const className = select.value
      if (!className) return
      applyInlineClass(editor, styleKind, className)
      select.selectedIndex = 0
      sync()
    })

    const form = host.closest('form') || document.getElementById(host.getAttribute('data-form') || '')
    if (form) {
      form.addEventListener('submit', sync)
    }
    editor.addEventListener('input', sync)
    editor.addEventListener('paste', (e) => {
      const text = e.clipboardData?.getData('text/plain') || ''
      if (!/<iframe[\s>]/i.test(text)) return
      const parsed = parseEmbedInput(text)
      if (!parsed) return
      e.preventDefault()
      insertHtmlAtCursor(editor, buildEmbedBlockHtml(parsed))
      sync()
    })
    bindBlockEditing(editor, sync)
  }

  function boot() {
    // Legacy post form host
    const legacy = document.getElementById('tiptap-editor')
    if (legacy && !legacy.hasAttribute('data-rich-editor')) {
      legacy.setAttribute('data-rich-editor', '')
      legacy.setAttribute('data-field', 'body_html')
      if (!legacy.getAttribute('data-blocks')) legacy.setAttribute('data-blocks', '0')
      const form = document.getElementById('post-form')
      if (form) legacy.setAttribute('data-form', 'post-form')
    }

    document.querySelectorAll('[data-rich-editor]').forEach(mountEditor)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
