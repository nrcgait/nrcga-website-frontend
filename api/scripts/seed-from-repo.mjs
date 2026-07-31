/**
 * Seed local D1 from repo CSV files and nav-config.js.
 * Usage (from api/):
 *   npm run seed
 *
 * Requires: wrangler d1 migrations applied locally first.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

function sqlEscape(value) {
  return String(value ?? '').replace(/'/g, "''")
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++
      row.push(field)
      field = ''
      if (row.some((c) => c.length > 0)) rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  if (!rows.length) return []
  const headers = rows[0]
  return rows.slice(1).map((cells) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h.trim()] = (cells[idx] ?? '').trim()
    })
    return obj
  })
}

function readCsv(relPath) {
  const full = path.join(repoRoot, relPath)
  if (!fs.existsSync(full)) return []
  return parseCsv(fs.readFileSync(full, 'utf8'))
}

function loadNavConfig() {
  const file = path.join(repoRoot, 'js/nav-config.js')
  const text = fs.readFileSync(file, 'utf8')
  const match = text.match(/const navConfig\s*=\s*(\{[\s\S]*\});/)
  if (!match) return null
  // eslint-disable-next-line no-eval
  return eval(`(${match[1]})`)
}

const remote = process.argv.includes('--remote')
const envFlag = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : null
const dbName = envFlag === 'staging' ? 'nrcga-cms-staging' : 'nrcga-cms'
const wranglerEnv = envFlag ? ` --env ${envFlag}` : ''
const target = remote ? `--remote${wranglerEnv}` : '--local'

const statements = []

// Members
for (const row of readCsv('data/members.csv')) {
  const id = crypto.randomUUID()
  statements.push(
    `INSERT OR REPLACE INTO members (id, type, company_name, stakeholder_group, voting_member, website, category, term, contact_person, active)
     VALUES ('${id}', '${sqlEscape(row.Type)}', '${sqlEscape(row['Company Name'])}', '${sqlEscape(row['Stakeholder Group'])}', '${sqlEscape(row['Voting Member'])}', '${sqlEscape(row.Website)}', '${sqlEscape(row.Category)}', '${sqlEscape(row.Term)}', '${sqlEscape(row['Contact Person'])}', 1);`,
  )
}

// Programs
readCsv('data/programs.csv').forEach((row, idx) => {
  const id = crypto.randomUUID()
  statements.push(
    `INSERT OR REPLACE INTO programs (id, title, description, link, icon, sort_order)
     VALUES ('${id}', '${sqlEscape(row.title)}', '${sqlEscape(row.description)}', '${sqlEscape(row.link)}', '${sqlEscape(row.icon)}', ${idx});`,
  )
})

// Archive
for (const row of readCsv('data/archive.csv')) {
  const id = crypto.randomUUID()
  statements.push(
    `INSERT OR REPLACE INTO archive_items (id, type, title, date, link)
     VALUES ('${id}', '${sqlEscape(row.type)}', '${sqlEscape(row.title)}', '${sqlEscape(row.date)}', '${sqlEscape(row.link)}');`,
  )
}

// Carousel
readCsv('data/front-page-carousel.csv').forEach((row) => {
  const id = crypto.randomUUID()
  statements.push(
    `INSERT OR REPLACE INTO carousel_slides (id, image_url, alt_text, link_url, display_order, active)
     VALUES ('${id}', '${sqlEscape(row.image_url)}', '${sqlEscape(row.alt_text)}', '${sqlEscape(row.link_url)}', ${Number(row.display_order) || 0}, ${row.active === '1' ? 1 : 0});`,
  )
})

// Q&A (811 FAQ)
const qaFile = path.join(repoRoot, 'data/qa.json')
if (fs.existsSync(qaFile)) {
  const qaItems = JSON.parse(fs.readFileSync(qaFile, 'utf8'))
  for (const row of qaItems) {
    statements.push(
      `INSERT OR REPLACE INTO qa_items (id, question, answer_md, sort_order, published)
       VALUES ('${sqlEscape(row.id)}', '${sqlEscape(row.question)}', '${sqlEscape(row.answer_md)}', ${Number(row.sort_order) || 0}, ${row.published === 0 || row.published === false ? 0 : 1});`,
    )
  }
}

// Zero damages
for (const row of readCsv('assets/zerodamages.csv')) {
  const company = row.company || row.Company || Object.values(row)[0]
  if (!company) continue
  const id = crypto.randomUUID()
  statements.push(
    `INSERT OR IGNORE INTO zero_damages (id, company) VALUES ('${id}', '${sqlEscape(company)}');`,
  )
}

// Committees
const committeeRows = readCsv('data/committee-members-committees.csv')
const memberRows = readCsv('data/committee-members-members.csv')
for (const row of committeeRows) {
  const id = row.id || row.committee_id || crypto.randomUUID()
  statements.push(
    `INSERT OR REPLACE INTO committees (id, slug, name) VALUES ('${sqlEscape(id)}', '${sqlEscape(id)}', '${sqlEscape(row.name || row.Name)}');`,
  )
}
for (const row of memberRows) {
  const memberId = row.id || crypto.randomUUID()
  statements.push(
    `INSERT OR REPLACE INTO committee_members (id, name, company, email)
     VALUES ('${sqlEscape(memberId)}', '${sqlEscape(row.name || row.Name)}', '${sqlEscape(row.company || row.Company)}', '${sqlEscape(row.email || row.Email)}');`,
  )
}

// Site settings
const nav = loadNavConfig()
if (nav) {
  statements.push(
    `INSERT OR REPLACE INTO site_settings (key, value_json) VALUES ('navigation', '${sqlEscape(JSON.stringify(nav))}');`,
  )
}
statements.push(
  `INSERT OR REPLACE INTO site_settings (key, value_json) VALUES ('contact', '${sqlEscape(JSON.stringify({ organization_name: 'Nevada Regional Common Ground Alliance', email: 'info@nrcga.org', phone: '', address: '', hours: '', response_time: 'We typically respond within 1-2 business days.' }))}');`,
)
statements.push(
  `INSERT OR REPLACE INTO site_settings (key, value_json) VALUES ('footer', '${sqlEscape(JSON.stringify({ tagline: 'Promoting public safety and damage prevention across Nevada.', copyright: '© 2026 NRCGA. All rights reserved.' }))}');`,
)

const breaking = readCsv('data/front-page-breaking-news.csv')[0]
if (breaking) {
  statements.push(
    `INSERT OR REPLACE INTO site_settings (key, value_json) VALUES ('breaking_news', '${sqlEscape(
      JSON.stringify({
        active: breaking.active === 'true' || breaking.active === '1',
        title: breaking.title,
        content: breaking.content,
        image_url: breaking.image_url,
        read_more_url: breaking.read_more_url,
        storage_key: breaking.storage_key || 'nrcga_breaking_news_dismissed',
        expires_at: null,
      }),
    )}');`,
  )
}

const seedFile = path.join(__dirname, 'seed.generated.sql')
fs.writeFileSync(seedFile, statements.join('\n'))

execSync(`node "${path.join(__dirname, 'generate-page-seeds.mjs')}"`, { stdio: 'inherit' })
const pageSeeds = fs.readFileSync(path.join(__dirname, 'page-seeds.generated.sql'), 'utf8')
fs.appendFileSync(seedFile, `\n${pageSeeds}`)

console.log(`Wrote ${statements.length} statements to ${seedFile} (plus page seeds)`)

execSync(`npx wrangler d1 execute ${dbName} ${target} --file="${seedFile}"`, {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
})

console.log('Seed complete.')
