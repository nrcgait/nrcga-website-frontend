;(function () {
  function bindAssetPickers(list) {
    if (window.NrcgaAssetPicker?.init && list) {
      window.NrcgaAssetPicker.init(list)
    }
  }

  function boot() {
    const list = document.getElementById('breaking-news-items')
    const countInput = document.getElementById('breaking-item-count')
    const template = document.getElementById('breaking-news-template')
    const addBtn = document.getElementById('breaking-news-add')
    if (!list || !countInput || !template || !addBtn) return

    function reindexItems() {
      const items = list.querySelectorAll('.admin-breaking-news-item')
      items.forEach((item, index) => {
        item.dataset.breakingIndex = String(index)
        const legend = item.querySelector('legend')
        if (legend) legend.textContent = 'Entry ' + (index + 1)
        item.querySelectorAll('[name^="breaking_item_"]').forEach((el) => {
          if (!el.name) return
          el.name = el.name.replace(/breaking_item_\d+_/, 'breaking_item_' + index + '_')
        })
      })
      countInput.value = String(items.length)
      bindAssetPickers(list)
    }

    addBtn.addEventListener('click', () => {
      list.appendChild(template.content.cloneNode(true))
      reindexItems()
    })

    list.addEventListener('click', (event) => {
      const btn = event.target.closest('.admin-breaking-remove')
      if (!btn) return
      const item = btn.closest('.admin-breaking-news-item')
      if (!item) return
      if (list.querySelectorAll('.admin-breaking-news-item').length <= 1) {
        window.alert('Keep at least one breaking news entry.')
        return
      }
      item.remove()
      reindexItems()
    })

    bindAssetPickers(list)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
