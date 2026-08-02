/**
 * Extract CMS page seeds from migrated HTML files (with #page-body).
 * Emits body_html (preferred) and keeps body_json for fallback.
 * Home also gets regions_json for hero + contact copy.
 * Usage (from api/): node scripts/generate-page-seeds.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { htmlToBlocks } from './migrate-html-to-blocks.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

const PAGE_FILES = [
  'budget-committee.html',
  '811-day.html',
  'craig-rogers-award.html',
  'training.html',
  'golf-tournament.html',
  'utility-locate-rodeo.html',
  'operations.html',
  'silver-shovel-award.html',
  'technical-solutions-committee.html',
  'embedded-facilities-taskforce.html',
  'about-811.html',
  'contact.html',
  'about.html',
  'index.html',
  'bylaws.html',
  'data-maps.html',
  'training-database.html',
]

function sqlEscape(value) {
  return String(value ?? '').replace(/'/g, "''")
}

function extractBetweenTag(html, tag, attr) {
  const pattern = new RegExp(`<${tag}[^>]*${attr}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = html.match(pattern)
  return match ? match[1].trim() : ''
}

function extractDivById(html, id) {
  const marker = `id="${id}"`
  const startIdx = html.indexOf(marker)
  if (startIdx === -1) return ''
  const openEnd = html.indexOf('>', startIdx) + 1
  if (openEnd <= 0) return ''

  let depth = 1
  let i = openEnd
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i)
    const nextClose = html.indexOf('</div>', i)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 4
    } else {
      depth--
      if (depth === 0) return html.slice(openEnd, nextClose).trim()
      i = nextClose + 6
    }
  }
  return ''
}

function extractPageBody(html) {
  const marker = 'id="page-body"'
  if (!html.includes(marker)) throw new Error('Missing #page-body')
  return extractDivById(html, 'page-body')
}

function slugFromHtml(html, filename) {
  const bodyMatch = html.match(/<body[^>]*data-page-slug="([^"]+)"/i)
  if (bodyMatch) return bodyMatch[1]
  return filename.replace(/\.html$/, '')
}

function stablePageId(slug) {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0
  }
  return `00000000-0000-4000-8000-${hash.toString(16).padStart(12, '0')}`
}

const statements = []

for (const file of PAGE_FILES) {
  const fullPath = path.join(repoRoot, file)
  const html = fs.readFileSync(fullPath, 'utf8')
  const slug = slugFromHtml(html, file)
  const sectionLabel = extractBetweenTag(html, 'span', 'class="section-label"')
  const title = extractBetweenTag(html, 'h1', 'class="page-title"')
  const subtitle = extractBetweenTag(html, 'p', 'class="page-subtitle"')
  const bodyHtml = extractPageBody(html)
  const blocks = htmlToBlocks(bodyHtml)
  const bodyJson = JSON.stringify(blocks)
  const id = stablePageId(slug)

  let regionsSql = 'NULL'
  if (slug === 'home') {
    const heroHtml = extractDivById(html, 'page-hero')
    const contactHtml = extractDivById(html, 'page-contact')
    const regions = JSON.stringify({ hero_html: heroHtml, contact_html: contactHtml })
    regionsSql = `'${sqlEscape(regions)}'`
  }

  statements.push(
    `INSERT OR REPLACE INTO pages (id, slug, title, section_label, subtitle, body_md, body_json, body_html, regions_json, published, is_custom)
     VALUES ('${id}', '${sqlEscape(slug)}', '${sqlEscape(title || slug)}', '${sqlEscape(sectionLabel)}', '${sqlEscape(subtitle)}', NULL, '${sqlEscape(bodyJson)}', '${sqlEscape(bodyHtml)}', ${regionsSql}, 1, 0);`,
  )
}

const outFile = path.join(__dirname, 'page-seeds.generated.sql')
fs.writeFileSync(outFile, statements.join('\n'))
console.log(`Wrote ${statements.length} page seed statements to ${outFile}`)
