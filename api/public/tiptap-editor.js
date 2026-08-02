/**
 * Lightweight rich-text editor for posts and pages.
 * Syncs contenteditable HTML into hidden fields before submit.
 * Supports multiple hosts via [data-rich-editor] and insertable content blocks.
 */
;(function () {
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
      '<button type="button" data-cmd="formatBlock" data-value="p">P</button>',
      '<button type="button" data-cmd="createLink">Link</button>',
    ]
    const blockBtns = includeBlocks
      ? [
          '<span class="tiptap-toolbar-sep"></span>',
          '<button type="button" data-insert="image">Image</button>',
          '<button type="button" data-insert="button">Button</button>',
          '<button type="button" data-insert="callout">Callout</button>',
          '<button type="button" data-insert="embed">Embed</button>',
          '<button type="button" data-insert="spacer">Spacer</button>',
        ]
      : []
    toolbar.innerHTML = formatBtns.concat(blockBtns).join(' ')
    return toolbar
  }

  function handleInsert(editor, kind) {
    if (kind === 'image') {
      const url = window.prompt('Image URL', 'assets/images/')
      if (!url) return
      const alt = window.prompt('Alt text', '') || ''
      insertHtmlAtCursor(
        editor,
        `<figure class="page-block-image pb-img-full pb-img-align-center"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" /></figure>`,
      )
      return
    }
    if (kind === 'button') {
      const label = window.prompt('Button label', 'Learn more')
      if (!label) return
      const url = window.prompt('Button URL', '#') || '#'
      insertHtmlAtCursor(
        editor,
        `<p class="pb-cta-wrap"><a href="${escapeHtml(url)}" class="btn btn-primary">${escapeHtml(label)}</a></p>`,
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
      const url = window.prompt('Embed URL (YouTube embed or PDF)', '')
      if (!url) return
      const isPdf = /\.pdf(\?|$)/i.test(url)
      const cls = isPdf ? 'page-block-embed pb-embed-pdf' : 'page-block-embed'
      insertHtmlAtCursor(
        editor,
        `<div class="${cls}"><iframe src="${escapeHtml(url)}"${isPdf ? '' : ' allowfullscreen'}></iframe></div>`,
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

    toolbar.addEventListener('click', (e) => {
      const insertBtn = e.target.closest('button[data-insert]')
      if (insertBtn) {
        e.preventDefault()
        handleInsert(editor, insertBtn.getAttribute('data-insert'))
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
        return
      }
      if (cmd === 'formatBlock' && value) {
        document.execCommand('formatBlock', false, value)
        return
      }
      document.execCommand(cmd, false)
    })

    const form = host.closest('form') || document.getElementById(host.getAttribute('data-form') || '')
    const sync = () => {
      field.value = editor.innerHTML
    }
    if (form) {
      form.addEventListener('submit', sync)
    }
    editor.addEventListener('input', sync)
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
