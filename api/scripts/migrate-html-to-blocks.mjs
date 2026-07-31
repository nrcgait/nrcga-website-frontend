/**
 * Convert legacy page-body HTML into structured CMS blocks.
 */
import * as cheerio from 'cheerio'

function textOf($el) {
  return $el.text().replace(/\s+/g, ' ').trim()
}

function inferImageWidth(style) {
  const s = String(style || '')
  if (s.includes('33%') || s.includes('300px')) return 'sm'
  if (s.includes('50%') || s.includes('600px')) return 'md'
  if (s.includes('75%') || s.includes('800px')) return 'lg'
  return 'full'
}

function inferAlign($el) {
  const style = $el.attr('style') || ''
  const parentStyle = $el.parent().attr('style') || ''
  const combined = style + parentStyle
  if (combined.includes('text-align: center') || $el.hasClass('text-center')) return 'center'
  if (combined.includes('text-align: right')) return 'right'
  return 'left'
}

function parseHeading($el) {
  const level = Number($el.prop('tagName')?.replace('H', '') || 2)
  return {
    type: 'heading',
    level: level >= 2 && level <= 4 ? level : 2,
    text: textOf($el),
    style: { align: inferAlign($el), textSize: level === 2 ? 'lg' : 'md', textColor: 'default' },
  }
}

function parseParagraph($el) {
  return {
    type: 'text',
    body: textOf($el),
    style: { align: inferAlign($el), textSize: 'md', textColor: 'default' },
  }
}

function parseImage($el) {
  const src = $el.attr('src') || ''
  return {
    type: 'image',
    url: src,
    alt: $el.attr('alt') || '',
    caption: '',
    width: inferImageWidth($el.attr('style')),
    align: inferAlign($el),
  }
}

function parseGrid($el) {
  const items = []
  $el.children().each((_, child) => {
    const $child = cheerio.load(child).root().children().first()
    if (!$child.length) return
    const icon = $child.find('.feature-icon').first().text().trim() || $child.find('[style*="font-size: 2rem"]').first().text().trim() || '✓'
    const title = $child.find('h3').first().text().trim() || $child.find('strong').first().text().trim()
    const body = $child.find('p').first().text().trim() || textOf($child)
    if (title || body) items.push({ icon, title, body })
  })
  const style = $el.attr('style') || ''
  let columns = 3
  if (style.includes('minmax(180px') || style.includes('minmax(200px')) columns = 4
  if (style.includes('minmax(250px')) columns = 2
  return { type: 'grid', columns, gap: 'md', items }
}

function parseContentGrid($el) {
  const columns = []
  $el.children('.content-text, .content-visual, div').each((_, child) => {
    const $col = cheerio.load(child).root().children().first()
    const colBlocks = []
    $col.children().each((__, node) => {
      const blocks = nodeToBlocks(cheerio.load(node).root().children().first())
      colBlocks.push(...blocks)
    })
    if (colBlocks.length) columns.push(colBlocks)
  })
  if (columns.length < 2) return null
  return { type: 'columns', cols: Math.min(columns.length, 3), gap: 'md', columns }
}

function nodeToBlocks($el) {
  if (!$el || !$el.length) return []
  const tag = ($el.prop('tagName') || '').toLowerCase()

  if (tag === 'ul' || tag === 'ol') {
    const items = []
    $el.find('li').each((_, li) => {
      const t = textOf(cheerio.load(li).root())
      if (t) items.push(t)
    })
    if (items.length) {
      return [{
        type: 'text',
        body: items.map((item) => `• ${item}`).join('\n'),
        style: { align: inferAlign($el), textSize: 'md', textColor: 'default' },
      }]
    }
  }
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') return [parseHeading($el)]
  if (tag === 'p') {
    const body = textOf($el)
    if (!body) return []
    return [parseParagraph($el)]
  }
  if (tag === 'img') return [parseImage($el)]
  if (tag === 'figure') {
    const img = $el.find('img').first()
    if (img.length) {
      const block = parseImage(img)
      block.caption = $el.find('figcaption').text().trim()
      return [block]
    }
  }
  if ($el.hasClass('features-grid') || ($el.attr('style') || '').includes('display: grid')) {
    const grid = parseGrid($el)
    if (grid.items.length) return [grid]
  }
  if ($el.hasClass('content-grid')) {
    const cols = parseContentGrid($el)
    if (cols) return [cols]
  }
  if ($el.is('a.btn')) {
    return [{ type: 'cta_button', label: textOf($el), url: $el.attr('href') || '#', style: { align: inferAlign($el) } }]
  }

  const blocks = []
  $el.children().each((_, child) => {
    blocks.push(...nodeToBlocks(cheerio.load(child).root().children().first()))
  })
  if (!blocks.length && textOf($el)) {
    blocks.push(parseParagraph($el))
  }
  return blocks
}

function parseSection($section) {
  const classes = $section.attr('class') || ''
  const style = $section.attr('style') || ''
  const bg = classes.includes('bg-light') ? 'light' : 'default'
  const padding = 'md'
  const children = []

  if ((style.includes('background-image') || style.includes('height:')) && !$section.find('.container').length) {
    const bgUrl = (style.match(/url\(['"]?([^'")]+)/) || [])[1]
    if (bgUrl) {
      children.push({
        type: 'image',
        url: bgUrl,
        alt: '',
        caption: '',
        width: 'full',
        align: 'center',
      })
    }
    return { type: 'section', bg, padding, children }
  }

  const $container = $section.find('.container').first().length ? $section.find('.container').first() : $section
  $container.children().each((_, child) => {
    const $child = cheerio.load(child).root().children().first()
    children.push(...nodeToBlocks($child))
  })

  if (!children.length) {
    const html = cheerio.load($section.html() || '').html()
    if (html?.trim()) children.push({ type: 'html', content: `<section class="${classes}">${html}</section>` })
  }

  return { type: 'section', bg, padding, children }
}

export function htmlToBlocks(html) {
  const $ = cheerio.load(`<div id="wrap">${html}</div>`)
  const blocks = []

  $('#wrap').children().each((_, child) => {
    const $child = $(child)
    const tag = ($child.prop('tagName') || '').toLowerCase()

    if (tag === 'section') {
      blocks.push(parseSection($child))
      return
    }

    if ((($child.attr('style') || '').includes('background-image')) && tag === 'section') {
      blocks.push(parseSection($child))
      return
    }

    const converted = nodeToBlocks($child)
    if (converted.length) {
      blocks.push({ type: 'section', bg: 'default', padding: 'md', children: converted })
    } else {
      const outer = $.html($child)
      if (outer?.trim()) {
        blocks.push({
          type: 'section',
          bg: 'default',
          padding: 'md',
          children: [{ type: 'html', content: outer }],
        })
      }
    }
  })

  return blocks.filter(Boolean)
}
