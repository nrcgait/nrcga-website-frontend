import type { PaginatedResult } from './pagination'
import { likePattern, paginateQuery } from './pagination'
import { sqlOrderBy, type SortColumnSql, type SortSpec } from './sort'

type Row = Record<string, unknown>

export async function listMembers(db: D1Database) {
  const { results } = await db
    .prepare('SELECT * FROM members ORDER BY type, company_name')
    .all()
  return results ?? []
}

export const MEMBER_SORT_COLUMNS: SortColumnSql = {
  type: 'type COLLATE NOCASE',
  company: 'company_name COLLATE NOCASE',
  group: 'stakeholder_group COLLATE NOCASE',
  board: 'is_board_member',
  officer: '(CASE WHEN is_chair = 1 THEN 1 WHEN is_vice_chair = 1 THEN 2 ELSE 3 END)',
  contact: 'contact_person COLLATE NOCASE',
}

export async function listMembersPaginated(
  db: D1Database,
  page: number,
  search = '',
  sort?: SortSpec | null,
): Promise<PaginatedResult<Row>> {
  const order = sqlOrderBy(sort, MEMBER_SORT_COLUMNS, 'ORDER BY type, company_name')
  const term = search.trim()
  if (!term) {
    return paginateQuery(
      db,
      'SELECT COUNT(*) as c FROM members',
      `SELECT * FROM members ${order}`,
      page,
    )
  }

  const pattern = likePattern(term)
  const binds = [pattern, pattern, pattern, pattern, pattern, pattern]
  const where = `WHERE (
    company_name LIKE ? ESCAPE '\\' OR
    type LIKE ? ESCAPE '\\' OR
    stakeholder_group LIKE ? ESCAPE '\\' OR
    contact_person LIKE ? ESCAPE '\\' OR
    category LIKE ? ESCAPE '\\' OR
    website LIKE ? ESCAPE '\\'
  )`

  return paginateQuery(
    db,
    `SELECT COUNT(*) as c FROM members ${where}`,
    `SELECT * FROM members ${where} ${order}`,
    page,
    binds,
  )
}

export async function listStakeholderMembers(db: D1Database) {
  const { results } = await db
    .prepare(`SELECT * FROM members WHERE type = 'Stakeholder' ORDER BY company_name`)
    .all()
  return results ?? []
}

export async function findBoardMemberForGroup(
  db: D1Database,
  stakeholderGroup: string,
  excludeMemberId?: string,
): Promise<Record<string, unknown> | null> {
  let query = `SELECT * FROM members WHERE type = 'Stakeholder' AND stakeholder_group = ? AND is_board_member = 1`
  const binds: string[] = [stakeholderGroup]
  if (excludeMemberId) {
    query += ' AND id != ?'
    binds.push(excludeMemberId)
  }
  return db.prepare(query).bind(...binds).first<Record<string, unknown>>()
}

export type BoardMemberConflict = {
  existingMemberId: string
  existingCompanyName: string
}

export type OfficerConflict = {
  position: 'Chair' | 'Vice Chair'
  existingMemberId: string
  existingCompanyName: string
}

export async function checkBoardMemberConflict(
  db: D1Database,
  stakeholderGroup: string | null | undefined,
  isBoardMember: boolean,
  memberId?: string,
): Promise<BoardMemberConflict | null> {
  if (!isBoardMember || !stakeholderGroup) return null
  const existing = await findBoardMemberForGroup(db, String(stakeholderGroup), memberId)
  if (!existing) return null
  return {
    existingMemberId: String(existing.id),
    existingCompanyName: String(existing.company_name ?? ''),
  }
}

export async function findOfficerForPosition(
  db: D1Database,
  position: 'chair' | 'vice_chair',
  excludeMemberId?: string,
): Promise<Record<string, unknown> | null> {
  const column = position === 'chair' ? 'is_chair' : 'is_vice_chair'
  let query = `SELECT * FROM members WHERE ${column} = 1`
  const binds: string[] = []
  if (excludeMemberId) {
    query += ' AND id != ?'
    binds.push(excludeMemberId)
  }
  return db.prepare(query).bind(...binds).first<Record<string, unknown>>()
}

export async function checkOfficerConflicts(
  db: D1Database,
  isChair: boolean,
  isViceChair: boolean,
  memberId?: string,
): Promise<OfficerConflict | 'both' | null> {
  if (isChair && isViceChair) return 'both'
  if (isChair) {
    const existing = await findOfficerForPosition(db, 'chair', memberId)
    if (existing) {
      return {
        position: 'Chair',
        existingMemberId: String(existing.id),
        existingCompanyName: String(existing.company_name ?? ''),
      }
    }
  }
  if (isViceChair) {
    const existing = await findOfficerForPosition(db, 'vice_chair', memberId)
    if (existing) {
      return {
        position: 'Vice Chair',
        existingMemberId: String(existing.id),
        existingCompanyName: String(existing.company_name ?? ''),
      }
    }
  }
  return null
}

function officerApiRow(m: Record<string, unknown>, position: string) {
  // Public officers table expects person in Company Name and org in Contact Person
  // (same layout as the legacy CSV). Stakeholder rows store the opposite.
  const person = String(m.contact_person ?? '').trim() || String(m.company_name ?? '')
  const org = String(m.contact_person ?? '').trim() ? String(m.company_name ?? '') : ''
  return {
    Type: 'Officer',
    'Company Name': person,
    'Stakeholder Group': position,
    'Voting Member': m.voting_member,
    Website: m.website,
    Category: m.category,
    Term: m.term,
    'Contact Person': org,
    Active: m.active,
  }
}

export async function upsertMember(db: D1Database, data: Record<string, unknown>, id?: string) {
  const memberId = id ?? crypto.randomUUID()
  const type = String(data.type ?? 'Stakeholder')
  const isStakeholder = type === 'Stakeholder'
  const isChair = isStakeholder ? Number(data.is_chair ?? 0) : 0
  const isViceChair = isStakeholder ? Number(data.is_vice_chair ?? 0) : 0
  const isBoardMember = isStakeholder ? Number(data.is_board_member ?? 0) : 0
  await db
    .prepare(
      `INSERT INTO members (id, type, company_name, stakeholder_group, voting_member, website, category, term, contact_person, active, is_board_member, is_chair, is_vice_chair)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         company_name = excluded.company_name,
         stakeholder_group = excluded.stakeholder_group,
         voting_member = excluded.voting_member,
         website = excluded.website,
         category = excluded.category,
         term = excluded.term,
         contact_person = excluded.contact_person,
         active = excluded.active,
         is_board_member = excluded.is_board_member,
         is_chair = excluded.is_chair,
         is_vice_chair = excluded.is_vice_chair,
         updated_at = datetime('now')`,
    )
    .bind(
      memberId,
      type,
      String(data.company_name ?? ''),
      isStakeholder ? (data.stakeholder_group ?? null) : null,
      data.voting_member ?? null,
      data.website ?? null,
      data.category ?? null,
      isStakeholder ? (data.term ?? null) : null,
      data.contact_person ?? null,
      Number(data.active ?? 1),
      isBoardMember,
      isChair,
      isViceChair,
    )
    .run()
  return memberId
}

export async function deleteMember(db: D1Database, id: string) {
  await db.prepare('DELETE FROM members WHERE id = ?').bind(id).run()
}

export async function getMemberById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM members WHERE id = ?').bind(id).first()
}

export async function listCommittees(db: D1Database) {
  const { results } = await db.prepare('SELECT id, slug, name FROM committees ORDER BY name').all()
  return results ?? []
}

export function membersForPublicApi(rows: Record<string, unknown>[]) {
  const result: Record<string, unknown>[] = []
  for (const m of rows) {
    const type = String(m.type ?? '')
    // Officer/Director are not stored types; ignore any legacy rows.
    if (type === 'Officer' || type === 'Director') continue

    const isChair = Number(m.is_chair) === 1
    const isViceChair = Number(m.is_vice_chair) === 1

    result.push({
      Type: m.type,
      'Company Name': m.company_name,
      'Stakeholder Group': m.stakeholder_group,
      'Voting Member': m.voting_member,
      Website: m.website,
      Category: m.category,
      Term: m.term,
      'Contact Person': m.contact_person,
      Active: m.active,
    })

    if (type === 'Stakeholder' && Number(m.is_board_member) === 1) {
      result.push({
        Type: 'Director',
        'Company Name': m.company_name,
        'Stakeholder Group': m.stakeholder_group,
        'Voting Member': m.voting_member,
        Website: m.website,
        Category: m.category,
        Term: m.term,
        'Contact Person': m.contact_person,
        Active: m.active,
      })
    }

    if (type === 'Stakeholder' && isChair) result.push(officerApiRow(m, 'Chair'))
    if (type === 'Stakeholder' && isViceChair) result.push(officerApiRow(m, 'Vice Chair'))
  }
  return result
}

export async function listPrograms(db: D1Database) {
  const { results } = await db
    .prepare('SELECT * FROM programs ORDER BY sort_order, title')
    .all()
  return results ?? []
}

export const PROGRAM_SORT_COLUMNS: SortColumnSql = {
  title: 'title COLLATE NOCASE',
  committee: 'committee_slug COLLATE NOCASE',
  link: 'link COLLATE NOCASE',
}

export async function listProgramsPaginated(
  db: D1Database,
  page: number,
  committeeSlugs?: string[],
  sort?: SortSpec | null,
): Promise<PaginatedResult<Row>> {
  const order = sqlOrderBy(sort, PROGRAM_SORT_COLUMNS, 'ORDER BY sort_order, title')
  if (committeeSlugs?.length) {
    const placeholders = committeeSlugs.map(() => '?').join(', ')
    return paginateQuery(
      db,
      `SELECT COUNT(*) as c FROM programs WHERE committee_slug IN (${placeholders})`,
      `SELECT * FROM programs WHERE committee_slug IN (${placeholders}) ${order}`,
      page,
      committeeSlugs,
    )
  }
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM programs',
    `SELECT * FROM programs ${order}`,
    page,
  )
}

export async function upsertProgram(db: D1Database, data: Record<string, unknown>, id?: string) {
  const programId = id ?? crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO programs (id, title, description, link, icon, sort_order, committee_slug)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         link = excluded.link,
         icon = excluded.icon,
         sort_order = excluded.sort_order,
         committee_slug = excluded.committee_slug,
         updated_at = datetime('now')`,
    )
    .bind(
      programId,
      String(data.title ?? ''),
      data.description ?? null,
      data.link ?? null,
      data.icon ?? null,
      Number(data.sort_order ?? 0),
      data.committee_slug ?? null,
    )
    .run()
  return programId
}

export async function deleteProgram(db: D1Database, id: string) {
  await db.prepare('DELETE FROM programs WHERE id = ?').bind(id).run()
}

export async function getProgramById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM programs WHERE id = ?').bind(id).first()
}

export async function listArchiveItems(db: D1Database) {
  const { results } = await db
    .prepare('SELECT * FROM archive_items ORDER BY date DESC, title')
    .all()
  return results ?? []
}

export type ArchiveFeedType = 'all' | 'meeting-minute' | 'historical-document' | 'post'

export function parseArchiveFeedType(value: string | undefined): ArchiveFeedType {
  const v = (value ?? 'all').trim().toLowerCase()
  if (v === 'meeting-minute' || v === 'historical-document' || v === 'post') return v
  return 'all'
}

/** Public archive feed: minutes + historical docs + published posts, newest first. */
export async function listArchiveFeed(
  db: D1Database,
  page: number,
  type: ArchiveFeedType = 'all',
): Promise<PaginatedResult<Row>> {
  const archiveSelect = `SELECT id, type, title, date AS sort_date, link, NULL AS slug, NULL AS excerpt, NULL AS cover_url
    FROM archive_items`
  const postSelect = `SELECT id, 'post' AS type, title, COALESCE(published_at, created_at) AS sort_date,
    NULL AS link, slug, excerpt, cover_url
    FROM posts WHERE published = 1`

  let unionSql: string
  if (type === 'meeting-minute' || type === 'historical-document') {
    unionSql = `${archiveSelect} WHERE type = ?`
  } else if (type === 'post') {
    unionSql = postSelect
  } else {
    unionSql = `${archiveSelect} UNION ALL ${postSelect}`
  }

  const binds: unknown[] =
    type === 'meeting-minute' || type === 'historical-document' ? [type] : []

  return paginateQuery(
    db,
    `SELECT COUNT(*) as c FROM (${unionSql})`,
    `SELECT * FROM (${unionSql}) ORDER BY sort_date DESC, title`,
    page,
    binds,
  )
}

export const ARCHIVE_SORT_COLUMNS: SortColumnSql = {
  type: 'type COLLATE NOCASE',
  title: 'title COLLATE NOCASE',
  committee: 'committee_slug COLLATE NOCASE',
  date: 'date',
}

export async function listArchiveItemsPaginated(
  db: D1Database,
  page: number,
  committeeSlugs?: string[],
  sort?: SortSpec | null,
): Promise<PaginatedResult<Row>> {
  const order = sqlOrderBy(sort, ARCHIVE_SORT_COLUMNS, 'ORDER BY date DESC, title')
  if (committeeSlugs?.length) {
    const placeholders = committeeSlugs.map(() => '?').join(', ')
    return paginateQuery(
      db,
      `SELECT COUNT(*) as c FROM archive_items WHERE committee_slug IN (${placeholders})`,
      `SELECT * FROM archive_items WHERE committee_slug IN (${placeholders}) ${order}`,
      page,
      committeeSlugs,
    )
  }
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM archive_items',
    `SELECT * FROM archive_items ${order}`,
    page,
  )
}

export async function upsertArchiveItem(db: D1Database, data: Record<string, unknown>, id?: string) {
  const itemId = id ?? crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO archive_items (id, type, title, date, link, committee_slug)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET type = excluded.type, title = excluded.title, date = excluded.date, link = excluded.link, committee_slug = excluded.committee_slug`,
    )
    .bind(
      itemId,
      String(data.type ?? ''),
      String(data.title ?? ''),
      String(data.date ?? ''),
      String(data.link ?? ''),
      data.committee_slug ?? null,
    )
    .run()
  return itemId
}

export async function deleteArchiveItem(db: D1Database, id: string) {
  await db.prepare('DELETE FROM archive_items WHERE id = ?').bind(id).run()
}

export async function getArchiveItemById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM archive_items WHERE id = ?').bind(id).first()
}

export async function listCarouselSlides(db: D1Database) {
  const { results } = await db
    .prepare('SELECT * FROM carousel_slides ORDER BY display_order, created_at')
    .all()
  return results ?? []
}

export const CAROUSEL_SORT_COLUMNS: SortColumnSql = {
  alt: 'alt_text COLLATE NOCASE',
  order: 'display_order',
  active: 'active',
}

export async function listCarouselSlidesPaginated(
  db: D1Database,
  page: number,
  sort?: SortSpec | null,
): Promise<PaginatedResult<Row>> {
  const order = sqlOrderBy(sort, CAROUSEL_SORT_COLUMNS, 'ORDER BY display_order, created_at')
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM carousel_slides',
    `SELECT * FROM carousel_slides ${order}`,
    page,
  )
}

export async function upsertCarouselSlide(db: D1Database, data: Record<string, unknown>, id?: string) {
  const slideId = id ?? crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO carousel_slides (id, image_r2_key, image_url, alt_text, link_url, display_order, active)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         image_r2_key = excluded.image_r2_key,
         image_url = excluded.image_url,
         alt_text = excluded.alt_text,
         link_url = excluded.link_url,
         display_order = excluded.display_order,
         active = excluded.active`,
    )
    .bind(
      slideId,
      data.image_r2_key ?? null,
      data.image_url ?? null,
      data.alt_text ?? null,
      data.link_url ?? null,
      Number(data.display_order ?? 0),
      Number(data.active ?? 1),
    )
    .run()
  return slideId
}

export async function deleteCarouselSlide(db: D1Database, id: string) {
  await db.prepare('DELETE FROM carousel_slides WHERE id = ?').bind(id).run()
}

export async function getCarouselSlideById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM carousel_slides WHERE id = ?').bind(id).first()
}

export async function listZeroDamages(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM zero_damages ORDER BY company').all()
  return results ?? []
}

export const ZERO_DAMAGE_SORT_COLUMNS: SortColumnSql = {
  company: 'company COLLATE NOCASE',
}

export async function listZeroDamagesPaginated(
  db: D1Database,
  page: number,
  sort?: SortSpec | null,
): Promise<PaginatedResult<Row>> {
  const order = sqlOrderBy(sort, ZERO_DAMAGE_SORT_COLUMNS, 'ORDER BY company')
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM zero_damages',
    `SELECT * FROM zero_damages ${order}`,
    page,
  )
}

export async function upsertZeroDamage(db: D1Database, company: string, id?: string) {
  const rowId = id ?? crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO zero_damages (id, company) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET company = excluded.company`,
    )
    .bind(rowId, company)
    .run()
  return rowId
}

export async function deleteZeroDamage(db: D1Database, id: string) {
  await db.prepare('DELETE FROM zero_damages WHERE id = ?').bind(id).run()
}

export async function getZeroDamageById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM zero_damages WHERE id = ?').bind(id).first()
}

export async function listQaItems(db: D1Database, publishedOnly = false) {
  let query = 'SELECT * FROM qa_items'
  if (publishedOnly) query += ' WHERE published = 1'
  query += ' ORDER BY sort_order, question'
  const { results } = await db.prepare(query).all()
  return results ?? []
}

export const QA_SORT_COLUMNS: SortColumnSql = {
  question: 'question COLLATE NOCASE',
  published: 'published',
}

export async function listQaItemsPaginated(
  db: D1Database,
  page: number,
  sort?: SortSpec | null,
): Promise<PaginatedResult<Row>> {
  const order = sqlOrderBy(sort, QA_SORT_COLUMNS, 'ORDER BY sort_order, question')
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM qa_items',
    `SELECT * FROM qa_items ${order}`,
    page,
  )
}

export async function upsertQaItem(db: D1Database, data: Record<string, unknown>, id?: string) {
  const qaId = id ?? crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO qa_items (id, question, answer_md, sort_order, published)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         question = excluded.question,
         answer_md = excluded.answer_md,
         sort_order = excluded.sort_order,
         published = excluded.published,
         updated_at = datetime('now')`,
    )
    .bind(
      qaId,
      String(data.question ?? ''),
      String(data.answer_md ?? ''),
      Number(data.sort_order ?? 0),
      Number(data.published ?? 1),
    )
    .run()
  return qaId
}

export async function deleteQaItem(db: D1Database, id: string) {
  await db.prepare('DELETE FROM qa_items WHERE id = ?').bind(id).run()
}

export async function getQaItemById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM qa_items WHERE id = ?').bind(id).first()
}

export async function listPages(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM pages ORDER BY slug').all()
  return results ?? []
}

export const PAGE_SORT_COLUMNS: SortColumnSql = {
  slug: 'slug COLLATE NOCASE',
  title: 'title COLLATE NOCASE',
  published: 'published',
}

export async function listPagesPaginated(
  db: D1Database,
  page: number,
  slugFilter?: string[],
  sort?: SortSpec | null,
): Promise<PaginatedResult<Row>> {
  const order = sqlOrderBy(sort, PAGE_SORT_COLUMNS, 'ORDER BY slug')
  if (slugFilter && slugFilter.length > 0) {
    const placeholders = slugFilter.map(() => '?').join(', ')
    return paginateQuery(
      db,
      `SELECT COUNT(*) as c FROM pages WHERE slug IN (${placeholders})`,
      `SELECT * FROM pages WHERE slug IN (${placeholders}) ${order}`,
      page,
      slugFilter,
    )
  }
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM pages',
    `SELECT * FROM pages ${order}`,
    page,
  )
}

export async function getPageBySlug(db: D1Database, slug: string, publishedOnly = false) {
  let query = 'SELECT * FROM pages WHERE slug = ?'
  if (publishedOnly) query += ' AND published = 1'
  return db.prepare(query).bind(slug).first()
}

export async function getPageById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first()
}

export async function upsertPage(db: D1Database, data: Record<string, unknown>, id?: string) {
  const pageId = id ?? crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO pages (id, slug, title, section_label, subtitle, body_md, body_json, body_html, regions_json, published, is_custom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         title = excluded.title,
         section_label = excluded.section_label,
         subtitle = excluded.subtitle,
         body_md = excluded.body_md,
         body_json = excluded.body_json,
         body_html = excluded.body_html,
         regions_json = excluded.regions_json,
         published = excluded.published,
         is_custom = excluded.is_custom,
         updated_at = datetime('now')`,
    )
    .bind(
      pageId,
      String(data.slug ?? ''),
      String(data.title ?? ''),
      data.section_label ?? null,
      data.subtitle ?? null,
      data.body_md ?? null,
      data.body_json ?? null,
      data.body_html ?? null,
      data.regions_json ?? null,
      Number(data.published ?? 1),
      Number(data.is_custom ?? 0),
    )
    .run()
  return pageId
}

export async function listCommitteesData(db: D1Database) {
  const committees = await db.prepare('SELECT * FROM committees ORDER BY name').all()
  const members = await db.prepare('SELECT * FROM committee_members ORDER BY name').all()
  const memberships = await db.prepare('SELECT * FROM committee_memberships').all()
  return {
    committees: committees.results ?? [],
    members: members.results ?? [],
    memberships: memberships.results ?? [],
  }
}
