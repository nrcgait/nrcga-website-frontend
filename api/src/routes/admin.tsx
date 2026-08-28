import type { Hono } from 'hono'
import type { Env } from '../env'
import type { UserRole } from '../config/roles'
import {
  canAccessContentSection,
  canAccessEventsSection,
  canAccessAssets,
  canAccessInboxesSection,
  canEditOwnMember,
  canManageMembers,
  canManageNavigation,
  canManageUsers,
  ROLE_LABELS,
} from '../config/roles'
import {
  assignChairCommittees,
  createUser,
  ensureBootstrapAdmin,
  findUserLinkedToMember,
  listChairCommittees,
  listUsersPaginated,
  updateUser,
  verifyUserLogin,
  USER_SORT_COLUMNS,
} from '../lib/auth'
import { loadAdminContext, escapeHtml, type AdminContext } from '../lib/admin-context'
import {
  checkBoardMemberConflict,
  checkOfficerConflicts,
  deleteMember,
  getMemberById,
  listCommittees,
  listMembersPaginated,
  listStakeholderMembers,
  upsertMember,
  MEMBER_SORT_COLUMNS,
} from '../lib/content-db'
import {
  cancelEventOccurrence,
  cancelEventSeries,
  createEvent,
  deleteEvent,
  getEventById,
  listAllEventsPaginated,
  listCancelledOccurrences,
  uncancelEventOccurrence,
  uncancelEventSeries,
  updateEvent,
  type EventListFilter,
  EVENT_SORT_COLUMNS,
  CANCELLATION_SORT_COLUMNS,
} from '../lib/events-db'
import {
  canEditEvent,
  canViewEvents,
  defaultCategoryForNewEvent,
  resolveEventCategory,
  validateEventAssignment,
} from '../lib/permissions'
import { registerAdminAssetRoutes } from './admin-assets'
import { deleteRegistration, listRegistrationsPaginated, REGISTRATION_SORT_COLUMNS } from '../lib/event-registrations'
import {
  getBreakingNews,
  getContactInfo,
  getFooterInfo,
  getNavigation,
  getThemeSettings,
  setSetting,
  type BreakingNewsItem,
  type BreakingNewsSettings,
} from '../lib/site-settings'
import { notifyCancelledGuests } from './api'
import { registerAdminContentRoutes } from './admin-content'
import { registerAdminParityRoutes } from './admin-parity'
import {
  clearSessionCookieHeader,
  createSessionToken,
  readSessionCookie,
  sessionCookieHeader,
  verifySessionToken,
} from '../lib/session'
import { combineDateTime, formatEventDateTime, splitDateTime, toDateInputValue } from '../lib/event-datetime'
import { parsePageParam, parseSearchParam } from '../lib/pagination'
import { parseSortParam, sortParams } from '../lib/sort'
import {
  geocodeNevadaAddress,
  geocodeNevadaAddressCandidates,
  parseManualCoordinates,
  resolveEventFormCoordinates,
} from '../lib/geocode'
import {
  clientIp,
  consumeRateLimits,
  LOGIN_RATE_LIMIT_MESSAGE,
  rateLimitHeaders,
} from '../lib/rate-limit'
import { AdminShell, LoginPage } from '../views/AdminShell'
import { AssetUrlField, Pagination, CommitteeSelect, ListSearch, SortableHead } from '../views/AdminComponents'
import { MemberForm, UserForm } from '../views/MemberForm'

async function requireAdmin(c: { env: Env; req: { header: (name: string) => string | undefined } }) {
  await ensureBootstrapAdmin(c.env)
  const token = readSessionCookie(c.req.header('Cookie'))
  const session = await verifySessionToken(token, c.env)
  if (!session) return null
  return loadAdminContext(c.env, session.sub)
}

function redirect(c: { redirect: (url: string, status?: 303) => Response }, url: string) {
  return c.redirect(url, 303)
}

function parseBreakingNewsForm(body: Record<string, string | File>): BreakingNewsSettings {
  const count = parseInt(String(body.breaking_item_count ?? '0'), 10)
  const items: BreakingNewsItem[] = []
  for (let i = 0; i < count; i++) {
    const prefix = `breaking_item_${i}_`
    const idRaw = body[`${prefix}id`]
    const id = typeof idRaw === 'string' && idRaw.trim() ? idRaw.trim() : crypto.randomUUID()
    const expiresRaw = body[`${prefix}expires_at`]
    items.push({
      id,
      active: body[`${prefix}active`] === '1',
      title: String(body[`${prefix}title`] ?? ''),
      content: String(body[`${prefix}content`] ?? ''),
      image_url: String(body[`${prefix}image_url`] ?? ''),
      read_more_url: String(body[`${prefix}read_more_url`] ?? ''),
      storage_key: String(body[`${prefix}storage_key`] || `nrcga_breaking_news_${id}`),
      expires_at: typeof expiresRaw === 'string' && expiresRaw.trim() ? expiresRaw.trim() : null,
    })
  }
  return { items }
}

function BreakingNewsItemFields({ item, index }: { item: BreakingNewsItem; index: number }) {
  const prefix = `breaking_item_${index}_`
  return (
    <fieldset class="admin-breaking-news-item admin-fieldset" data-breaking-index={String(index)}>
      <legend>Entry {index + 1}</legend>
      <input type="hidden" name={`${prefix}id`} value={item.id} />
      <label class="admin-checkbox-label">
        <input type="checkbox" name={`${prefix}active`} value="1" checked={item.active} /> Active
      </label>
      <label>Title</label>
      <input name={`${prefix}title`} value={item.title} />
      <label>Content</label>
      <textarea name={`${prefix}content`}>{item.content}</textarea>
      <AssetUrlField label="Image URL" name={`${prefix}image_url`} value={item.image_url} />
      <label>Read more URL</label>
      <input name={`${prefix}read_more_url`} value={item.read_more_url} />
      <label>Dismiss storage key</label>
      <input
        name={`${prefix}storage_key`}
        value={item.storage_key}
        placeholder={`nrcga_breaking_news_${item.id}`}
      />
      <p class="admin-muted">Use a unique key per entry so visitors can dismiss one announcement without hiding others.</p>
      <button type="button" class="btn btn-secondary btn-sm admin-breaking-remove">
        Remove entry
      </button>
    </fieldset>
  )
}

function canEditMember(ctx: AdminContext, memberId: string): boolean {
  if (canManageMembers(ctx.user.role)) return true
  return canEditOwnMember(ctx.user.role) && ctx.user.member_id === memberId
}

function parseMemberForm(body: Record<string, string | File>) {
  return {
    type: String(body.type ?? ''),
    company_name: body.company_name,
    stakeholder_group: body.stakeholder_group || null,
    voting_member: body.voting_member,
    website: body.website,
    category: body.category,
    term: body.term,
    contact_person: body.contact_person,
    active: body.active === '1' ? 1 : 0,
    is_board_member: body.is_board_member === '1' ? 1 : 0,
    is_chair: body.is_chair === '1' ? 1 : 0,
    is_vice_chair: body.is_vice_chair === '1' ? 1 : 0,
  }
}

async function memberValidationError(
  db: D1Database,
  data: ReturnType<typeof parseMemberForm>,
  memberId?: string,
): Promise<string | undefined> {
  if (data.type !== 'Stakeholder' && data.type !== 'Associate') {
    return 'Member type must be Stakeholder or Associate. Officers and directors are set with checkboxes on stakeholder members.'
  }
  if (data.type === 'Associate' && (data.is_board_member === 1 || data.is_chair === 1 || data.is_vice_chair === 1)) {
    return 'Only stakeholder members can be board members or officers.'
  }
  if (data.type === 'Stakeholder' && !data.stakeholder_group) {
    return 'Stakeholder members require a stakeholder group.'
  }

  const boardConflict = await checkBoardMemberConflict(
    db,
    data.stakeholder_group as string | null,
    data.is_board_member === 1,
    memberId,
  )
  if (boardConflict) {
    return `${boardConflict.existingCompanyName} is already the board member for this stakeholder group.`
  }

  const officerConflict = await checkOfficerConflicts(db, data.is_chair === 1, data.is_vice_chair === 1, memberId)
  if (officerConflict === 'both') {
    return 'A member cannot be both Chair and Vice Chair.'
  }
  if (officerConflict) {
    return `${officerConflict.existingCompanyName} is already marked as ${officerConflict.position}.`
  }

  return undefined
}

function parseEventForm(body: Record<string, string | File>) {
  const starts_at = combineDateTime(String(body.start_date ?? ''), String(body.start_time ?? ''))
  const endDate = String(body.end_date ?? '')
  const ends_at = endDate ? combineDateTime(endDate, String(body.end_time ?? '')) : null

  return {
    title: String(body.title ?? ''),
    starts_at,
    ends_at,
    location: body.location ? String(body.location) : null,
    description: body.description ? String(body.description) : null,
    category: (body.category === 'training' ? 'training' : 'general') as 'general' | 'training',
    published: body.published === '1' ? 1 : 0,
    repeat_rule: body.repeat_rule ? String(body.repeat_rule) : null,
    repeat_interval_days: body.repeat_interval_days ? Number(body.repeat_interval_days) : null,
    repeat_until: body.repeat_until ? String(body.repeat_until) : null,
    registration_enabled: body.registration_enabled === '1' ? 1 : 0,
    capacity: body.capacity ? Number(body.capacity) : null,
    capacity_scope: (body.capacity_scope === 'series' ? 'series' : 'occurrence') as 'occurrence' | 'series',
    registration_cutoff_hours: Number(body.registration_cutoff_hours ?? 0),
    latitude: body.latitude ? Number(body.latitude) : null,
    longitude: body.longitude ? Number(body.longitude) : null,
    skip_map: body.map_skip === '1',
  }
}

function parseCommitteeSlugs(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

function eventListFilter(ctx: AdminContext): EventListFilter | undefined {
  if (ctx.user.role === 'admin') return undefined
  if (ctx.user.role === 'trainer') return { category: 'training' }
  if (ctx.user.role === 'chair') return { committeeSlugs: ctx.chairCommittees }
  return undefined
}

function buildEventInput(
  ctx: AdminContext,
  body: Record<string, string | File>,
  coords: { latitude: number | null; longitude: number | null },
) {
  const committee_slug = String(body.committee_slug ?? '')
  const category = resolveEventCategory(committee_slug, String(body.category ?? ''), ctx)
  const parsed = parseEventForm(body)
  return {
    title: parsed.title,
    starts_at: parsed.starts_at,
    ends_at: parsed.ends_at,
    location: parsed.location,
    description: parsed.description,
    category,
    committee_slug: committee_slug || null,
    published: parsed.published,
    repeat_rule: parsed.repeat_rule,
    repeat_interval_days: parsed.repeat_interval_days,
    repeat_until: parsed.repeat_until,
    registration_enabled: parsed.registration_enabled,
    capacity: parsed.capacity,
    capacity_scope: parsed.capacity_scope,
    registration_cutoff_hours: parsed.registration_cutoff_hours,
    latitude: coords.latitude,
    longitude: coords.longitude,
  }
}

async function resolveCoordsFromBody(
  body: Record<string, string | File>,
  existing?: Awaited<ReturnType<typeof getEventById>>,
) {
  const parsed = parseEventForm(body)
  return resolveEventFormCoordinates(parsed.location, {
    existing: existing
      ? {
          location: existing.location,
          latitude: existing.latitude ?? null,
          longitude: existing.longitude ?? null,
        }
      : null,
    manual: parseManualCoordinates(body.latitude, body.longitude),
    skipMap: parsed.skip_map,
  })
}

export function registerAdminRoutes(app: Hono<{ Bindings: Env }>) {
  app.get('/admin.css', async (c) => c.env.ASSETS.fetch(new URL('/admin.css', c.req.url)))
  app.get('/page-blocks-editor.js', async (c) => c.env.ASSETS.fetch(new URL('/page-blocks-editor.js', c.req.url)))
  app.get('/page-blocks-render.js', async (c) => c.env.ASSETS.fetch(new URL('/page-blocks-render.js', c.req.url)))
  app.get('/page-preview.js', async (c) => c.env.ASSETS.fetch(new URL('/page-preview.js', c.req.url)))
  app.get('/page-block-inspector.js', async (c) => c.env.ASSETS.fetch(new URL('/page-block-inspector.js', c.req.url)))
  app.get('/admin-forms.js', async (c) => c.env.ASSETS.fetch(new URL('/admin-forms.js', c.req.url)))
  app.get('/asset-picker.js', async (c) => c.env.ASSETS.fetch(new URL('/asset-picker.js', c.req.url)))
  app.get('/admin-breaking-news.js', async (c) =>
    c.env.ASSETS.fetch(new URL('/admin-breaking-news.js', c.req.url)),
  )
  app.get('/navigation-editor.js', async (c) => c.env.ASSETS.fetch(new URL('/navigation-editor.js', c.req.url)))
  app.get('/event-location-picker.js', async (c) =>
    c.env.ASSETS.fetch(new URL('/event-location-picker.js', c.req.url)),
  )
  app.get('/inbox-schema-editor.js', async (c) =>
    c.env.ASSETS.fetch(new URL('/inbox-schema-editor.js', c.req.url)),
  )

  app.get('/admin/api/geocode', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return c.json({ ok: false, error: 'Unauthorized' }, 401)
    const address = c.req.query('address')?.trim() ?? ''
    if (!address) return c.json({ ok: false, error: 'Address required' }, 400)
    if (c.req.query('suggest') === '1') {
      const candidates = await geocodeNevadaAddressCandidates(address).catch(() => [])
      return c.json({
        ok: true,
        candidates: candidates.map((candidate) => ({
          formatted: candidate.formatted,
          latitude: candidate.lat,
          longitude: candidate.lng,
        })),
      })
    }
    const result = await geocodeNevadaAddress(address).catch(() => null)
    if (!result) return c.json({ ok: false })
    return c.json({
      ok: true,
      latitude: result.lat,
      longitude: result.lng,
      formatted: result.formatted,
    })
  })

  app.get('/admin/login', async (c) => c.html(<LoginPage />))

  app.post('/admin/login', async (c) => {
    await ensureBootstrapAdmin(c.env)
    const body = await c.req.parseBody()
    const email = typeof body.email === 'string' ? body.email : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const loginKeys = [`ip:${clientIp(c)}`]
    const normalizedEmail = email.toLowerCase().trim()
    if (normalizedEmail) loginKeys.push(`email:${normalizedEmail}`)
    const allowed = await consumeRateLimits(c.env.LOGIN_RATE_LIMITER, loginKeys)
    if (!allowed) {
      return c.html(<LoginPage error={LOGIN_RATE_LIMIT_MESSAGE} />, 429, rateLimitHeaders())
    }
    const user = await verifyUserLogin(c.env, email, password)
    if (!user) return c.html(<LoginPage error="Invalid email or password." />)
    const token = await createSessionToken(user.id, user.role, c.env)
    return new Response(null, {
      status: 303,
      headers: { Location: '/admin', 'Set-Cookie': sessionCookieHeader(token) },
    })
  })

  app.get('/admin/logout', async (c) => {
    return new Response(null, {
      status: 303,
      headers: { Location: '/admin/login', 'Set-Cookie': clearSessionCookieHeader() },
    })
  })

  app.get('/admin', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx) return redirect(c, '/admin/login')
    return c.html(
      <AdminShell ctx={ctx} title="Dashboard" activePath="/admin" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <div class="admin-card-grid">
          {canManageMembers(ctx.user.role) || (ctx.user.member_id && canEditOwnMember(ctx.user.role)) ? (
            <a
              class="admin-card"
              href={ctx.user.member_id && !canManageMembers(ctx.user.role) ? `/admin/members/${ctx.user.member_id}/edit` : '/admin/members'}
            >
              <h3>Members</h3>
              <p>
                {canManageMembers(ctx.user.role)
                  ? 'Stakeholder and associate member companies'
                  : 'Edit your organization profile'}
              </p>
            </a>
          ) : null}
          {canAccessEventsSection(ctx.user.role, ctx.chairCommittees) ? (
            <a class="admin-card" href="/admin/events">
              <h3>Events</h3>
              <p>
                {ctx.user.role === 'trainer'
                  ? 'Training schedule and registrations'
                  : ctx.user.role === 'chair'
                    ? 'Committee events and registrations'
                    : 'Calendar, training schedule, registrations'}
              </p>
            </a>
          ) : null}
          {canAccessContentSection(ctx.user.role, ctx.chairCommittees) ? (
            <a class="admin-card" href="/admin/content">
              <h3>Content</h3>
              <p>{ctx.user.role === 'chair' ? 'Programs, pages, and archive for your committees' : 'Carousel, archive, programs, pages'}</p>
            </a>
          ) : null}
          {canAccessAssets(ctx.user.role) ? (
            <a class="admin-card" href="/admin/assets">
              <h3>Assets</h3>
              <p>Upload and manage files stored in R2</p>
            </a>
          ) : null}
          {canManageUsers(ctx.user.role) ? (
            <a class="admin-card" href="/admin/users">
              <h3>Users & roles</h3>
              <p>Staff portal accounts</p>
            </a>
          ) : null}
          {canAccessInboxesSection(ctx.user.role, ctx.assignedInboxKeys) ? (
            <a class="admin-card" href="/admin/inbox">
              <h3>
                <span>Inboxes</span>
                {ctx.inboxNewCount > 0 ? (
                  <span class="inbox-count" aria-label={`${ctx.inboxNewCount} new`}>
                    {ctx.inboxNewCount > 99 ? '99+' : ctx.inboxNewCount}
                  </span>
                ) : null}
              </h3>
              <p>
                Form submissions assigned to you
                {ctx.inboxNewCount > 0
                  ? ` · ${ctx.inboxNewCount === 1 ? '1 new' : `${ctx.inboxNewCount} new`}`
                  : ''}
              </p>
            </a>
          ) : null}
          {canManageNavigation(ctx.user.role) ? (
            <a class="admin-card" href="/admin/navigation">
              <h3>Navigation</h3>
              <p>Site menu and logo</p>
            </a>
          ) : null}
          <a class="admin-card" href="/admin/profile">
            <h3>My profile</h3>
            <p>Change your password</p>
          </a>
        </div>
      </AdminShell>,
    )
  })

  app.get('/admin/members', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageMembers(ctx.user.role)) return redirect(c, '/admin/login')
    const page = parsePageParam(c.req.query('page'))
    const search = parseSearchParam(c.req.query('q'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), MEMBER_SORT_COLUMNS)
    const result = await listMembersPaginated(c.env.DB, page, search, sort)
    const listParams = sortParams(sort)
    return c.html(
      <AdminShell ctx={ctx} title="Members" activePath="/admin/members" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/members/new">
            Add member
          </a>
        </p>
        <ListSearch
          action="/admin/members"
          query={search}
          placeholder="Search by company, type, group, or contact…"
          params={listParams}
        />
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath="/admin/members"
            search={search}
            params={listParams}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'company', label: 'Company' },
              { key: 'group', label: 'Group' },
              { key: 'board', label: 'Board' },
              { key: 'officer', label: 'Officer' },
              { key: 'contact', label: 'Contact' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colspan={7} class="muted">
                  {search ? 'No members match your search.' : 'No members yet.'}
                </td>
              </tr>
            ) : (
              result.items.map((m) => (
                <tr>
                  <td>{escapeHtml(String(m.type ?? ''))}</td>
                  <td>{escapeHtml(String(m.company_name ?? ''))}</td>
                  <td>{escapeHtml(String(m.stakeholder_group ?? ''))}</td>
                  <td>{m.is_board_member ? 'Yes' : ''}</td>
                  <td>
                    {m.is_chair ? 'Chair' : ''}
                    {m.is_chair && m.is_vice_chair ? ', ' : ''}
                    {m.is_vice_chair ? 'Vice Chair' : ''}
                  </td>
                  <td>{escapeHtml(String(m.contact_person ?? ''))}</td>
                  <td>
                    <a href={`/admin/members/${m.id}/edit`}>Edit</a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath="/admin/members"
          search={search}
          params={listParams}
        />
      </AdminShell>,
    )
  })

  app.all('/admin/members/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageMembers(ctx.user.role)) return redirect(c, '/admin/login')
    let error: string | undefined
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      const data = parseMemberForm(body as Record<string, string | File>)
      const errorMsg = await memberValidationError(c.env.DB, data)
      if (errorMsg) {
        error = errorMsg
      } else {
        await upsertMember(c.env.DB, data)
        return redirect(c, '/admin/members')
      }
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add member" activePath="/admin/members" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <MemberForm error={error} />
      </AdminShell>,
    )
  })

  app.all('/admin/members/:id/edit', async (c) => {
    const ctx = await requireAdmin(c)
    const memberId = c.req.param('id')
    if (!ctx || !canEditMember(ctx, memberId)) return redirect(c, '/admin/login')
    const member = await getMemberById(c.env.DB, memberId)
    if (!member) return c.text('Not found', 404)
    const isOwnOrg = ctx.user.member_id === memberId
    let error: string | undefined
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        if (!canManageMembers(ctx.user.role)) return c.text('Forbidden', 403)
        await deleteMember(c.env.DB, memberId)
        return redirect(c, '/admin/members')
      }
      const data = parseMemberForm(body as Record<string, string | File>)
      if (isOwnOrg && !canManageMembers(ctx.user.role)) {
        data.type = String(member.type)
        data.stakeholder_group = member.stakeholder_group as string | null
        data.is_board_member = Number(member.is_board_member ?? 0)
        data.is_chair = Number(member.is_chair ?? 0)
        data.is_vice_chair = Number(member.is_vice_chair ?? 0)
      }
      const errorMsg = await memberValidationError(c.env.DB, data, memberId)
      if (errorMsg) {
        error = errorMsg
      } else {
        await upsertMember(c.env.DB, data, memberId)
        return redirect(c, isOwnOrg ? `/admin/members/${memberId}/edit` : '/admin/members')
      }
    }
    return c.html(
      <AdminShell
        ctx={ctx}
        title={isOwnOrg ? 'My organization' : 'Edit member'}
        activePath={isOwnOrg ? `/admin/members/${memberId}/edit` : '/admin/members'}
        publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}
      >
        <MemberForm member={member as Record<string, unknown>} error={error} readOnlyType={isOwnOrg && !canManageMembers(ctx.user.role)} />
      </AdminShell>,
    )
  })

  app.get('/admin/events', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return redirect(c, '/admin/login')
    const page = parsePageParam(c.req.query('page'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), EVENT_SORT_COLUMNS)
    const result = await listAllEventsPaginated(c.env.DB, page, eventListFilter(ctx), sort)
    const listParams = sortParams(sort)
    return c.html(
      <AdminShell ctx={ctx} title="Events" activePath="/admin/events" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/events/new">
            Add event
          </a>
        </p>
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath="/admin/events"
            params={listParams}
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'starts', label: 'Starts', defaultDir: 'desc' },
              { key: 'committee', label: 'Committee' },
              { key: 'category', label: 'Category' },
              { key: 'registration', label: 'Registration' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.map((e) => (
              <tr>
                <td>
                  {escapeHtml(e.title)}
                  {e.cancelled_at ? <span class="muted"> (Cancelled)</span> : null}
                </td>
                <td>{escapeHtml(formatEventDateTime(e.starts_at))}</td>
                <td>{escapeHtml(e.committee_slug ?? '—')}</td>
                <td>{escapeHtml(e.category)}</td>
                <td>{e.registration_enabled ? 'Yes' : 'No'}</td>
                <td>
                  <a href={`/admin/events/${e.id}/edit`}>Edit</a> ·{' '}
                  <a href={`/admin/events/${e.id}/registrations`}>Registrations</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath="/admin/events"
          params={listParams}
        />
      </AdminShell>,
    )
  })

  app.all('/admin/events/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return redirect(c, '/admin/login')
    const committees = await listCommittees(c.env.DB)
    let error: string | undefined
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      const coords = await resolveCoordsFromBody(body as Record<string, string | File>)
      const input = buildEventInput(ctx, body as Record<string, string | File>, coords)
      error = validateEventAssignment(ctx, String(input.committee_slug ?? ''), input.category) ?? undefined
      if (!error) {
        await createEvent(c.env.DB, input)
        return redirect(c, '/admin/events')
      }
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add event" activePath="/admin/events" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <EventForm ctx={ctx} committees={committees as Array<{ slug: string; name: string }>} error={error} />
      </AdminShell>,
    )
  })

  app.all('/admin/events/:id/edit', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return redirect(c, '/admin/login')
    const event = await getEventById(c.env.DB, c.req.param('id'))
    if (!event) return c.text('Not found', 404)
    if (!canEditEvent(ctx, event)) return c.text('Forbidden', 403)
    const committees = await listCommittees(c.env.DB)
    let error: string | undefined
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteEvent(c.env.DB, event.id)
        return redirect(c, '/admin/events')
      }
      const coords = await resolveCoordsFromBody(body as Record<string, string | File>, event)
      const input = buildEventInput(ctx, body as Record<string, string | File>, coords)
      error = validateEventAssignment(ctx, String(input.committee_slug ?? ''), input.category) ?? undefined
      if (!error) {
        await updateEvent(c.env.DB, event.id, input)
        return redirect(c, '/admin/events')
      }
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit event" activePath="/admin/events" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <EventForm ctx={ctx} committees={committees as Array<{ slug: string; name: string }>} event={event} error={error} />
        {event.cancelled_at ? (
          <form method="post" action={`/admin/events/${event.id}/uncancel-series`} class="admin-form admin-form-compact">
            <h3>This series is cancelled</h3>
            <p class="muted">
              It is hidden from the public calendar
              {event.cancellation_message ? ` — ${event.cancellation_message}` : ''}.
              Uncancelling does not restore individually cancelled dates.
            </p>
            <div class="admin-actions">
              <button class="btn btn-primary" type="submit">
                Uncancel series
              </button>
            </div>
          </form>
        ) : (
          <form method="post" class="admin-form admin-form-compact">
            <input type="hidden" name="_action" value="cancel_series" />
            <label>Cancellation message (optional)</label>
            <textarea name="cancellation_message" />
            <label>
              <input type="checkbox" name="notify_guests" value="1" /> Notify registered guests
            </label>
            <div class="admin-actions">
              <button class="btn btn-danger" type="submit" formaction={`/admin/events/${event.id}/cancel-series`}>
                Cancel entire series
              </button>
            </div>
          </form>
        )}
      </AdminShell>,
    )
  })

  app.post('/admin/events/:id/cancel-series', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return redirect(c, '/admin/login')
    const event = await getEventById(c.env.DB, c.req.param('id'))
    if (!event || !canEditEvent(ctx, event)) return c.text('Forbidden', 403)
    const body = await c.req.parseBody()
    const message = typeof body.cancellation_message === 'string' ? body.cancellation_message : undefined
    await cancelEventSeries(c.env.DB, c.req.param('id'), message)
    if (body.notify_guests === '1') await notifyCancelledGuests(c.env, c.req.param('id'), null, message)
    return redirect(c, '/admin/events')
  })

  app.post('/admin/events/:id/uncancel-series', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return redirect(c, '/admin/login')
    const event = await getEventById(c.env.DB, c.req.param('id'))
    if (!event || !canEditEvent(ctx, event)) return c.text('Forbidden', 403)
    await uncancelEventSeries(c.env.DB, c.req.param('id'))
    return redirect(c, `/admin/events/${c.req.param('id')}/edit`)
  })

  app.post('/admin/events/:id/cancel-occurrence', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return redirect(c, '/admin/login')
    const event = await getEventById(c.env.DB, c.req.param('id'))
    if (!event || !canEditEvent(ctx, event)) return c.text('Forbidden', 403)
    const body = await c.req.parseBody()
    const occurrenceDate = String(body.occurrence_date ?? '')
    const message = typeof body.cancellation_message === 'string' ? body.cancellation_message : undefined
    await cancelEventOccurrence(c.env.DB, c.req.param('id'), occurrenceDate, message)
    if (body.notify_guests === '1') await notifyCancelledGuests(c.env, c.req.param('id'), occurrenceDate, message)
    return redirect(c, `/admin/events/${c.req.param('id')}/registrations`)
  })

  app.post('/admin/events/:id/uncancel-occurrence', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return redirect(c, '/admin/login')
    const event = await getEventById(c.env.DB, c.req.param('id'))
    if (!event || !canEditEvent(ctx, event)) return c.text('Forbidden', 403)
    const body = await c.req.parseBody()
    const occurrenceDate = String(body.occurrence_date ?? '').trim()
    if (occurrenceDate) {
      await uncancelEventOccurrence(c.env.DB, c.req.param('id'), occurrenceDate)
    }
    return redirect(c, `/admin/events/${c.req.param('id')}/registrations`)
  })

  app.get('/admin/events/:id/registrations', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return redirect(c, '/admin/login')
    const event = await getEventById(c.env.DB, c.req.param('id'))
    if (!event) return c.text('Not found', 404)
    if (!canEditEvent(ctx, event)) return c.text('Forbidden', 403)
    const page = parsePageParam(c.req.query('page'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), REGISTRATION_SORT_COLUMNS)
      ?? parseSortParam(c.req.query('sort'), c.req.query('dir'), CANCELLATION_SORT_COLUMNS)
    const result = await listRegistrationsPaginated(c.env.DB, event.id, page, sort)
    const cancelledOccurrences = await listCancelledOccurrences(c.env.DB, event.id, sort)
    const basePath = `/admin/events/${event.id}/registrations`
    const listParams = sortParams(sort)
    return c.html(
      <AdminShell ctx={ctx} title={`Registrations — ${event.title}`} activePath="/admin/events" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        {event.cancelled_at ? (
          <p class="muted">
            This entire series is cancelled.{' '}
            <a href={`/admin/events/${event.id}/edit`}>Uncancel the series</a> to restore it on the public calendar.
          </p>
        ) : null}
        {cancelledOccurrences.length ? (
          <>
            <h3>Cancelled occurrences</h3>
            <table class="admin-table">
              <SortableHead
                current={sort}
                basePath={basePath}
                params={listParams}
                columns={[
                  { key: 'date', label: 'Date', defaultDir: 'desc' },
                  { key: 'message', label: 'Message' },
                  { label: '' },
                ]}
              />
              <tbody>
                {cancelledOccurrences.map((occ) => (
                  <tr>
                    <td>{escapeHtml(occ.occurrence_date)}</td>
                    <td>{escapeHtml(occ.cancellation_message ?? '—')}</td>
                    <td>
                      <form method="post" action={`/admin/events/${event.id}/uncancel-occurrence`} class="admin-form-inline">
                        <input type="hidden" name="occurrence_date" value={occ.occurrence_date} />
                        <button class="btn btn-secondary" type="submit">
                          Uncancel
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
        <form method="post" action={`/admin/events/${event.id}/cancel-occurrence`} class="admin-form">
          <h3>Cancel one occurrence</h3>
          <label>Occurrence date</label>
          <input name="occurrence_date" type="date" required />
          <label>Cancellation message</label>
          <textarea name="cancellation_message" />
          <label>
            <input type="checkbox" name="notify_guests" value="1" /> Notify registered guests
          </label>
          <button class="btn btn-danger" type="submit">
            Cancel occurrence
          </button>
        </form>
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath={basePath}
            params={listParams}
            columns={[
              { key: 'date', label: 'Date', defaultDir: 'desc' },
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'spots', label: 'Spots' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.map((r) => (
              <tr>
                <td>{escapeHtml(r.occurrence_date)}</td>
                <td>{escapeHtml(r.guest_name)}</td>
                <td>{escapeHtml(r.guest_email)}</td>
                <td>{r.spot_count}</td>
                <td>
                  <form method="post" action={`/admin/registrations/${r.id}/delete`} class="admin-form-inline">
                    <button class="btn btn-secondary" type="submit">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath={basePath}
          params={listParams}
        />
      </AdminShell>,
    )
  })

  app.post('/admin/registrations/:id/delete', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canViewEvents(ctx)) return redirect(c, '/admin/login')
    await deleteRegistration(c.env.DB, c.req.param('id'))
    return redirect(c, c.req.header('Referer') ?? '/admin/events')
  })

  app.get('/admin/content', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canAccessContentSection(ctx.user.role, ctx.chairCommittees)) return redirect(c, '/admin/login')
    const isChair = ctx.user.role === 'chair'
    const sections = isChair
      ? [
          { href: '/admin/content/programs', title: 'Programs', desc: 'Program cards for your committees' },
          { href: '/admin/content/pages', title: 'Committee pages', desc: 'Edit pages for your assigned committees' },
          { href: '/admin/content/archive', title: 'Archive', desc: 'Minutes and documents for your committees' },
        ]
      : [
          { href: '/admin/content/settings', title: 'Site settings', desc: 'Theme, contact, footer, breaking news' },
          { href: '/admin/content/carousel', title: 'Home carousel', desc: 'Front page slides' },
          { href: '/admin/content/programs', title: 'Programs', desc: 'Program cards' },
          { href: '/admin/content/archive', title: 'Archive', desc: 'Minutes and newsletters' },
          { href: '/admin/content/posts', title: 'Posts', desc: 'Rich HTML newsletters and updates' },
          { href: '/admin/content/committees', title: 'Committees', desc: 'Committees and enrollment people' },
          { href: '/admin/content/resources', title: 'Resources', desc: 'Resource link list' },
          { href: '/admin/content/member-types', title: 'Membership types', desc: 'Directory and application types' },
          { href: '/admin/content/zero-damages', title: 'Zero at-fault', desc: 'Company list' },
          { href: '/admin/content/qa', title: 'Q & A', desc: '811 questions' },
          { href: '/admin/content/pages', title: 'Editable pages', desc: 'Program and content pages' },
        ]
    return c.html(
      <AdminShell ctx={ctx} title="Content" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <div class="admin-card-grid">
          {sections.map((s) => (
            <a class="admin-card" href={s.href}>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </a>
          ))}
        </div>
      </AdminShell>,
    )
  })

  app.all('/admin/content/settings', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || ctx.user.role !== 'admin') return redirect(c, '/admin/login')
    const [contact, footer, breaking, theme] = await Promise.all([
      getContactInfo(c.env.DB),
      getFooterInfo(c.env.DB),
      getBreakingNews(c.env.DB),
      getThemeSettings(c.env.DB),
    ])
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await setSetting(c.env.DB, 'contact', {
        organization_name: body.organization_name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        hours: body.hours,
        response_time: body.response_time,
      })
      await setSetting(c.env.DB, 'footer', {
        tagline: body.tagline,
        copyright: body.copyright,
      })
      await setSetting(c.env.DB, 'breaking_news', parseBreakingNewsForm(body as Record<string, string | File>))
      await setSetting(c.env.DB, 'theme', {
        primary: body.theme_primary || '#0066cc',
        primary_dark: body.theme_primary_dark || '#0052a3',
        secondary: body.theme_secondary || '#00a86b',
        accent: body.theme_accent || '#ff6b35',
      })
      return redirect(c, '/admin/content/settings')
    }
    const breakingItems =
      breaking.items.length > 0
        ? breaking.items
        : [
            {
              id: 'default',
              active: false,
              title: '',
              content: '',
              image_url: '',
              read_more_url: '',
              storage_key: 'nrcga_breaking_news_dismissed',
              expires_at: null,
            },
          ]
    return c.html(
      <AdminShell ctx={ctx} title="Site settings" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <form method="post" class="admin-form" id="site-settings-form">
          <h3>Theme colors</h3>
          <label>Primary</label>
          <input name="theme_primary" type="color" value={theme.primary} />
          <label>Primary dark</label>
          <input name="theme_primary_dark" type="color" value={theme.primary_dark} />
          <label>Secondary</label>
          <input name="theme_secondary" type="color" value={theme.secondary} />
          <label>Accent</label>
          <input name="theme_accent" type="color" value={theme.accent} />
          <h3>Contact</h3>
          <label>Organization</label>
          <input name="organization_name" value={contact.organization_name} />
          <label>Email</label>
          <input name="email" value={contact.email} />
          <label>Phone</label>
          <input name="phone" value={contact.phone} />
          <label>Address</label>
          <textarea name="address">{contact.address}</textarea>
          <label>Hours</label>
          <input name="hours" value={contact.hours} />
          <label>Response time note</label>
          <input name="response_time" value={contact.response_time} />
          <h3>Footer</h3>
          <label>Tagline</label>
          <input name="tagline" value={footer.tagline} />
          <label>Copyright</label>
          <input name="copyright" value={footer.copyright} />
          <h3>Breaking news</h3>
          <p class="admin-muted">
            Add multiple announcements. Visitors can move between active entries in the home page popup.
          </p>
          <input type="hidden" name="breaking_item_count" id="breaking-item-count" value={String(breakingItems.length)} />
          <div id="breaking-news-items">
            {breakingItems.map((item, index) => (
              <BreakingNewsItemFields item={item} index={index} />
            ))}
          </div>
          <button type="button" class="btn btn-secondary" id="breaking-news-add">
            Add entry
          </button>
          <template id="breaking-news-template">
            <BreakingNewsItemFields
              item={{
                id: '',
                active: true,
                title: '',
                content: '',
                image_url: '',
                read_more_url: '',
                storage_key: '',
                expires_at: null,
              }}
              index={0}
            />
          </template>
          <div class="admin-actions">
            <button class="btn btn-primary" type="submit">
              Save settings
            </button>
          </div>
        </form>
      </AdminShell>,
    )
  })

  app.all('/admin/profile', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx) return redirect(c, '/admin/login')
    let error = ''
    let success = ''
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      const current = typeof body.current_password === 'string' ? body.current_password : ''
      const next = typeof body.new_password === 'string' ? body.new_password : ''
      const confirm = typeof body.confirm_password === 'string' ? body.confirm_password : ''
      if (!current || !next) {
        error = 'Current and new password are required.'
      } else if (next.length < 8) {
        error = 'New password must be at least 8 characters.'
      } else if (next !== confirm) {
        error = 'New password and confirmation do not match.'
      } else {
        const ok = await verifyUserLogin(c.env, ctx.user.email, current)
        if (!ok) {
          error = 'Current password is incorrect.'
        } else {
          await updateUser(c.env.DB, ctx.user.id, { password: next })
          success = 'Password updated.'
        }
      }
    }
    return c.html(
      <AdminShell ctx={ctx} title="My profile" activePath="/admin/profile" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        {error ? <div class="error">{escapeHtml(error)}</div> : null}
        {success ? <div class="success">{escapeHtml(success)}</div> : null}
        <p>
          Signed in as <strong>{escapeHtml(ctx.user.email)}</strong>
        </p>
        <form method="post" class="admin-form">
          <label>Current password</label>
          <input type="password" name="current_password" required autoComplete="current-password" />
          <label>New password</label>
          <input type="password" name="new_password" required minlength={8} autoComplete="new-password" />
          <label>Confirm new password</label>
          <input type="password" name="confirm_password" required minlength={8} autoComplete="new-password" />
          <div class="admin-actions">
            <button class="btn btn-primary" type="submit">
              Change password
            </button>
          </div>
        </form>
      </AdminShell>,
    )
  })

  registerAdminContentRoutes(app, requireAdmin, redirect)
  registerAdminParityRoutes(app, requireAdmin, redirect)
  registerAdminAssetRoutes(app, requireAdmin, redirect)

  app.all('/admin/navigation', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageNavigation(ctx.user.role)) return redirect(c, '/admin/login')
    const nav = await getNavigation(c.env.DB)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      const json = typeof body.navigation_json === 'string' ? body.navigation_json : '{}'
      try {
        await setSetting(c.env.DB, 'navigation', JSON.parse(json))
      } catch {
        return c.text('Invalid navigation data', 400)
      }
      return redirect(c, '/admin/navigation')
    }
    const navJson = JSON.stringify(nav ?? {})
    return c.html(
      <AdminShell ctx={ctx} title="Navigation" activePath="/admin/navigation" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <form method="post">
          <div id="navigation-editor" data-nav={navJson}></div>
          <textarea id="navigation_json" name="navigation_json" hidden></textarea>
          <div class="admin-actions">
            <button class="btn btn-primary" type="submit">
              Save navigation
            </button>
          </div>
        </form>
        <script src="/navigation-editor.js"></script>
      </AdminShell>,
    )
  })

  app.get('/admin/users', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageUsers(ctx.user.role)) return redirect(c, '/admin/login')
    const page = parsePageParam(c.req.query('page'))
    const search = parseSearchParam(c.req.query('q'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), USER_SORT_COLUMNS)
    const result = await listUsersPaginated(c.env.DB, page, search, sort)
    const listParams = sortParams(sort)
    return c.html(
      <AdminShell ctx={ctx} title="Users & roles" activePath="/admin/users" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/users/new">
            Add user
          </a>
        </p>
        <ListSearch
          action="/admin/users"
          query={search}
          placeholder="Search by email, name, role, or linked member…"
          params={listParams}
        />
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath="/admin/users"
            search={search}
            params={listParams}
            columns={[
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Role' },
              { key: 'name', label: 'Name' },
              { key: 'member', label: 'Linked member' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colspan={5} class="muted">
                  {search ? 'No users match your search.' : 'No users yet.'}
                </td>
              </tr>
            ) : (
              result.items.map((u) => (
                <tr>
                  <td>{escapeHtml(u.email)}</td>
                  <td>{escapeHtml(ROLE_LABELS[u.role])}</td>
                  <td>{escapeHtml(u.display_name ?? '')}</td>
                  <td>{u.member_id ? escapeHtml(u.member_name ?? '—') : '—'}</td>
                  <td>
                    <a href={`/admin/users/${u.id}/edit`}>Edit</a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath="/admin/users"
          search={search}
          params={listParams}
        />
      </AdminShell>,
    )
  })

  app.all('/admin/users/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageUsers(ctx.user.role)) return redirect(c, '/admin/login')
    const committees = await listCommittees(c.env.DB)
    const stakeholderMembers = await listStakeholderMembers(c.env.DB)
    let error: string | undefined
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      const memberId = String(body.member_id ?? '') || null
      if (memberId) {
        const linked = await findUserLinkedToMember(c.env.DB, memberId)
        if (linked) error = `${linked.email} is already linked to that member organization.`
      }
      if (!error) {
        const userId = await createUser(
          c.env.DB,
          String(body.email ?? ''),
          String(body.password ?? ''),
          (body.role as UserRole) ?? 'user',
          String(body.display_name ?? ''),
          memberId,
        )
        if (body.role === 'chair') {
          await assignChairCommittees(c.env.DB, userId, parseCommitteeSlugs(body.committees))
        }
        return redirect(c, '/admin/users')
      }
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add user" activePath="/admin/users" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <UserForm
          committees={committees as Array<{ slug: string; name: string }>}
          stakeholderMembers={stakeholderMembers as Array<{ id: string; company_name: string }>}
          selectedCommittees={[]}
          error={error}
        />
      </AdminShell>,
    )
  })

  app.all('/admin/users/:id/edit', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageUsers(ctx.user.role)) return redirect(c, '/admin/login')
    const userId = c.req.param('id')
    const user = await c.env.DB.prepare('SELECT id, email, role, display_name, member_id FROM users WHERE id = ?')
      .bind(userId)
      .first<{ id: string; email: string; role: UserRole; display_name: string | null; member_id: string | null }>()
    if (!user) return c.text('Not found', 404)
    const committees = await listCommittees(c.env.DB)
    const stakeholderMembers = await listStakeholderMembers(c.env.DB)
    const selectedCommittees = await listChairCommittees(c.env.DB, userId)
    let error: string | undefined
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      const memberId = String(body.member_id ?? '') || null
      if (memberId) {
        const linked = await findUserLinkedToMember(c.env.DB, memberId, userId)
        if (linked) error = `${linked.email} is already linked to that member organization.`
      }
      if (!error) {
        await updateUser(c.env.DB, userId, {
          email: String(body.email ?? ''),
          role: (body.role as UserRole) ?? user.role,
          display_name: String(body.display_name ?? ''),
          member_id: memberId,
          password: typeof body.password === 'string' && body.password ? body.password : undefined,
        })
        if (body.role === 'chair') {
          await assignChairCommittees(c.env.DB, userId, parseCommitteeSlugs(body.committees))
        } else {
          await assignChairCommittees(c.env.DB, userId, [])
        }
        return redirect(c, '/admin/users')
      }
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit user" activePath="/admin/users" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <UserForm
          user={user}
          committees={committees as Array<{ slug: string; name: string }>}
          stakeholderMembers={stakeholderMembers as Array<{ id: string; company_name: string }>}
          selectedCommittees={selectedCommittees}
          error={error}
        />
      </AdminShell>,
    )
  })
}

function EventForm({
  ctx,
  committees,
  event,
  error,
}: {
  ctx: AdminContext
  committees: Array<{ slug: string; name: string }>
  event?: Awaited<ReturnType<typeof getEventById>>
  error?: string
}) {
  const start = splitDateTime(event?.starts_at)
  const end = splitDateTime(event?.ends_at ?? undefined)
  const allowed =
    ctx.user.role === 'admin' ? null : ctx.user.role === 'trainer' ? ['educationTraining'] : ctx.chairCommittees
  const defaultCommittee = event?.committee_slug ?? allowed?.[0] ?? ''
  const defaultCategory = event?.category ?? defaultCategoryForNewEvent(ctx, defaultCommittee)
  const lockCategory = ctx.user.role === 'trainer' || defaultCommittee === 'educationTraining'

  return (
    <>
    <form method="post" class="admin-form" action={event ? `/admin/events/${event.id}/edit` : '/admin/events/new'}>
      {error ? <div class="error">{escapeHtml(error)}</div> : null}
      <label>Title</label>
      <input name="title" required value={event?.title ?? ''} />

      <CommitteeSelect
        committees={committees}
        allowedSlugs={allowed}
        selectedSlug={defaultCommittee}
        required={ctx.user.role !== 'admin'}
      />

      <fieldset class="admin-fieldset">
        <legend>Start date & time</legend>
        <p class="muted">Times are Pacific Time (Nevada). Daylight saving (PDT/PST) is applied automatically.</p>
        <div class="admin-datetime-row">
          <label>
            Date
            <input name="start_date" type="date" required value={start.date} />
          </label>
          <label>
            Time
            <input name="start_time" type="time" required value={start.time} />
          </label>
        </div>
      </fieldset>

      <fieldset class="admin-fieldset">
        <legend>End date & time (optional)</legend>
        <div class="admin-datetime-row">
          <label>
            Date
            <input name="end_date" type="date" value={end.date} />
          </label>
          <label>
            Time
            <input name="end_time" type="time" value={end.date ? end.time : ''} />
          </label>
        </div>
      </fieldset>

      <div
        data-event-location-field
        data-initial-location={event?.location ?? ''}
        data-initial-latitude={event?.latitude != null ? String(event.latitude) : ''}
        data-initial-longitude={event?.longitude != null ? String(event.longitude) : ''}
      >
        <label>Location</label>
        <input
          name="location"
          data-event-location-input
          value={event?.location ?? ''}
          placeholder="Street address, city, NV"
          autocomplete="off"
        />
        <p class="muted">Press Enter to search address suggestions. Location is geocoded when you save.</p>
        <ul
          class="event-location-suggestions"
          data-event-location-suggestions
          role="listbox"
          hidden
        ></ul>
        <input type="hidden" name="latitude" data-event-latitude value={event?.latitude ?? ''} />
        <input type="hidden" name="longitude" data-event-longitude value={event?.longitude ?? ''} />
        <input type="hidden" name="map_skip" data-event-map-skip value="0" />
        <p
          class="muted"
          data-event-coords-hint
          hidden={event?.latitude == null || event?.longitude == null}
        >
          {event?.latitude != null && event?.longitude != null
            ? `Map coordinates saved (${Number(event.latitude).toFixed(5)}, ${Number(event.longitude).toFixed(5)}).`
            : ''}
        </p>
      </div>

      <label>Description</label>
      <textarea name="description">{event?.description ?? ''}</textarea>
      <label>Category</label>
      {lockCategory ? (
        <>
          <input type="hidden" name="category" value="training" />
          <p>Training</p>
        </>
      ) : (
        <select name="category">
          <option value="general" selected={defaultCategory !== 'training'}>
            General
          </option>
          <option value="training" selected={defaultCategory === 'training'}>
            Training
          </option>
        </select>
      )}
      <label>Repeat rule</label>
      <select name="repeat_rule">
        <option value="">Does not repeat</option>
        <option value="weekly" selected={event?.repeat_rule === 'weekly'}>
          Weekly
        </option>
        <option value="biweekly" selected={event?.repeat_rule === 'biweekly'}>
          Biweekly
        </option>
        <option value="monthly" selected={event?.repeat_rule === 'monthly'}>
          Monthly
        </option>
        <option value="custom" selected={event?.repeat_rule === 'custom'}>
          Custom interval (days)
        </option>
      </select>
      <label>Repeat interval days (custom only)</label>
      <input name="repeat_interval_days" type="number" value={event?.repeat_interval_days ?? ''} />
      <label>Repeat until</label>
      <input name="repeat_until" type="date" value={toDateInputValue(event?.repeat_until)} />
      <label>
        <input type="checkbox" name="registration_enabled" value="1" checked={event?.registration_enabled === 1} /> Enable
        registration
      </label>
      <label>Capacity (spots)</label>
      <input name="capacity" type="number" value={event?.capacity ?? ''} />
      <label>Capacity scope</label>
      <select name="capacity_scope">
        <option value="occurrence" selected={event?.capacity_scope !== 'series'}>
          Per occurrence
        </option>
        <option value="series" selected={event?.capacity_scope === 'series'}>
          Entire series
        </option>
      </select>
      <label>Registration cutoff (hours before start)</label>
      <input name="registration_cutoff_hours" type="number" value={event?.registration_cutoff_hours ?? 0} />
      <label>
        <input type="checkbox" name="published" value="1" checked={event?.published !== 0} /> Published
      </label>
      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">
          Save event
        </button>
        {event ? (
          <button class="btn btn-danger" name="_action" value="delete" type="submit">
            Delete
          </button>
        ) : null}
      </div>
    </form>

    <dialog id="event-location-picker" class="event-location-picker-dialog">
      <div class="event-location-picker-panel">
        <h3>Place event on the map</h3>
        <p data-event-location-picker-message></p>
        <div id="event-location-map" class="event-location-map"></div>
        <p data-event-location-picker-coords class="muted">Click the map to place a pin.</p>
        <div class="admin-actions">
          <button type="button" class="btn btn-primary" data-event-location-confirm disabled>
            Use this pin
          </button>
          <button type="button" class="btn btn-secondary" data-event-location-skip>
            Save without map
          </button>
          <button type="button" class="btn btn-secondary" data-modal-close>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script src="/event-location-picker.js"></script>
    </>
  )
}
