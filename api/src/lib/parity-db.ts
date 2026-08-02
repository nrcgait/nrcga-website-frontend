import type { PaginatedResult } from './pagination'
import { paginateQuery } from './pagination'

type Row = Record<string, unknown>

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/* ---- Leadership ---- */

export async function listLeadership(db: D1Database, activeOnly = false) {
  let q = 'SELECT * FROM leadership'
  if (activeOnly) q += ' WHERE active = 1'
  q += ' ORDER BY sort_order, name'
  const { results } = await db.prepare(q).all()
  return results ?? []
}

export async function listLeadershipPaginated(db: D1Database, page: number): Promise<PaginatedResult<Row>> {
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM leadership',
    'SELECT * FROM leadership ORDER BY sort_order, name',
    page,
  )
}

export async function getLeadershipById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM leadership WHERE id = ?').bind(id).first()
}

export async function upsertLeadership(db: D1Database, data: Record<string, unknown>, id?: string) {
  const rowId = id ?? crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO leadership (id, name, title, bio, photo_url, photo_r2_key, sort_order, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         title = excluded.title,
         bio = excluded.bio,
         photo_url = excluded.photo_url,
         photo_r2_key = excluded.photo_r2_key,
         sort_order = excluded.sort_order,
         active = excluded.active,
         updated_at = datetime('now')`,
    )
    .bind(
      rowId,
      String(data.name ?? ''),
      String(data.title ?? ''),
      data.bio ?? null,
      data.photo_url ?? null,
      data.photo_r2_key ?? null,
      Number(data.sort_order ?? 0),
      Number(data.active ?? 1),
    )
    .run()
  return rowId
}

export async function deleteLeadership(db: D1Database, id: string) {
  await db.prepare('DELETE FROM leadership WHERE id = ?').bind(id).run()
}

/* ---- Resource links ---- */

export async function listResourceLinks(db: D1Database, activeOnly = false) {
  let q = 'SELECT * FROM resource_links'
  if (activeOnly) q += ' WHERE active = 1'
  q += ' ORDER BY sort_order, title'
  const { results } = await db.prepare(q).all()
  return results ?? []
}

export async function listResourceLinksPaginated(db: D1Database, page: number): Promise<PaginatedResult<Row>> {
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM resource_links',
    'SELECT * FROM resource_links ORDER BY sort_order, title',
    page,
  )
}

export async function getResourceLinkById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM resource_links WHERE id = ?').bind(id).first()
}

export async function upsertResourceLink(db: D1Database, data: Record<string, unknown>, id?: string) {
  const rowId = id ?? crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO resource_links (id, title, url, category, description, sort_order, active)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         url = excluded.url,
         category = excluded.category,
         description = excluded.description,
         sort_order = excluded.sort_order,
         active = excluded.active`,
    )
    .bind(
      rowId,
      String(data.title ?? ''),
      String(data.url ?? ''),
      data.category ?? null,
      data.description ?? null,
      Number(data.sort_order ?? 0),
      Number(data.active ?? 1),
    )
    .run()
  return rowId
}

export async function deleteResourceLink(db: D1Database, id: string) {
  await db.prepare('DELETE FROM resource_links WHERE id = ?').bind(id).run()
}

/* ---- Membership types ---- */

export async function listMembershipTypes(db: D1Database, activeOnly = false) {
  let q = 'SELECT * FROM membership_types'
  if (activeOnly) q += ' WHERE active = 1'
  q += ' ORDER BY sort_order, name'
  const { results } = await db.prepare(q).all()
  return results ?? []
}

export async function listMembershipTypesPaginated(db: D1Database, page: number): Promise<PaginatedResult<Row>> {
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM membership_types',
    'SELECT * FROM membership_types ORDER BY sort_order, name',
    page,
  )
}

export async function getMembershipTypeById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM membership_types WHERE id = ?').bind(id).first()
}

export async function upsertMembershipType(db: D1Database, data: Record<string, unknown>, id?: string) {
  const rowId = id ?? crypto.randomUUID()
  const name = String(data.name ?? '')
  const slug = String(data.slug ?? '') || slugify(name)
  await db
    .prepare(
      `INSERT INTO membership_types (id, name, slug, description, sort_order, active)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         slug = excluded.slug,
         description = excluded.description,
         sort_order = excluded.sort_order,
         active = excluded.active`,
    )
    .bind(rowId, name, slug, data.description ?? null, Number(data.sort_order ?? 0), Number(data.active ?? 1))
    .run()
  return rowId
}

export async function deleteMembershipType(db: D1Database, id: string) {
  await db.prepare('DELETE FROM membership_types WHERE id = ?').bind(id).run()
}

/* ---- Committees CRUD ---- */

export async function listCommitteesFull(db: D1Database) {
  const { results } = await db
    .prepare('SELECT * FROM committees ORDER BY COALESCE(sort_order, 0), name')
    .all()
  return results ?? []
}

export async function listCommitteesPaginated(db: D1Database, page: number): Promise<PaginatedResult<Row>> {
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM committees',
    'SELECT * FROM committees ORDER BY COALESCE(sort_order, 0), name',
    page,
  )
}

export async function getCommitteeById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM committees WHERE id = ?').bind(id).first()
}

export async function upsertCommittee(db: D1Database, data: Record<string, unknown>, id?: string) {
  const rowId = id ?? crypto.randomUUID()
  const name = String(data.name ?? '')
  const slug = String(data.slug ?? '') || slugify(name)
  await db
    .prepare(
      `INSERT INTO committees (id, slug, name, description, photo_url, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         name = excluded.name,
         description = excluded.description,
         photo_url = excluded.photo_url,
         sort_order = excluded.sort_order`,
    )
    .bind(
      rowId,
      slug,
      name,
      data.description ?? null,
      data.photo_url ?? null,
      Number(data.sort_order ?? 0),
    )
    .run()
  return rowId
}

export async function deleteCommittee(db: D1Database, id: string) {
  await db.prepare('DELETE FROM committee_memberships WHERE committee_id = ?').bind(id).run()
  await db.prepare('DELETE FROM committees WHERE id = ?').bind(id).run()
}

export async function listCommitteePeoplePaginated(db: D1Database, page: number): Promise<PaginatedResult<Row>> {
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM committee_members',
    'SELECT * FROM committee_members ORDER BY name',
    page,
  )
}

export async function getCommitteePersonById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM committee_members WHERE id = ?').bind(id).first()
}

export async function upsertCommitteePerson(db: D1Database, data: Record<string, unknown>, id?: string) {
  const rowId = id ?? crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO committee_members (id, name, company, email)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, company = excluded.company, email = excluded.email`,
    )
    .bind(rowId, String(data.name ?? ''), data.company ?? null, data.email ?? null)
    .run()
  return rowId
}

export async function deleteCommitteePerson(db: D1Database, id: string) {
  await db.prepare('DELETE FROM committee_memberships WHERE member_id = ?').bind(id).run()
  await db.prepare('DELETE FROM committee_members WHERE id = ?').bind(id).run()
}

export async function listMembershipsForPerson(db: D1Database, memberId: string) {
  const { results } = await db
    .prepare('SELECT committee_id, role FROM committee_memberships WHERE member_id = ?')
    .bind(memberId)
    .all()
  return results ?? []
}

export async function setPersonMemberships(
  db: D1Database,
  memberId: string,
  committeeIds: string[],
  role = 0,
) {
  await db.prepare('DELETE FROM committee_memberships WHERE member_id = ?').bind(memberId).run()
  for (const committeeId of committeeIds) {
    await db
      .prepare(
        'INSERT INTO committee_memberships (member_id, committee_id, role) VALUES (?, ?, ?)',
      )
      .bind(memberId, committeeId, role)
      .run()
  }
}

/* ---- Posts ---- */

export async function listPosts(db: D1Database, publishedOnly = false) {
  let q = 'SELECT * FROM posts'
  if (publishedOnly) q += ' WHERE published = 1'
  q += ' ORDER BY COALESCE(published_at, created_at) DESC, title'
  const { results } = await db.prepare(q).all()
  return results ?? []
}

export async function listPostsPaginated(db: D1Database, page: number): Promise<PaginatedResult<Row>> {
  return paginateQuery(
    db,
    'SELECT COUNT(*) as c FROM posts',
    'SELECT * FROM posts ORDER BY COALESCE(published_at, created_at) DESC, title',
    page,
  )
}

export async function getPostById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first()
}

export async function getPostBySlug(db: D1Database, slug: string, publishedOnly = false) {
  let q = 'SELECT * FROM posts WHERE slug = ?'
  if (publishedOnly) q += ' AND published = 1'
  return db.prepare(q).bind(slug).first()
}

export async function upsertPost(db: D1Database, data: Record<string, unknown>, id?: string) {
  const rowId = id ?? crypto.randomUUID()
  const title = String(data.title ?? '')
  const slug = String(data.slug ?? '') || slugify(title)
  const published = Number(data.published ?? 0)
  const publishedAt =
    data.published_at != null && String(data.published_at)
      ? String(data.published_at)
      : published
        ? new Date().toISOString()
        : null
  await db
    .prepare(
      `INSERT INTO posts (id, title, slug, excerpt, cover_url, cover_r2_key, body_html, pdf_url, pdf_r2_key, published, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         slug = excluded.slug,
         excerpt = excluded.excerpt,
         cover_url = excluded.cover_url,
         cover_r2_key = excluded.cover_r2_key,
         body_html = excluded.body_html,
         pdf_url = excluded.pdf_url,
         pdf_r2_key = excluded.pdf_r2_key,
         published = excluded.published,
         published_at = excluded.published_at,
         updated_at = datetime('now')`,
    )
    .bind(
      rowId,
      title,
      slug,
      data.excerpt ?? null,
      data.cover_url ?? null,
      data.cover_r2_key ?? null,
      data.body_html ?? null,
      data.pdf_url ?? null,
      data.pdf_r2_key ?? null,
      published,
      publishedAt,
    )
    .run()
  return rowId
}

export async function deletePost(db: D1Database, id: string) {
  await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run()
}

export { slugify }
