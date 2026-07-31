document.addEventListener('DOMContentLoaded', () => {
  initCommitteePickers()
  initMemberOrgPickers()
  initRoleFields()
  initCollapsibleForms()
})

function initCollapsibleForms() {
  document.querySelectorAll('[data-toggle-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-toggle-form')
      const panel = targetId ? document.getElementById(targetId) : null
      if (!panel) return
      const isHidden = panel.hasAttribute('hidden')
      if (isHidden) {
        panel.removeAttribute('hidden')
        btn.textContent = btn.getAttribute('data-toggle-label-hide') || 'Cancel'
      } else {
        panel.setAttribute('hidden', '')
        btn.textContent = btn.getAttribute('data-toggle-label-show') || 'Add user'
      }
    })
  })
}

function initRoleFields() {
  const roleSelect = document.querySelector('[data-user-role]')
  const chairFields = document.querySelector('[data-chair-fields]')
  if (!roleSelect || !chairFields) return

  const sync = () => {
    chairFields.hidden = roleSelect.value !== 'chair'
  }
  roleSelect.addEventListener('change', sync)
  sync()
}

function initCommitteePickers() {
  document.querySelectorAll('[data-committee-picker]').forEach((root) => {
    const dialog = root.querySelector('[data-committee-dialog]')
    const input = root.querySelector('[data-committee-input]')
    const openBtn = root.querySelector('[data-committee-open]')
    const doneBtn = root.querySelector('[data-committee-done]')
    const checkboxes = root.querySelectorAll('[data-committee-checkbox]')
    const selectedWrap = root.querySelector('.committee-picker-selected')

    if (!dialog || !input || !openBtn || !doneBtn) return

    openBtn.addEventListener('click', () => dialog.showModal())

    doneBtn.addEventListener('click', () => {
      const selected = [...checkboxes].filter((cb) => cb.checked).map((cb) => cb.value)
      input.value = selected.join(',')
      openBtn.textContent = `Select committees (${selected.length})`
      if (selectedWrap) {
        selectedWrap.innerHTML = selected.length
          ? selected
              .map((slug) => {
                const label = root.querySelector(`[data-committee-checkbox][value="${slug}"]`)?.parentElement?.childNodes?.[1]
                const name = label?.textContent?.trim() || slug
                return `<span class="committee-tag">${escapeHtml(name)}</span>`
              })
              .join('')
          : '<span class="muted">No committees selected</span>'
      }
      dialog.close()
    })
  })
}

function initMemberOrgPickers() {
  document.querySelectorAll('[data-member-org-picker]').forEach((root) => {
    const dialog = root.querySelector('[data-member-org-dialog]')
    const input = root.querySelector('[data-member-org-input]')
    const openBtn = root.querySelector('[data-member-org-open]')
    const clearBtn = root.querySelector('[data-member-org-clear]')
    const doneBtn = root.querySelector('[data-member-org-done]')
    const search = root.querySelector('[data-member-org-search]')
    const options = root.querySelectorAll('[data-member-id]')

    if (!dialog || !input || !openBtn || !doneBtn) return

    openBtn.addEventListener('click', () => dialog.showModal())
    doneBtn.addEventListener('click', () => dialog.close())

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = ''
        openBtn.textContent = 'Link to member organization'
        options.forEach((opt) => opt.classList.remove('selected'))
      })
    }

    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        input.value = opt.getAttribute('data-member-id') || ''
        openBtn.textContent = opt.getAttribute('data-member-name') || 'Linked member'
        options.forEach((o) => o.classList.remove('selected'))
        opt.classList.add('selected')
      })
    })

    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase()
        options.forEach((opt) => {
          const name = (opt.getAttribute('data-member-name') || '').toLowerCase()
          opt.hidden = !name.includes(q)
        })
      })
    }
  })
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
