// Visual page block editor — CRUD, sync to hidden JSON, coordinates inspector.
;(function () {
  const form = document.getElementById('page-form')
  const hiddenInput = document.getElementById('body_json')
  const addMenu = document.getElementById('page-add-block-menu')
  if (!form || !hiddenInput || !window.NRCGA_pageBlocks) return

  const pb = window.NRCGA_pageBlocks
  let selectedPath = null

  function readBlocks() {
    try {
      const parsed = JSON.parse(hiddenInput.value || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function writeBlocks(blocks) {
    hiddenInput.value = JSON.stringify(blocks, null, 2)
    hiddenInput.dispatchEvent(new Event('input', { bubbles: true }))
    window.NRCGA_pagePreview?.scheduleRefresh()
  }

  function selectBlock(path) {
    selectedPath = path
    window.NRCGA_pagePreview?.selectBlock(path)
    window.NRCGA_pageInspector?.render(path)
    const label = document.getElementById('page-inspector-empty')
    const panel = document.getElementById('page-inspector-panel')
    if (label) label.hidden = Boolean(path)
    if (panel) panel.hidden = !path
  }

  function addBlock(type, parentPath) {
    const template = pb.BLOCK_TEMPLATES[type]
    if (!template) return
    const blocks = readBlocks()
    const block = template()
    let newPath = ''

    if (parentPath) {
      const parent = pb.getBlockAtPath(blocks, parentPath)
      if (parent?.type === 'section') {
        if (!parent.children) parent.children = []
        parent.children.push(block)
        newPath = `${parentPath}.${parent.children.length - 1}`
      } else if (parent?.type === 'columns') {
        if (!parent.columns) parent.columns = [[], []]
        parent.columns[0].push(block)
        newPath = `${parentPath}.0.${parent.columns[0].length - 1}`
      } else {
        blocks.push(block)
        newPath = String(blocks.length - 1)
      }
    } else {
      blocks.push(block)
      newPath = String(blocks.length - 1)
    }

    writeBlocks(blocks)
    selectBlock(newPath)
  }

  function updateBlock(path, updates) {
    const blocks = readBlocks()
    const parent = pb.getParentArray(blocks, path)
    if (!parent) return
    parent.arr[parent.index] = updates
    writeBlocks(blocks)
  }

  function deleteBlock(path) {
    const blocks = readBlocks()
    if (!pb.deleteBlockAtPath(blocks, path)) return
    writeBlocks(blocks)
    selectBlock(null)
  }

  function moveBlock(path, direction) {
    const blocks = readBlocks()
    const parent = pb.getParentArray(blocks, path)
    if (!parent) return
    const { arr, index } = parent
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= arr.length) return
    ;[arr[index], arr[newIndex]] = [arr[newIndex], arr[index]]
    writeBlocks(blocks)
    const indices = pb.parsePath(path)
    indices[indices.length - 1] = newIndex
    selectBlock(indices.join('.'))
  }

  function duplicateBlock(path) {
    const blocks = readBlocks()
    const block = pb.getBlockAtPath(blocks, path)
    const parent = pb.getParentArray(blocks, path)
    if (!block || !parent) return
    parent.arr.splice(parent.index + 1, 0, pb.cloneBlock(block))
    writeBlocks(blocks)
    const indices = pb.parsePath(path)
    indices[indices.length - 1] = parent.index + 1
    selectBlock(indices.join('.'))
  }

  // Build add-block menu
  if (addMenu) {
    const types = ['section', 'heading', 'text', 'image', 'columns', 'grid', 'spacer', 'callout', 'cta_button', 'embed']
    addMenu.innerHTML = types
      .map(
        (type) =>
          `<button type="button" class="btn btn-secondary btn-sm" data-add-block-type="${type}">+ ${pb.BLOCK_LABELS[type] || type}</button>`,
      )
      .join('')
    addMenu.innerHTML +=
      ' <details class="page-add-advanced"><summary class="btn btn-secondary btn-sm">Advanced</summary><div class="page-add-advanced-items">' +
      ['winner_card', 'hall_of_fame_grid', 'html']
        .map(
          (type) =>
            `<button type="button" class="btn btn-secondary btn-sm" data-add-block-type="${type}">+ ${pb.BLOCK_LABELS[type] || type}</button>`,
        )
        .join('') +
      '</div></details>'

    addMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add-block-type]')
      if (!btn) return
      e.preventDefault()
      const type = btn.getAttribute('data-add-block-type')
      const parent = selectedPath && pb.getBlockAtPath(readBlocks(), selectedPath)
      const parentPath =
        parent?.type === 'section' || parent?.type === 'columns' ? selectedPath : null
      addBlock(type, parentPath)
    })
  }

  hiddenInput.addEventListener('input', () => {
    window.NRCGA_pagePreview?.scheduleRefresh()
  })

  window.NRCGA_pageEditor = {
    readBlocks,
    writeBlocks,
    selectBlock,
    addBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    duplicateBlock,
    getSelectedPath: () => selectedPath,
  }
})()
