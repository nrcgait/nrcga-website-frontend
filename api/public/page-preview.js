// Live preview with click-to-edit block selection.
;(function () {
  const editor = document.querySelector('.admin-page-editor-visual')
  const form = document.getElementById('page-form')
  const frame = document.getElementById('page-preview-frame')
  if (!editor || !form || !frame || !window.NRCGA_pageBlocks) return

  const siteOrigin = editor.dataset.publicSiteOrigin || ''
  const liveLink = document.getElementById('page-live-link')
  const refreshButton = document.getElementById('page-preview-refresh')
  const openTabButton = document.getElementById('page-preview-open-tab')
  let debounceTimer = null
  let lastPreviewHtml = ''
  let selectedPath = null

  function readPageFromForm() {
    const data = new FormData(form)
    return {
      slug: String(data.get('slug') || '').trim(),
      title: String(data.get('title') || '').trim(),
      section_label: String(data.get('section_label') || '').trim(),
      subtitle: String(data.get('subtitle') || '').trim(),
      body_json: String(data.get('body_json') || '[]'),
    }
  }

  function updateLiveLink(slug) {
    if (!liveLink) return
    if (!slug) {
      liveLink.hidden = true
      liveLink.removeAttribute('href')
      return
    }
    const origin = siteOrigin.replace(/\/$/, '')
    liveLink.href = `${origin}/${encodeURIComponent(slug)}.html`
    liveLink.hidden = false
  }

  function attachPreviewHandlers() {
    const doc = frame.contentDocument
    if (!doc) return

    doc.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const blockEl = target.closest('[data-block-path]')
      if (!blockEl) return
      event.preventDefault()
      event.stopPropagation()
      const path = blockEl.getAttribute('data-block-path')
      if (!path) return
      selectBlock(path, doc)
      window.NRCGA_pageEditor?.selectBlock(path)
    })
  }

  function selectBlock(path, doc) {
    selectedPath = path
    const documentRef = doc || frame.contentDocument
    if (!documentRef) return
    documentRef.querySelectorAll('.page-block--selected').forEach((el) => {
      el.classList.remove('page-block--selected')
    })
    const el = documentRef.querySelector(`[data-block-path="${CSS.escape(path)}"]`)
    if (el) el.classList.add('page-block--selected')
  }

  function renderPreview() {
    const page = readPageFromForm()
    updateLiveLink(page.slug)

    const html = window.NRCGA_pageBlocks.buildPreviewDocument(page, siteOrigin, true)
    lastPreviewHtml = html
    frame.src = 'about:blank'
    frame.srcdoc = html

    frame.onload = () => {
      attachPreviewHandlers()
      if (selectedPath) selectBlock(selectedPath)
    }
  }

  function schedulePreview() {
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(renderPreview, 200)
  }

  window.NRCGA_pagePreview = {
    refresh: renderPreview,
    scheduleRefresh: schedulePreview,
    selectBlock,
    getSelectedPath: () => selectedPath,
  }

  form.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'body_json') return
    schedulePreview()
  })
  form.addEventListener('change', schedulePreview)

  refreshButton?.addEventListener('click', (event) => {
    event.preventDefault()
    renderPreview()
  })

  openTabButton?.addEventListener('click', (event) => {
    event.preventDefault()
    if (!lastPreviewHtml) renderPreview()
    if (!lastPreviewHtml) return
    const page = readPageFromForm()
    const html = window.NRCGA_pageBlocks.buildPreviewDocument(page, siteOrigin, false)
    const previewWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!previewWindow) return
    previewWindow.document.open()
    previewWindow.document.write(html)
    previewWindow.document.close()
  })

  renderPreview()
})()
