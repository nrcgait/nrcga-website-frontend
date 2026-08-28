;(function () {
  const MAX_FILES = 10
  const PHOTO_MAX_BYTES = 5 * 1024 * 1024
  const PDF_MAX_BYTES = 25 * 1024 * 1024
  const PAGE_SIZE = 25

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function isPdf(file) {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
  }

  function isImage(file) {
    return (file.type || '').startsWith('image/') || /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i.test(file.name || '')
  }

  function isSvg(file) {
    return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '')
  }

  async function canvasToBlob(canvas, type, quality) {
    if (canvas.convertToBlob) {
      return canvas.convertToBlob({ type, quality })
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not compress image'))),
        type,
        quality,
      )
    })
  }

  async function downsizePhoto(file, maxBytes) {
    if (!isImage(file) || isSvg(file) || file.size <= maxBytes) return file
    if (typeof createImageBitmap !== 'function') {
      throw new Error(`${file.name}: exceeds ${formatBytes(maxBytes)} and cannot be resized in this browser`)
    }

    const bitmap = await createImageBitmap(file)
    let width = bitmap.width
    let height = bitmap.height
    let quality = 0.9
    let best = null

    try {
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const w = Math.max(1, width)
        const h = Math.max(1, height)
        let blob
        if (typeof OffscreenCanvas !== 'undefined') {
          const canvas = new OffscreenCanvas(w, h)
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error(`${file.name}: could not prepare image for resize`)
          ctx.drawImage(bitmap, 0, 0, w, h)
          blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
        } else {
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error(`${file.name}: could not prepare image for resize`)
          ctx.drawImage(bitmap, 0, 0, w, h)
          blob = await canvasToBlob(canvas, 'image/jpeg', quality)
        }
        best = blob
        if (blob.size <= maxBytes) break
        if (quality > 0.55) {
          quality = Math.max(0.5, quality - 0.1)
        } else {
          width = Math.floor(width * 0.8)
          height = Math.floor(height * 0.8)
          quality = 0.85
        }
        if (width < 320 || height < 320) break
      }
    } finally {
      bitmap.close?.()
    }

    if (!best || best.size > maxBytes) {
      throw new Error(`${file.name}: could not downsize under ${formatBytes(maxBytes)}`)
    }

    const base = (file.name || 'photo').replace(/\.[^.]+$/, '')
    return new File([best], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  }

  async function prepareUploadFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) throw new Error('No files selected')
    if (files.length > MAX_FILES) throw new Error(`You can upload at most ${MAX_FILES} files at once`)

    const prepared = []
    for (const file of files) {
      if (isPdf(file)) {
        if (file.size > PDF_MAX_BYTES) {
          throw new Error(`${file.name}: PDFs must be ${formatBytes(PDF_MAX_BYTES)} or smaller`)
        }
        prepared.push(file)
        continue
      }
      if (!isImage(file)) {
        throw new Error(`${file.name}: only images and PDFs are allowed`)
      }
      prepared.push(await downsizePhoto(file, PHOTO_MAX_BYTES))
    }
    return prepared
  }

  function ensureModal() {
    let modal = document.getElementById('nrcga-asset-picker-modal')
    if (modal) return modal
    modal = document.createElement('div')
    modal.id = 'nrcga-asset-picker-modal'
    modal.className = 'page-asset-modal'
    modal.hidden = true
    modal.innerHTML = `
      <div class="page-asset-modal-content asset-picker-modal-content" role="dialog" aria-modal="true" aria-label="Choose from assets">
        <div class="asset-picker-header">
          <h4>Choose from assets</h4>
          <div class="asset-picker-toolbar">
            <label class="asset-picker-sort">
              Sort
              <select data-asset-picker-sort>
                <option value="date">Date uploaded</option>
                <option value="name">A–Z</option>
              </select>
            </label>
          </div>
        </div>
        <div class="page-asset-list" data-asset-picker-list>Loading…</div>
        <div class="asset-picker-footer">
          <div class="asset-picker-pagination" data-asset-picker-pagination></div>
          <div class="pb-img-props-actions">
            <button type="button" class="btn btn-secondary" data-asset-picker-url>Enter URL…</button>
            <button type="button" class="btn btn-secondary" data-close-asset-modal>Cancel</button>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(modal)
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close-asset-modal]')) {
        modal.hidden = true
      }
    })
    return modal
  }

  function openAssetPicker(callback, options) {
    const opts = options || {}
    const imagesOnly = opts.imagesOnly !== false
    const modal = ensureModal()
    const list = modal.querySelector('[data-asset-picker-list]')
    const pagination = modal.querySelector('[data-asset-picker-pagination]')
    const sortSelect = modal.querySelector('[data-asset-picker-sort]')
    let page = 1
    let sort = opts.sort === 'name' ? 'name' : 'date'
    if (sortSelect) sortSelect.value = sort

    modal.hidden = false

    const urlBtn = modal.querySelector('[data-asset-picker-url]')
    if (urlBtn) {
      urlBtn.onclick = () => {
        modal.hidden = true
        const next = window.prompt('Image URL', opts.defaultUrl || '')
        if (next == null || !String(next).trim()) return
        callback(String(next).trim(), { key: '', url: String(next).trim() })
      }
    }

    function renderPagination(data) {
      if (!pagination) return
      if (!data.total || data.totalPages <= 1) {
        pagination.innerHTML = data.total
          ? `<span class="muted">${data.total} item${data.total === 1 ? '' : 's'}</span>`
          : ''
        return
      }
      pagination.innerHTML = `
        <span class="muted">Page ${data.page} of ${data.totalPages} · ${data.total} total</span>
        <div class="asset-picker-pagination-links">
          <button type="button" class="btn btn-secondary btn-sm" data-asset-page="prev" ${data.page <= 1 ? 'disabled' : ''}>Previous</button>
          <button type="button" class="btn btn-secondary btn-sm" data-asset-page="next" ${data.page >= data.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      `
      pagination.querySelector('[data-asset-page="prev"]')?.addEventListener('click', () => {
        if (page > 1) {
          page -= 1
          load()
        }
      })
      pagination.querySelector('[data-asset-page="next"]')?.addEventListener('click', () => {
        if (page < data.totalPages) {
          page += 1
          load()
        }
      })
    }

    function load() {
      list.innerHTML = 'Loading…'
      const params = new URLSearchParams({
        page: String(page),
        sort,
        pageSize: String(PAGE_SIZE),
      })
      if (imagesOnly) params.set('type', 'image')
      fetch(`/admin/api/assets?${params}`)
        .then((r) => {
          if (!r.ok) throw new Error('Failed to load assets')
          return r.json()
        })
        .then((data) => {
          const assets = data.assets || []
          renderPagination(data)
          if (!assets.length) {
            list.innerHTML =
              '<p class="inspector-hint">No assets uploaded yet. <a href="/admin/assets" target="_blank" rel="noopener">Upload in Assets</a></p>'
            return
          }
          list.innerHTML = assets
            .map(
              (a) =>
                `<button type="button" class="page-asset-item" data-asset-url="${escapeHtml(a.url)}" data-asset-key="${escapeHtml(a.key)}" title="${escapeHtml(a.name)}"><img src="${escapeHtml(a.url)}" alt="" loading="lazy" /><span>${escapeHtml(a.name)}</span></button>`,
            )
            .join('')
          list.querySelectorAll('[data-asset-url]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const url = btn.getAttribute('data-asset-url') || ''
              const key = btn.getAttribute('data-asset-key') || ''
              callback(url, { key, url, name: btn.getAttribute('title') || '' })
              modal.hidden = true
            })
          })
        })
        .catch(() => {
          list.innerHTML =
            '<p class="inspector-hint">Could not load assets. Use Enter URL instead, or open <a href="/admin/assets" target="_blank" rel="noopener">Assets</a>.</p>'
          if (pagination) pagination.innerHTML = ''
        })
    }

    if (sortSelect) {
      sortSelect.onchange = () => {
        sort = sortSelect.value === 'name' ? 'name' : 'date'
        page = 1
        load()
      }
    }

    load()
  }

  function initAssetUrlFields(root) {
    const scope = root || document
    scope.querySelectorAll('[data-asset-url-field]').forEach((field) => {
      if (field.dataset.assetBound === '1') return
      field.dataset.assetBound = '1'
      const input = field.querySelector('[data-asset-url-input]')
      const r2Input = field.querySelector('[data-asset-r2-input]')
      const pickBtn = field.querySelector('[data-asset-pick]')
      if (!input || !pickBtn) return
      pickBtn.addEventListener('click', () => {
        openAssetPicker(
          (url, meta) => {
            field.dataset.assetPicking = '1'
            input.value = url
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
            if (r2Input) {
              r2Input.value = meta?.key || ''
              r2Input.dispatchEvent(new Event('input', { bubbles: true }))
              r2Input.dispatchEvent(new Event('change', { bubbles: true }))
            }
            delete field.dataset.assetPicking
          },
          { defaultUrl: input.value || '', imagesOnly: true },
        )
      })
      if (r2Input) {
        input.addEventListener('input', () => {
          if (field.dataset.assetPicking === '1') return
          r2Input.value = ''
        })
      }
    })
  }

  function setUploadStatus(el, message, isError) {
    if (!el) return
    if (!message) {
      el.hidden = true
      el.textContent = ''
      el.classList.remove('error')
      return
    }
    el.hidden = false
    el.textContent = message
    el.classList.toggle('error', !!isError)
  }

  function initAssetsUploadForms(root) {
    const scope = root || document
    scope.querySelectorAll('[data-assets-upload-form]').forEach((form) => {
      if (form.dataset.assetBound === '1') return
      form.dataset.assetBound = '1'
      const input = form.querySelector('[data-assets-upload-input]')
      const status = form.querySelector('[data-assets-upload-status]')
      const submit = form.querySelector('[data-assets-upload-submit]')
      if (!input) return

      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        setUploadStatus(status, 'Preparing files…', false)
        if (submit) submit.disabled = true
        try {
          const prepared = await prepareUploadFiles(input.files)
          setUploadStatus(status, `Uploading ${prepared.length} file${prepared.length === 1 ? '' : 's'}…`, false)
          const body = new FormData()
          prepared.forEach((file) => body.append('files', file, file.name))
          const res = await fetch(form.getAttribute('action') || '/admin/assets/upload', {
            method: 'POST',
            body,
            redirect: 'follow',
          })
          if (res.redirected) {
            window.location.href = res.url
            return
          }
          if (!res.ok) {
            const text = await res.text()
            throw new Error(text || 'Upload failed')
          }
          window.location.href = '/admin/assets'
        } catch (err) {
          setUploadStatus(status, err instanceof Error ? err.message : 'Upload failed', true)
        } finally {
          if (submit) submit.disabled = false
        }
      })
    })
  }

  function initAll(root) {
    initAssetUrlFields(root)
    initAssetsUploadForms(root)
  }

  window.NrcgaAssetPicker = {
    open: openAssetPicker,
    prepareUploadFiles,
    init: initAll,
    MAX_FILES,
    PHOTO_MAX_BYTES,
    PDF_MAX_BYTES,
    PAGE_SIZE,
  }

  document.addEventListener('DOMContentLoaded', () => initAll())
})()
