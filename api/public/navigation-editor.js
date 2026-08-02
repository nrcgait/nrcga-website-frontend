document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('navigation-editor')
  const output = document.getElementById('navigation_json')
  if (!root || !output) return

  let config
  try {
    config = JSON.parse(root.getAttribute('data-nav') || '{}')
  } catch {
    config = { logo: {}, menuItems: [] }
  }
  if (!config.logo) config.logo = {}
  if (!Array.isArray(config.menuItems)) config.menuItems = []

  render()
  syncOutput()

  root.addEventListener('click', (e) => {
    const target = e.target
    if (!(target instanceof HTMLElement)) return

    if (target.matches('[data-add-link]')) {
      config.menuItems.push({ type: 'link', text: '', href: '' })
      render()
      syncOutput()
    }
    if (target.matches('[data-add-dropdown]')) {
      config.menuItems.push({ type: 'dropdown', text: '', href: '', items: [] })
      render()
      syncOutput()
    }
    if (target.matches('[data-remove-item]')) {
      const idx = Number(target.getAttribute('data-remove-item'))
      config.menuItems.splice(idx, 1)
      render()
      syncOutput()
    }
    if (target.matches('[data-move-up]')) {
      const idx = Number(target.getAttribute('data-move-up'))
      if (idx > 0) {
        ;[config.menuItems[idx - 1], config.menuItems[idx]] = [config.menuItems[idx], config.menuItems[idx - 1]]
        render()
        syncOutput()
      }
    }
    if (target.matches('[data-move-down]')) {
      const idx = Number(target.getAttribute('data-move-down'))
      if (idx < config.menuItems.length - 1) {
        ;[config.menuItems[idx + 1], config.menuItems[idx]] = [config.menuItems[idx], config.menuItems[idx + 1]]
        render()
        syncOutput()
      }
    }
    if (target.matches('[data-add-subitem]')) {
      const idx = Number(target.getAttribute('data-add-subitem'))
      const item = config.menuItems[idx]
      if (!item.items) item.items = []
      item.items.push({ text: '', href: '' })
      render()
      syncOutput()
    }
    if (target.matches('[data-remove-subitem]')) {
      const [itemIdx, subIdx] = target.getAttribute('data-remove-subitem').split(':').map(Number)
      config.menuItems[itemIdx].items.splice(subIdx, 1)
      render()
      syncOutput()
    }
    if (target.matches('[data-pick-logo-asset]')) {
      const input = root.querySelector('[data-field="logo.image"]')
      if (!window.NrcgaAssetPicker?.open) return
      window.NrcgaAssetPicker.open(
        (url) => {
          config.logo.image = url
          if (input instanceof HTMLInputElement) input.value = url
          syncOutput()
        },
        { defaultUrl: config.logo.image || '', imagesOnly: true },
      )
    }
  })

  root.addEventListener('input', (e) => {
    const target = e.target
    if (!(target instanceof HTMLElement)) return
    const field = target.getAttribute('data-field')
    if (!field) return

    if (field.startsWith('logo.')) {
      const key = field.slice(5)
      config.logo[key] = target instanceof HTMLInputElement ? target.value : ''
    } else if (field.startsWith('item.')) {
      const [, idx, key] = field.split('.')
      const item = config.menuItems[Number(idx)]
      if (!item) return
      if (key === 'type') {
        item.type = target instanceof HTMLSelectElement ? target.value : 'link'
        if (item.type === 'dropdown' && !item.items) item.items = []
      } else if (key === 'external') {
        item.external = target instanceof HTMLInputElement ? target.checked : false
      } else {
        item[key] = target instanceof HTMLInputElement ? target.value : ''
      }
    } else if (field.startsWith('subitem.')) {
      const [, itemIdx, subIdx, key] = field.split('.')
      const sub = config.menuItems[Number(itemIdx)]?.items?.[Number(subIdx)]
      if (!sub) return
      if (key === 'external') {
        sub.external = target instanceof HTMLInputElement ? target.checked : false
      } else {
        sub[key] = target instanceof HTMLInputElement ? target.value : ''
      }
    }
    syncOutput()
  })

  function render() {
    root.innerHTML = `
      <section class="nav-editor-section">
        <h3>Logo</h3>
        <label>Image path
          <div class="asset-url-row">
            <input data-field="logo.image" value="${esc(config.logo.image || '')}" />
            <button type="button" class="btn btn-secondary" data-pick-logo-asset>Choose from assets</button>
          </div>
        </label>
        <label>Alt text<input data-field="logo.alt" value="${esc(config.logo.alt || '')}" /></label>
        <label>Text<input data-field="logo.text" value="${esc(config.logo.text || '')}" /></label>
        <label>Link<input data-field="logo.link" value="${esc(config.logo.link || '')}" /></label>
      </section>
      <section class="nav-editor-section">
        <div class="nav-editor-toolbar">
          <h3>Menu items</h3>
          <button type="button" class="btn btn-secondary" data-add-link>+ Link</button>
          <button type="button" class="btn btn-secondary" data-add-dropdown>+ Dropdown</button>
        </div>
        ${config.menuItems
          .map((item, idx) => renderMenuItem(item, idx))
          .join('')}
      </section>
    `
  }

  function renderMenuItem(item, idx) {
    const subs = (item.items || [])
      .map(
        (sub, subIdx) => `
        <div class="nav-subitem">
          <input data-field="subitem.${idx}.${subIdx}.text" placeholder="Text" value="${esc(sub.text || '')}" />
          <input data-field="subitem.${idx}.${subIdx}.href" placeholder="URL" value="${esc(sub.href || '')}" />
          <label><input type="checkbox" data-field="subitem.${idx}.${subIdx}.external" ${sub.external ? 'checked' : ''} /> External</label>
          <button type="button" class="btn btn-secondary" data-remove-subitem="${idx}:${subIdx}">Remove</button>
        </div>`,
      )
      .join('')

    return `
      <div class="nav-menu-item">
        <div class="nav-menu-item-header">
          <strong>Item ${idx + 1}</strong>
          <button type="button" class="btn btn-secondary" data-move-up="${idx}">↑</button>
          <button type="button" class="btn btn-secondary" data-move-down="${idx}">↓</button>
          <button type="button" class="btn btn-danger" data-remove-item="${idx}">Remove</button>
        </div>
        <label>Type
          <select data-field="item.${idx}.type">
            <option value="link" ${item.type === 'link' ? 'selected' : ''}>Link</option>
            <option value="dropdown" ${item.type === 'dropdown' ? 'selected' : ''}>Dropdown</option>
          </select>
        </label>
        <label>Text<input data-field="item.${idx}.text" value="${esc(item.text || '')}" /></label>
        <label>URL<input data-field="item.${idx}.href" value="${esc(item.href || '')}" /></label>
        <label><input type="checkbox" data-field="item.${idx}.external" ${item.external ? 'checked' : ''} /> External link</label>
        ${
          item.type === 'dropdown'
            ? `<div class="nav-subitems">
                <p><strong>Dropdown items</strong></p>
                ${subs}
                <button type="button" class="btn btn-secondary" data-add-subitem="${idx}">+ Sub-item</button>
              </div>`
            : ''
        }
      </div>
    `
  }

  function syncOutput() {
    output.value = JSON.stringify(config, null, 2)
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
  }
})
