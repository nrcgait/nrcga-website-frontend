// Block inspector panel — per-block form controls for the visual page editor.
;(function () {
  const panel = document.getElementById('page-inspector-panel')
  if (!panel || !window.NRCGA_pageBlocks || !window.NRCGA_pageEditor) return

  const pb = window.NRCGA_pageBlocks
  const editor = window.NRCGA_pageEditor

  function field(label, html) {
    return `<div class="inspector-field"><label>${label}</label>${html}</div>`
  }

  function selectField(label, key, value, options) {
    const opts = options
      .map((o) => `<option value="${o.value}"${o.value === value ? ' selected' : ''}>${o.label}</option>`)
      .join('')
    return field(label, `<select data-key="${key}">${opts}</select>`)
  }

  function textField(label, key, value, multiline) {
    if (multiline) {
      return field(label, `<textarea data-key="${key}" rows="4">${pb.escapeHtml(value || '')}</textarea>`)
    }
    return field(label, `<input type="text" data-key="${key}" value="${pb.escapeHtml(value || '')}" />`)
  }

  function styleFields(style) {
    const s = style || {}
    return (
      selectField('Alignment', 'style.align', s.align || 'left', [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ]) +
      selectField('Font', 'style.font', s.font || 'default', [
        { value: 'default', label: 'Default (Inter)' },
        { value: 'sans', label: 'Source Sans' },
        { value: 'serif', label: 'Source Serif' },
        { value: 'display', label: 'Barlow' },
        { value: 'mono', label: 'Mono' },
      ]) +
      selectField('Font size', 'style.textSize', s.textSize || 'md', [
        { value: 'sm', label: 'Small' },
        { value: 'md', label: 'Normal' },
        { value: 'lg', label: 'Large' },
        { value: 'xl', label: 'Extra large' },
        { value: '2xl', label: 'Display' },
      ]) +
      selectField('Text color', 'style.textColor', s.textColor || 'default', [
        { value: 'default', label: 'Default' },
        { value: 'primary', label: 'Primary blue' },
        { value: 'secondary', label: 'Green' },
        { value: 'accent', label: 'Orange' },
        { value: 'navy', label: 'Navy' },
        { value: 'dark', label: 'Dark gray' },
        { value: 'muted', label: 'Muted' },
        { value: 'warning', label: 'Warning' },
        { value: 'danger', label: 'Danger' },
        { value: 'white', label: 'White' },
      ])
    )
  }

  function gapField(value) {
    return selectField('Spacing', 'gap', value || 'md', [
      { value: 'sm', label: 'Tight' },
      { value: 'md', label: 'Normal' },
      { value: 'lg', label: 'Loose' },
    ])
  }

  function buildInspectorHtml(block, path) {
    const typeLabel = pb.BLOCK_LABELS[block.type] || block.type
    let fields = ''

    switch (block.type) {
      case 'section':
        fields =
          selectField('Background', 'bg', block.bg || 'default', [
            { value: 'default', label: 'Default' },
            { value: 'light', label: 'Light gray' },
          ]) +
          selectField('Padding', 'padding', block.padding || 'md', [
            { value: 'sm', label: 'Tight' },
            { value: 'md', label: 'Normal' },
            { value: 'lg', label: 'Loose' },
          ]) +
          '<p class="inspector-hint">Add blocks inside this section using the Add block menu while this section is selected.</p>'
        break
      case 'heading':
        fields =
          textField('Heading text', 'text', block.text) +
          selectField('Level', 'level', String(block.level || 2), [
            { value: '2', label: 'Large (H2)' },
            { value: '3', label: 'Medium (H3)' },
            { value: '4', label: 'Small (H4)' },
          ]) +
          styleFields(block.style)
        break
      case 'text':
        fields = textField('Text', 'body', block.body, true) + styleFields(block.style)
        break
      case 'image':
        fields =
          textField('Image URL', 'url', block.url) +
          `<div class="inspector-field"><button type="button" class="btn btn-secondary btn-sm" data-pick-asset>Choose from assets</button></div>` +
          textField('Alt text', 'alt', block.alt) +
          textField('Caption', 'caption', block.caption) +
          selectField('Width', 'width', block.width || 'full', [
            { value: 'sm', label: 'Small (33%)' },
            { value: 'md', label: 'Medium (50%)' },
            { value: 'lg', label: 'Large (75%)' },
            { value: 'full', label: 'Full width' },
          ]) +
          selectField('Alignment', 'align', block.align || 'center', [
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ])
        break
      case 'columns':
        fields =
          selectField('Columns', 'cols', String(block.cols || 2), [
            { value: '2', label: '2 columns' },
            { value: '3', label: '3 columns' },
          ]) +
          gapField(block.gap) +
          '<p class="inspector-hint">Select this block, then add Heading or Text blocks to fill each column.</p>'
        break
      case 'grid':
        fields =
          selectField('Grid columns', 'columns', String(block.columns || 3), [
            { value: '2', label: '2 columns' },
            { value: '3', label: '3 columns' },
            { value: '4', label: '4 columns' },
          ]) +
          gapField(block.gap) +
          '<div class="inspector-grid-items" data-grid-items>' +
          (block.items || [])
            .map(
              (item, i) =>
                `<div class="inspector-grid-item" data-grid-index="${i}">${textField('Icon', `items.${i}.icon`, item.icon)}${textField('Title', `items.${i}.title`, item.title)}${textField('Description', `items.${i}.body`, item.body, true)}<button type="button" class="btn btn-secondary btn-sm" data-remove-grid-item="${i}">Remove item</button></div>`,
            )
            .join('') +
          '</div><button type="button" class="btn btn-secondary btn-sm" data-add-grid-item>+ Add grid item</button>'
        break
      case 'spacer':
        fields = selectField('Size', 'size', block.size || 'md', [
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' },
        ])
        break
      case 'callout':
        fields = textField('Title', 'title', block.title) + textField('Body', 'body', block.body, true)
        break
      case 'cta_button':
        fields =
          textField('Button label', 'label', block.label) +
          textField('Link URL', 'url', block.url) +
          selectField('Alignment', 'style.align', block.style?.align || 'left', [
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ])
        break
      case 'winner_card':
        fields =
          textField('Winner name', 'winner_name', block.winner_name) +
          textField('Year label', 'year_label', block.year_label) +
          textField('Celebration date', 'celebration_date', block.celebration_date) +
          textField('Image URL', 'image_url', block.image_url) +
          `<div class="inspector-field"><button type="button" class="btn btn-secondary btn-sm" data-pick-asset-image-url>Choose from assets</button></div>`
        break
      case 'hall_of_fame_grid':
        fields =
          '<div data-hof-items>' +
          (block.items || [])
            .map(
              (item, i) =>
                `<div class="inspector-grid-item">${textField('Name', `items.${i}.name`, item.name)}${textField('Year', `items.${i}.year`, item.year)}<button type="button" class="btn btn-secondary btn-sm" data-remove-hof-item="${i}">Remove</button></div>`,
            )
            .join('') +
          '</div><button type="button" class="btn btn-secondary btn-sm" data-add-hof-item>+ Add person</button>'
        break
      case 'embed':
        fields =
          selectField('Embed type', 'embed_type', block.embed_type || 'youtube', [
            { value: 'youtube', label: 'YouTube' },
            { value: 'pdf', label: 'PDF' },
            { value: 'ms_forms', label: 'Form / iframe' },
          ]) +
          textField('URL', 'url', block.url)
        break
      case 'html':
        fields =
          textField('HTML content', 'content', block.content, true) +
          '<p class="inspector-hint">Advanced only. Prefer other block types when possible.</p>'
        break
      default:
        fields = '<p class="inspector-hint">No editor available for this block type.</p>'
    }

    return `
      <div class="inspector-header">
        <h4>${pb.escapeHtml(typeLabel)}</h4>
        <span class="inspector-path">${pb.escapeHtml(path)}</span>
      </div>
      <div class="inspector-fields">${fields}</div>
      <div class="inspector-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-move-up>Move up</button>
        <button type="button" class="btn btn-secondary btn-sm" data-move-down>Move down</button>
        <button type="button" class="btn btn-secondary btn-sm" data-duplicate>Duplicate</button>
        <button type="button" class="btn btn-danger btn-sm" data-delete>Delete</button>
      </div>
    `
  }

  function collectUpdates(block, formEl) {
    const updates = JSON.parse(JSON.stringify(block))
    formEl.querySelectorAll('[data-key]').forEach((el) => {
      const key = el.getAttribute('data-key')
      if (!key) return
      let value = el.value
      if (key === 'level' || key === 'cols' || key === 'columns') value = Number(value)
      if (key.startsWith('style.')) {
        if (!updates.style) updates.style = {}
        updates.style[key.slice(6)] = value
      } else if (key.startsWith('items.')) {
        const match = key.match(/^items\.(\d+)\.(\w+)$/)
        if (match) {
          const idx = Number(match[1])
          const prop = match[2]
          if (!updates.items) updates.items = []
          if (!updates.items[idx]) updates.items[idx] = {}
          updates.items[idx][prop] = value
        }
      } else {
        updates[key] = value
      }
    })
    return updates
  }

  function showAssetPicker(callback) {
    if (window.NrcgaAssetPicker?.open) {
      window.NrcgaAssetPicker.open(
        (url) => {
          if (url) callback(url)
        },
        { imagesOnly: true },
      )
      return
    }
    const next = window.prompt('Image URL', 'assets/images/')
    if (next == null || !next.trim()) return
    callback(next.trim())
  }

  function render(path) {
    if (!path) {
      panel.innerHTML = ''
      panel.hidden = true
      return
    }
    const blocks = editor.readBlocks()
    const block = pb.getBlockAtPath(blocks, path)
    if (!block) {
      panel.innerHTML = '<p class="inspector-hint">Block not found.</p>'
      return
    }
    panel.hidden = false
    panel.innerHTML = buildInspectorHtml(block, path)

    panel.querySelector('[data-move-up]')?.addEventListener('click', () => editor.moveBlock(path, 'up'))
    panel.querySelector('[data-move-down]')?.addEventListener('click', () => editor.moveBlock(path, 'down'))
    panel.querySelector('[data-duplicate]')?.addEventListener('click', () => editor.duplicateBlock(path))
    panel.querySelector('[data-delete]')?.addEventListener('click', () => {
      if (window.confirm('Delete this block?')) editor.deleteBlock(path)
    })

    panel.querySelector('[data-pick-asset]')?.addEventListener('click', () => {
      showAssetPicker((url) => {
        const blocks2 = editor.readBlocks()
        const b = pb.getBlockAtPath(blocks2, path)
        if (b) {
          b.url = url
          editor.writeBlocks(blocks2)
          render(path)
        }
      })
    })

    panel.querySelector('[data-pick-asset-image-url]')?.addEventListener('click', () => {
      showAssetPicker((url) => {
        const blocks2 = editor.readBlocks()
        const b = pb.getBlockAtPath(blocks2, path)
        if (b) {
          b.image_url = url
          editor.writeBlocks(blocks2)
          render(path)
        }
      })
    })

    panel.querySelector('[data-add-grid-item]')?.addEventListener('click', () => {
      const blocks2 = editor.readBlocks()
      const b = pb.getBlockAtPath(blocks2, path)
      if (b?.type === 'grid') {
        if (!b.items) b.items = []
        b.items.push({ icon: '✓', title: 'New item', body: 'Description.' })
        editor.writeBlocks(blocks2)
        render(path)
      }
    })

    panel.querySelectorAll('[data-remove-grid-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove-grid-item'))
        const blocks2 = editor.readBlocks()
        const b = pb.getBlockAtPath(blocks2, path)
        if (b?.items) {
          b.items.splice(idx, 1)
          editor.writeBlocks(blocks2)
          render(path)
        }
      })
    })

    panel.querySelector('[data-add-hof-item]')?.addEventListener('click', () => {
      const blocks2 = editor.readBlocks()
      const b = pb.getBlockAtPath(blocks2, path)
      if (b?.type === 'hall_of_fame_grid') {
        if (!b.items) b.items = []
        b.items.push({ name: 'Name', year: '2025' })
        editor.writeBlocks(blocks2)
        render(path)
      }
    })

    panel.querySelectorAll('[data-remove-hof-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove-hof-item'))
        const blocks2 = editor.readBlocks()
        const b = pb.getBlockAtPath(blocks2, path)
        if (b?.items) {
          b.items.splice(idx, 1)
          editor.writeBlocks(blocks2)
          render(path)
        }
      })
    })

    let debounce
    panel.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', () => {
        window.clearTimeout(debounce)
        debounce = window.setTimeout(() => {
          const blocks2 = editor.readBlocks()
          const b = pb.getBlockAtPath(blocks2, path)
          if (!b) return
          const updates = collectUpdates(b, panel)
          editor.updateBlock(path, updates)
        }, 300)
      })
    })
  }

  window.NRCGA_pageInspector = { render }
})()
