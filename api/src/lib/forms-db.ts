import type { PaginatedResult } from './pagination'
import { likePattern, paginateQuery } from './pagination'
import { sqlOrderBy, type SortColumnSql, type SortSpec } from './sort'

export const FORM_TYPES = [
  'contact',
  'member_application',
  'award_application',
  'training_registration',
  'training_signin',
  'newsletter',
] as const

export type FormType = (typeof FORM_TYPES)[number]

export const RESERVED_INBOX_SLUGS = [
  ...FORM_TYPES,
  'contact',
  'applications',
  'training',
  'newsletter',
  'submission',
  'new',
] as const

export const FORM_FIELD_TYPES = ['text', 'email', 'tel', 'url', 'textarea', 'select', 'checkbox'] as const
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export type FormFieldDef = {
  name: string
  label: string
  type: FormFieldType
  required?: boolean
  options?: string[]
  placeholder?: string
}

export type FormInboxInput = {
  title: string
  slug?: string | null
  description?: string | null
  fields: FormFieldDef[]
  submit_label?: string | null
  success_message?: string | null
  notify_email?: string | null
  active?: boolean
  sort_order?: number
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function isFormType(value: string): value is FormType {
  return (FORM_TYPES as readonly string[]).includes(value)
}

export function isReservedInboxSlug(slug: string): boolean {
  return (RESERVED_INBOX_SLUGS as readonly string[]).includes(slug)
}

export function parseFormFields(raw: unknown): FormFieldDef[] {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  const fields: FormFieldDef[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const name = String(row.name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_|_$/g, '')
    const label = String(row.label ?? '').trim()
    const typeRaw = String(row.type ?? 'text')
    const type = (FORM_FIELD_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as FormFieldType)
      : 'text'
    if (!name || name === 'website_url' || name === 'honeypot' || !label) continue
    const options =
      type === 'select' && Array.isArray(row.options)
        ? row.options.map((o) => String(o).trim()).filter(Boolean)
        : type === 'select' && typeof row.options === 'string'
          ? String(row.options)
              .split(/\n|,/)
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined
    fields.push({
      name,
      label,
      type,
      required: !!row.required,
      options,
      placeholder: row.placeholder ? String(row.placeholder).trim() : undefined,
    })
  }
  return fields
}

export function inboxToPublicSchema(row: Record<string, unknown>) {
  return {
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    description: row.description ? String(row.description) : null,
    fields: parseFormFields(row.fields_json),
    submit_label: String(row.submit_label ?? 'Submit'),
    success_message: String(row.success_message ?? 'Thank you — your submission was received.'),
  }
}

export async function createFormSubmission(
  db: D1Database,
  formType: string,
  payload: Record<string, unknown>,
) {
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO form_submissions (id, form_type, payload_json, status) VALUES (?, ?, ?, 'new')`,
    )
    .bind(id, formType, JSON.stringify(payload))
    .run()
  return id
}

export const SUBMISSION_SORT_COLUMNS: SortColumnSql = {
  date: 'created_at',
  type: 'form_type COLLATE NOCASE',
  status: 'status COLLATE NOCASE',
}

export async function listFormSubmissionsPaginated(
  db: D1Database,
  page: number,
  formType?: string,
  status?: string,
  sort?: SortSpec | null,
): Promise<PaginatedResult<Record<string, unknown>>> {
  if (formType) {
    return listFormSubmissionsPaginatedByTypes(db, page, [formType], status, false, sort)
  }
  return listFormSubmissionsPaginatedByTypes(db, page, [], status, true, sort)
}

export async function listFormSubmissionsPaginatedByTypes(
  db: D1Database,
  page: number,
  formTypes: string[],
  status?: string,
  allTypes = false,
  sort?: SortSpec | null,
): Promise<PaginatedResult<Record<string, unknown>>> {
  const clauses: string[] = []
  const binds: string[] = []
  if (!allTypes) {
    if (!formTypes.length) {
      return { items: [], page: 1, totalPages: 1, total: 0 }
    }
    const placeholders = formTypes.map(() => '?').join(', ')
    clauses.push(`form_type IN (${placeholders})`)
    binds.push(...formTypes)
  }
  if (status) {
    clauses.push('status = ?')
    binds.push(status)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const order = sqlOrderBy(sort, SUBMISSION_SORT_COLUMNS, 'ORDER BY created_at DESC')
  return paginateQuery(
    db,
    `SELECT COUNT(*) as c FROM form_submissions ${where}`,
    `SELECT * FROM form_submissions ${where} ${order}`,
    page,
    binds,
  )
}

export async function getFormSubmissionById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM form_submissions WHERE id = ?').bind(id).first()
}

export async function updateFormSubmissionStatus(db: D1Database, id: string, status: string) {
  await db.prepare('UPDATE form_submissions SET status = ? WHERE id = ?').bind(status, id).run()
}

export async function deleteFormSubmission(db: D1Database, id: string) {
  await db.prepare('DELETE FROM form_submissions WHERE id = ?').bind(id).run()
}

/** Counts of submissions with status `new`, keyed by form_type (built-in type or custom inbox slug). */
export async function countNewFormSubmissionsByType(db: D1Database): Promise<Record<string, number>> {
  const { results } = await db
    .prepare(
      `SELECT form_type, COUNT(*) as c FROM form_submissions WHERE status = 'new' GROUP BY form_type`,
    )
    .all<{ form_type: string; c: number }>()
  const map: Record<string, number> = {}
  for (const row of results ?? []) {
    map[String(row.form_type)] = Number(row.c) || 0
  }
  return map
}

export function sumNewSubmissionCounts(counts: Record<string, number>, formTypes: string[]): number {
  return formTypes.reduce((total, type) => total + (counts[type] ?? 0), 0)
}

/** Built-in training form types — counted on the Training card only, not the global inbox badge. */
export const TRAINING_FORM_TYPES = ['training_registration', 'training_signin'] as const

export async function countAllNewFormSubmissions(db: D1Database): Promise<number> {
  const placeholders = TRAINING_FORM_TYPES.map(() => '?').join(', ')
  const row = await db
    .prepare(
      `SELECT COUNT(*) as c FROM form_submissions
       WHERE status = 'new' AND form_type NOT IN (${placeholders})`,
    )
    .bind(...TRAINING_FORM_TYPES)
    .first<{ c: number }>()
  return Number(row?.c) || 0
}

export async function listFormInboxes(db: D1Database, activeOnly = false) {
  let q = 'SELECT * FROM form_inboxes'
  if (activeOnly) q += ' WHERE active = 1'
  q += ' ORDER BY sort_order, title'
  const { results } = await db.prepare(q).all()
  return results ?? []
}

export async function getFormInboxBySlug(db: D1Database, slug: string) {
  return db.prepare('SELECT * FROM form_inboxes WHERE slug = ?').bind(slug).first()
}

export async function getFormInboxById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM form_inboxes WHERE id = ?').bind(id).first()
}

export async function upsertFormInbox(db: D1Database, data: FormInboxInput, id?: string) {
  const title = data.title.trim()
  if (!title) throw new Error('Title is required.')
  let slug = (data.slug?.trim() ? slugify(data.slug) : slugify(title)) || 'form'
  if (isReservedInboxSlug(slug)) {
    throw new Error(`Slug "${slug}" is reserved. Choose a different name.`)
  }
  const fields = parseFormFields(data.fields)
  if (!fields.length) throw new Error('Add at least one form field.')
  const fieldsJson = JSON.stringify(fields)
  const submitLabel = (data.submit_label?.trim() || 'Submit').slice(0, 80)
  const successMessage =
    (data.success_message?.trim() || 'Thank you — your submission was received.').slice(0, 500)
  const notifyEmail = data.notify_email?.trim() || null
  const description = data.description?.trim() || null
  const active = data.active === false ? 0 : 1
  const sortOrder = Number.isFinite(data.sort_order) ? Number(data.sort_order) : 0

  if (id) {
    const existing = await getFormInboxById(db, id)
    if (!existing) throw new Error('Inbox not found.')
    const clash = await db
      .prepare('SELECT id FROM form_inboxes WHERE slug = ? AND id != ?')
      .bind(slug, id)
      .first()
    if (clash) throw new Error(`Slug "${slug}" is already in use.`)
    await db
      .prepare(
        `UPDATE form_inboxes
         SET slug = ?, title = ?, description = ?, fields_json = ?, submit_label = ?,
             success_message = ?, notify_email = ?, active = ?, sort_order = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(
        slug,
        title,
        description,
        fieldsJson,
        submitLabel,
        successMessage,
        notifyEmail,
        active,
        sortOrder,
        id,
      )
      .run()
    return id
  }

  const clash = await getFormInboxBySlug(db, slug)
  if (clash) throw new Error(`Slug "${slug}" is already in use.`)
  const newId = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO form_inboxes
       (id, slug, title, description, fields_json, submit_label, success_message, notify_email, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId,
      slug,
      title,
      description,
      fieldsJson,
      submitLabel,
      successMessage,
      notifyEmail,
      active,
      sortOrder,
    )
    .run()
  return newId
}

export async function deleteFormInbox(db: D1Database, id: string) {
  const row = await getFormInboxById(db, id)
  if (row?.slug) {
    await db.prepare('DELETE FROM inbox_user_assignments WHERE inbox_key = ?').bind(String(row.slug)).run()
  }
  await db.prepare('DELETE FROM form_inboxes WHERE id = ?').bind(id).run()
}

export async function upsertNewsletterSubscriber(
  db: D1Database,
  email: string,
  name?: string | null,
) {
  const normalized = email.toLowerCase().trim()
  const existing = await db
    .prepare('SELECT id FROM newsletter_subscribers WHERE email = ?')
    .bind(normalized)
    .first<{ id: string }>()
  if (existing) {
    await db
      .prepare(
        `UPDATE newsletter_subscribers SET name = COALESCE(?, name), status = 'active' WHERE id = ?`,
      )
      .bind(name ?? null, existing.id)
      .run()
    return existing.id
  }
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO newsletter_subscribers (id, email, name, status) VALUES (?, ?, ?, 'active')`,
    )
    .bind(id, normalized, name ?? null)
    .run()
  return id
}

export const NEWSLETTER_SORT_COLUMNS: SortColumnSql = {
  email: 'email COLLATE NOCASE',
  name: 'name COLLATE NOCASE',
  status: 'status COLLATE NOCASE',
  joined: 'created_at',
}

export async function listNewsletterPaginated(
  db: D1Database,
  page: number,
  search = '',
  sort?: SortSpec | null,
): Promise<PaginatedResult<Record<string, unknown>>> {
  const order = sqlOrderBy(sort, NEWSLETTER_SORT_COLUMNS, 'ORDER BY created_at DESC')
  const term = search.trim()
  if (!term) {
    return paginateQuery(
      db,
      'SELECT COUNT(*) as c FROM newsletter_subscribers',
      `SELECT * FROM newsletter_subscribers ${order}`,
      page,
    )
  }
  const pattern = likePattern(term)
  return paginateQuery(
    db,
    `SELECT COUNT(*) as c FROM newsletter_subscribers WHERE email LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\'`,
    `SELECT * FROM newsletter_subscribers WHERE email LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' ${order}`,
    page,
    [pattern, pattern],
  )
}

export async function listAllNewsletterSubscribers(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT email, name, status, created_at FROM newsletter_subscribers WHERE status = 'active' ORDER BY created_at DESC`,
    )
    .all()
  return results ?? []
}

export async function updateNewsletterStatus(db: D1Database, id: string, status: string) {
  await db.prepare('UPDATE newsletter_subscribers SET status = ? WHERE id = ?').bind(status, id).run()
}

export async function deleteNewsletterSubscriber(db: D1Database, id: string) {
  await db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').bind(id).run()
}

export function validateSchemaPayload(
  fields: FormFieldDef[],
  body: Record<string, unknown>,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (body.website_url || body.honeypot) {
    return { ok: false, error: 'Rejected.' }
  }
  if (!fields.length) return { ok: false, error: 'Form has no fields configured.' }

  const payload: Record<string, unknown> = {}
  for (const field of fields) {
    const raw = body[field.name]
    if (field.type === 'checkbox') {
      const checked =
        raw === true ||
        raw === 1 ||
        raw === '1' ||
        raw === 'on' ||
        raw === 'true' ||
        raw === 'yes'
      if (field.required && !checked) {
        return { ok: false, error: `${field.label} is required.` }
      }
      payload[field.name] = checked
      continue
    }

    const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim()
    if (field.required && !value) {
      return { ok: false, error: `${field.label} is required.` }
    }
    if (field.type === 'email' && value && !value.includes('@')) {
      return { ok: false, error: `${field.label} must be a valid email.` }
    }
    if (field.type === 'select' && value && field.options?.length && !field.options.includes(value)) {
      return { ok: false, error: `${field.label} has an invalid option.` }
    }
    payload[field.name] = value
  }
  return { ok: true, payload }
}

export function validateFormPayload(
  formType: FormType,
  body: Record<string, unknown>,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (body.website_url || body.honeypot) {
    return { ok: false, error: 'Rejected.' }
  }

  const str = (key: string) => (typeof body[key] === 'string' ? String(body[key]).trim() : '')

  switch (formType) {
    case 'contact': {
      const name = str('name')
      const email = str('email')
      const message = str('message')
      if (!name || !email || !message) return { ok: false, error: 'Name, email, and message are required.' }
      return {
        ok: true,
        payload: {
          name,
          email,
          phone: str('phone'),
          subject: str('subject'),
          message,
          organization: str('organization'),
        },
      }
    }
    case 'newsletter': {
      const email = str('email')
      if (!email || !email.includes('@')) return { ok: false, error: 'A valid email is required.' }
      return { ok: true, payload: { email, name: str('name') } }
    }
    case 'member_application': {
      const company = str('company_name')
      const contact = str('contact_name')
      const email = str('email')
      const membershipType = str('membership_type')
      if (!company || !contact || !email) {
        return { ok: false, error: 'Company, contact name, and email are required.' }
      }
      if (!membershipType) {
        return { ok: false, error: 'Membership type is required.' }
      }
      return {
        ok: true,
        payload: {
          company_name: company,
          contact_name: contact,
          email,
          phone: str('phone'),
          website: str('website'),
          membership_type: membershipType,
          stakeholder_group: str('stakeholder_group'),
          notes: str('notes'),
        },
      }
    }
    case 'award_application': {
      const nominee = str('nominee_name')
      const email = str('email')
      if (!nominee || !email) return { ok: false, error: 'Nominee name and email are required.' }
      return {
        ok: true,
        payload: {
          nominee_name: nominee,
          nominator_name: str('nominator_name'),
          email,
          phone: str('phone'),
          organization: str('organization'),
          award: str('award') || 'Craig Rogers Award',
          statement: str('statement'),
        },
      }
    }
    case 'training_registration':
    case 'training_signin': {
      const name = str('name')
      const email = str('email')
      if (!name || !email) return { ok: false, error: 'Name and email are required.' }
      return {
        ok: true,
        payload: {
          name,
          email,
          phone: str('phone'),
          organization: str('organization'),
          company: str('company'),
          training_date: str('training_date'),
          notes: str('notes'),
        },
      }
    }
    default:
      return { ok: false, error: 'Unknown form type.' }
  }
}

/** Parse field rows posted from the inbox schema editor. */
export function parseInboxFieldsFromBody(body: Record<string, string | File>): FormFieldDef[] {
  const names = Object.keys(body)
    .map((k) => /^field_name_(\d+)$/.exec(k))
    .filter(Boolean)
    .map((m) => Number((m as RegExpExecArray)[1]))
    .sort((a, b) => a - b)

  const fields: FormFieldDef[] = []
  for (const i of names) {
    const name = String(body[`field_name_${i}`] ?? '')
    const label = String(body[`field_label_${i}`] ?? '')
    const type = String(body[`field_type_${i}`] ?? 'text')
    const required = body[`field_required_${i}`] === '1' || body[`field_required_${i}`] === 'on'
    const optionsRaw = String(body[`field_options_${i}`] ?? '')
    const placeholder = String(body[`field_placeholder_${i}`] ?? '')
    fields.push(
      ...parseFormFields([
        {
          name,
          label,
          type,
          required,
          options: optionsRaw,
          placeholder,
        },
      ]),
    )
  }
  return fields
}
