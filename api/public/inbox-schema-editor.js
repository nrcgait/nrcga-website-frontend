/**
 * Field builder for custom form inbox schemas.
 * Expects #inbox-fields[data-inbox-fields][data-initial="...json..."]
 * and a button [data-inbox-add-field].
 */
;(function () {
  const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'email', label: 'Email' },
    { value: 'tel', label: 'Phone' },
    { value: 'url', label: 'URL' },
    { value: 'textarea', label: 'Text area' },
    { value: 'select', label: 'Select' },
    { value: 'checkbox', label: 'Checkbox' },
  ]

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function parseInitial(root) {
    const raw = root.getAttribute('data-initial') || '[]'
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function optionsValue(field) {
    if (Array.isArray(field.options)) return field.options.join('\n')
    return typeof field.options === 'string' ? field.options : ''
  }

  function renderField(index, field) {
    const type = field.type || 'text'
    const optionsVisible = type === 'select' ? '' : 'hidden'
    return `
      <div class="inbox-field-row" data-field-row>
        <div class="inbox-field-grid">
          <label>
            Label
            <input name="field_label_${index}" required value="${escapeHtml(field.label || '')}" />
          </label>
          <label>
            Name
            <input name="field_name_${index}" required value="${escapeHtml(field.name || '')}" placeholder="snake_case" />
          </label>
          <label>
            Type
            <select name="field_type_${index}" data-field-type>
              ${FIELD_TYPES.map(
                (t) =>
                  `<option value="${t.value}" ${t.value === type ? 'selected' : ''}>${t.label}</option>`,
              ).join('')}
            </select>
          </label>
          <label class="inbox-field-required">
            <input type="checkbox" name="field_required_${index}" value="1" ${field.required ? 'checked' : ''} />
            Required
          </label>
        </div>
        <label data-field-options ${optionsVisible}>
          Options (one per line, for select)
          <textarea name="field_options_${index}" rows="2">${escapeHtml(optionsValue(field))}</textarea>
        </label>
        <label>
          Placeholder (optional)
          <input name="field_placeholder_${index}" value="${escapeHtml(field.placeholder || '')}" />
        </label>
        <p>
          <button type="button" class="btn btn-secondary" data-remove-field>Remove field</button>
        </p>
      </div>
    `
  }

  function reindex(root) {
    const rows = [...root.querySelectorAll('[data-field-row]')]
    rows.forEach((row, index) => {
      row.querySelectorAll('[name]').forEach((el) => {
        const name = el.getAttribute('name') || ''
        el.setAttribute('name', name.replace(/_\d+$/, `_${index}`))
      })
    })
  }

  function bindRow(row) {
    const typeSelect = row.querySelector('[data-field-type]')
    const options = row.querySelector('[data-field-options]')
    const sync = () => {
      if (!options) return
      if (typeSelect && typeSelect.value === 'select') options.removeAttribute('hidden')
      else options.setAttribute('hidden', '')
    }
    typeSelect?.addEventListener('change', sync)
    sync()
    row.querySelector('[data-remove-field]')?.addEventListener('click', () => {
      const root = row.parentElement
      row.remove()
      if (root) reindex(root)
    })
  }

  function addField(root, field) {
    const index = root.querySelectorAll('[data-field-row]').length
    root.insertAdjacentHTML('beforeend', renderField(index, field || { type: 'text', required: false }))
    const row = root.querySelector('[data-field-row]:last-child')
    if (row) bindRow(row)
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-inbox-fields]')
    if (!root) return

    // Bind rows that were server-rendered; only seed from JSON if none exist.
    const existing = [...root.querySelectorAll('[data-field-row]')]
    if (existing.length) {
      existing.forEach((row) => bindRow(row))
    } else {
      const initial = parseInitial(root)
      if (initial.length) initial.forEach((field) => addField(root, field))
      else addField(root, { name: 'name', label: 'Name', type: 'text', required: true })
    }

    document.querySelector('[data-inbox-add-field]')?.addEventListener('click', () => {
      addField(root, { type: 'text', required: false })
    })
  })
})()
