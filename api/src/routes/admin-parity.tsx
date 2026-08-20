import type { Hono } from 'hono'
import type { Env } from '../env'
import { canAccessInboxesSection, canManageAllContent, canManageInboxes, ROLE_LABELS, type UserRole } from '../config/roles'
import { escapeHtml, type AdminContext } from '../lib/admin-context'
import {
  accessibleInboxKeys,
  listInboxAssigneeIds,
  setInboxAssignees,
} from '../lib/inbox-access'
import { canViewInbox, canViewSubmission } from '../lib/permissions'
import { listUsers } from '../lib/auth'
import { parsePageParam, parseSearchParam } from '../lib/pagination'
import { parseSortParam, sortParams, type ListParams, type SortSpec } from '../lib/sort'
import {
  deleteCommittee,
  deleteCommitteePerson,
  deleteMembershipType,
  deletePost,
  deleteResourceLink,
  getCommitteeById,
  getCommitteePersonById,
  getMembershipTypeById,
  getPostById,
  getResourceLinkById,
  listCommitteePeoplePaginated,
  listCommitteesFull,
  listCommitteesPaginated,
  listMembershipTypesPaginated,
  listMembershipsForPerson,
  listPostsPaginated,
  listResourceLinksPaginated,
  setPersonMemberships,
  upsertCommittee,
  upsertCommitteePerson,
  upsertMembershipType,
  upsertPost,
  upsertResourceLink,
  COMMITTEE_PERSON_SORT_COLUMNS,
  COMMITTEE_SORT_COLUMNS,
  MEMBERSHIP_TYPE_SORT_COLUMNS,
  POST_SORT_COLUMNS,
  RESOURCE_SORT_COLUMNS,
} from '../lib/parity-db'
import {
  countNewFormSubmissionsByType,
  deleteFormInbox,
  deleteFormSubmission,
  deleteNewsletterSubscriber,
  getFormInboxById,
  getFormInboxBySlug,
  getFormSubmissionById,
  inboxToPublicSchema,
  isReservedInboxSlug,
  listAllNewsletterSubscribers,
  listFormInboxes,
  listFormSubmissionsPaginated,
  listFormSubmissionsPaginatedByTypes,
  listNewsletterPaginated,
  parseFormFields,
  parseInboxFieldsFromBody,
  sumNewSubmissionCounts,
  updateFormSubmissionStatus,
  updateNewsletterStatus,
  upsertFormInbox,
  type FormFieldDef,
  NEWSLETTER_SORT_COLUMNS,
  SUBMISSION_SORT_COLUMNS,
} from '../lib/forms-db'
import { AdminShell } from '../views/AdminShell'
import { AssetUrlField, ListSearch, Pagination, SortableHead } from '../views/AdminComponents'

type RequireAdmin = (c: { env: Env; req: { header: (name: string) => string | undefined } }) => Promise<AdminContext | null>
type Redirect = (c: { redirect: (url: string, status?: 303) => Response }, url: string) => Response
type InboxRouteContext = { env: Env; req: { header: (name: string) => string | undefined }; redirect: (url: string, status?: 303) => Response }

type GuardResult = { ctx: AdminContext; denied: null } | { ctx: null; denied: Response }

async function guardInboxSection(c: InboxRouteContext, requireAdmin: RequireAdmin, redirect: Redirect): Promise<GuardResult> {
  const ctx = await requireAdmin(c)
  if (!ctx || !canAccessInboxesSection(ctx.user.role, ctx.assignedInboxKeys)) {
    return { ctx: null, denied: redirect(c, '/admin/login') }
  }
  return { ctx, denied: null }
}

async function guardInboxView(
  c: InboxRouteContext,
  requireAdmin: RequireAdmin,
  redirect: Redirect,
  inboxKey: string,
): Promise<GuardResult> {
  const section = await guardInboxSection(c, requireAdmin, redirect)
  if (section.denied) return section
  if (!canViewInbox(section.ctx, inboxKey)) {
    return { ctx: null, denied: redirect(c, '/admin/inbox') }
  }
  return section
}

function parseAssignedUserIds(body: Record<string, string | File>): string[] {
  const raw = body.user_ids
  if (!raw) return []
  return (Array.isArray(raw) ? raw : [raw]).map(String).filter(Boolean)
}

async function saveInboxAccess(
  env: Env,
  inboxKey: string,
  body: Record<string, string | File>,
): Promise<void> {
  if (body._action !== 'assign_users') return
  await setInboxAssignees(env.DB, inboxKey, parseAssignedUserIds(body))
}

function formActions(saveLabel = 'Save') {
  return (
    <div class="admin-actions">
      <button class="btn btn-primary" type="submit">
        {saveLabel}
      </button>
    </div>
  )
}

export function registerAdminParityRoutes(app: Hono<{ Bindings: Env }>, requireAdmin: RequireAdmin, redirect: Redirect) {
  app.get('/tiptap-editor.js', async (c) => c.env.ASSETS.fetch(new URL('/tiptap-editor.js', c.req.url)))

  /* ---- Content hub cards are added in admin.tsx ---- */

  /* Committees */
  app.get('/admin/content/committees', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const page = parsePageParam(c.req.query('page'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), COMMITTEE_SORT_COLUMNS)
    const result = await listCommitteesPaginated(c.env.DB, page, sort)
    const listParams = sortParams(sort)
    return c.html(
      <AdminShell ctx={ctx} title="Committees" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/committees/new">
            Add committee
          </a>{' '}
          <a class="btn btn-secondary" href="/admin/content/committee-people">
            Committee people
          </a>
        </p>
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath="/admin/content/committees"
            params={listParams}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'slug', label: 'Slug' },
              { key: 'order', label: 'Order' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.name ?? ''))}</td>
                <td>{escapeHtml(String(row.slug ?? ''))}</td>
                <td>{String(row.sort_order ?? 0)}</td>
                <td>
                  <a href={`/admin/content/committees/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath="/admin/content/committees"
          params={listParams}
        />
      </AdminShell>,
    )
  })

  app.all('/admin/content/committees/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertCommittee(c.env.DB, parseCommittee(body as Record<string, string | File>))
      return redirect(c, '/admin/content/committees')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add committee" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <CommitteeForm />
      </AdminShell>,
    )
  })

  app.all('/admin/content/committees/:id/edit', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const row = await getCommitteeById(c.env.DB, c.req.param('id'))
    if (!row) return c.text('Not found', 404)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteCommittee(c.env.DB, row.id as string)
        return redirect(c, '/admin/content/committees')
      }
      await upsertCommittee(c.env.DB, parseCommittee(body as Record<string, string | File>), row.id as string)
      return redirect(c, '/admin/content/committees')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit committee" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <CommitteeForm item={row} />
      </AdminShell>,
    )
  })

  app.get('/admin/content/committee-people', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const page = parsePageParam(c.req.query('page'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), COMMITTEE_PERSON_SORT_COLUMNS)
    const result = await listCommitteePeoplePaginated(c.env.DB, page, sort)
    const listParams = sortParams(sort)
    return c.html(
      <AdminShell ctx={ctx} title="Committee people" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/committee-people/new">
            Add person
          </a>{' '}
          <a class="btn btn-secondary" href="/admin/content/committees">
            Back to committees
          </a>
        </p>
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath="/admin/content/committee-people"
            params={listParams}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'company', label: 'Company' },
              { key: 'email', label: 'Email' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.name ?? ''))}</td>
                <td>{escapeHtml(String(row.company ?? ''))}</td>
                <td>{escapeHtml(String(row.email ?? ''))}</td>
                <td>
                  <a href={`/admin/content/committee-people/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath="/admin/content/committee-people"
          params={listParams}
        />
      </AdminShell>,
    )
  })

  app.all('/admin/content/committee-people/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const committees = await listCommitteesFull(c.env.DB)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      const id = await upsertCommitteePerson(c.env.DB, parsePerson(body as Record<string, string | File>))
      await setPersonMemberships(c.env.DB, id, parseCommitteeIds(body as Record<string, string | File>))
      return redirect(c, '/admin/content/committee-people')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add committee person" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <CommitteePersonForm committees={committees as Array<{ id: string; name: string }>} />
      </AdminShell>,
    )
  })

  app.all('/admin/content/committee-people/:id/edit', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const person = await getCommitteePersonById(c.env.DB, c.req.param('id'))
    if (!person) return c.text('Not found', 404)
    const committees = await listCommitteesFull(c.env.DB)
    const memberships = await listMembershipsForPerson(c.env.DB, person.id as string)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteCommitteePerson(c.env.DB, person.id as string)
        return redirect(c, '/admin/content/committee-people')
      }
      await upsertCommitteePerson(c.env.DB, parsePerson(body as Record<string, string | File>), person.id as string)
      await setPersonMemberships(c.env.DB, person.id as string, parseCommitteeIds(body as Record<string, string | File>))
      return redirect(c, '/admin/content/committee-people')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit committee person" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <CommitteePersonForm
          item={person}
          committees={committees as Array<{ id: string; name: string }>}
          selectedIds={(memberships as Array<{ committee_id: string }>).map((m) => String(m.committee_id))}
        />
      </AdminShell>,
    )
  })

  /* Resources */
  app.get('/admin/content/resources', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const page = parsePageParam(c.req.query('page'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), RESOURCE_SORT_COLUMNS)
    const result = await listResourceLinksPaginated(c.env.DB, page, sort)
    const listParams = sortParams(sort)
    return c.html(
      <AdminShell ctx={ctx} title="Resources" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/resources/new">
            Add resource
          </a>
        </p>
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath="/admin/content/resources"
            params={listParams}
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'category', label: 'Category' },
              { key: 'url', label: 'URL' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.title ?? ''))}</td>
                <td>{escapeHtml(String(row.category ?? ''))}</td>
                <td>{escapeHtml(String(row.url ?? ''))}</td>
                <td>
                  <a href={`/admin/content/resources/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath="/admin/content/resources"
          params={listParams}
        />
      </AdminShell>,
    )
  })

  app.all('/admin/content/resources/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertResourceLink(c.env.DB, parseResource(body as Record<string, string | File>))
      return redirect(c, '/admin/content/resources')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add resource" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <ResourceForm />
      </AdminShell>,
    )
  })

  app.all('/admin/content/resources/:id/edit', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const row = await getResourceLinkById(c.env.DB, c.req.param('id'))
    if (!row) return c.text('Not found', 404)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteResourceLink(c.env.DB, row.id as string)
        return redirect(c, '/admin/content/resources')
      }
      await upsertResourceLink(c.env.DB, parseResource(body as Record<string, string | File>), row.id as string)
      return redirect(c, '/admin/content/resources')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit resource" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <ResourceForm item={row} />
      </AdminShell>,
    )
  })

  /* Membership types */
  app.get('/admin/content/member-types', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const page = parsePageParam(c.req.query('page'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), MEMBERSHIP_TYPE_SORT_COLUMNS)
    const result = await listMembershipTypesPaginated(c.env.DB, page, sort)
    const listParams = sortParams(sort)
    return c.html(
      <AdminShell ctx={ctx} title="Membership types" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/member-types/new">
            Add type
          </a>
        </p>
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath="/admin/content/member-types"
            params={listParams}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'slug', label: 'Slug' },
              { key: 'active', label: 'Active' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.name ?? ''))}</td>
                <td>{escapeHtml(String(row.slug ?? ''))}</td>
                <td>{row.active ? 'Yes' : 'No'}</td>
                <td>
                  <a href={`/admin/content/member-types/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath="/admin/content/member-types"
          params={listParams}
        />
      </AdminShell>,
    )
  })

  app.all('/admin/content/member-types/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertMembershipType(c.env.DB, parseMemberType(body as Record<string, string | File>))
      return redirect(c, '/admin/content/member-types')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add membership type" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <MemberTypeForm />
      </AdminShell>,
    )
  })

  app.all('/admin/content/member-types/:id/edit', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const row = await getMembershipTypeById(c.env.DB, c.req.param('id'))
    if (!row) return c.text('Not found', 404)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteMembershipType(c.env.DB, row.id as string)
        return redirect(c, '/admin/content/member-types')
      }
      await upsertMembershipType(c.env.DB, parseMemberType(body as Record<string, string | File>), row.id as string)
      return redirect(c, '/admin/content/member-types')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit membership type" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <MemberTypeForm item={row} />
      </AdminShell>,
    )
  })

  /* Posts */
  app.get('/admin/content/posts', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const page = parsePageParam(c.req.query('page'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), POST_SORT_COLUMNS)
    const result = await listPostsPaginated(c.env.DB, page, sort)
    const listParams = sortParams(sort)
    return c.html(
      <AdminShell ctx={ctx} title="Posts" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/archive/new">
            Add item
          </a>
        </p>
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath="/admin/content/posts"
            params={listParams}
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'slug', label: 'Slug' },
              { key: 'published', label: 'Published' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.title ?? ''))}</td>
                <td>{escapeHtml(String(row.slug ?? ''))}</td>
                <td>{row.published ? 'Yes' : 'No'}</td>
                <td>
                  <a href={`/admin/content/posts/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath="/admin/content/posts"
          params={listParams}
        />
      </AdminShell>,
    )
  })

  app.all('/admin/content/posts/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertPost(c.env.DB, parsePost(body as Record<string, string | File>))
      return redirect(c, '/admin/content/posts')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add post" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a href="/admin/content/archive/new">← Choose a different type</a>
        </p>
        <PostForm />
      </AdminShell>,
    )
  })

  app.all('/admin/content/posts/:id/edit', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const row = await getPostById(c.env.DB, c.req.param('id'))
    if (!row) return c.text('Not found', 404)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deletePost(c.env.DB, row.id as string)
        return redirect(c, '/admin/content/posts')
      }
      await upsertPost(c.env.DB, parsePost(body as Record<string, string | File>), row.id as string)
      return redirect(c, '/admin/content/posts')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit post" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <PostForm item={row} />
      </AdminShell>,
    )
  })

  /* Inboxes */
  const builtInInboxes = [
    {
      key: 'contact',
      href: '/admin/inbox/contact',
      title: 'Contact',
      description: 'Contact form submissions',
      types: ['contact'],
    },
    {
      key: 'applications',
      href: '/admin/inbox/applications',
      title: 'Applications',
      description: 'Member and award applications',
      types: ['member_application', 'award_application'],
    },
    {
      key: 'training',
      href: '/admin/inbox/training',
      title: 'Training',
      description: 'Training registration and sign-in',
      types: ['training_registration', 'training_signin'],
    },
    {
      key: 'newsletter',
      href: '/admin/inbox/newsletter',
      title: 'Newsletter',
      description: 'Subscribers and CSV export',
      types: ['newsletter'],
    },
  ] as const

  app.get('/admin/inbox', async (c) => {
    const { ctx, denied } = await guardInboxSection(c, requireAdmin, redirect)
    if (denied) return denied
    const customInboxes = await listFormInboxes(c.env.DB)
    const customSlugs = customInboxes.map((row) => String(row.slug))
    const visibleKeys = new Set(accessibleInboxKeys(ctx.user, ctx.assignedInboxKeys, customSlugs))
    const newCounts = await countNewFormSubmissionsByType(c.env.DB)
    const visibleBuiltIn = builtInInboxes.filter((box) => visibleKeys.has(box.key))
    const visibleCustom = customInboxes.filter((row) => visibleKeys.has(String(row.slug)))
    return c.html(
      <AdminShell ctx={ctx} title="Inboxes" activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        {canManageInboxes(ctx.user.role) ? (
          <p>
            <a class="btn btn-primary" href="/admin/inbox/new">
              Create inbox
            </a>
          </p>
        ) : null}
        <p class="muted">
          {canManageInboxes(ctx.user.role)
            ? 'Built-in inboxes collect site forms. Create an additional inbox to define a custom form schema you can mount on any page.'
            : 'Form submissions for inboxes you have access to.'}
        </p>
        {visibleBuiltIn.length === 0 && visibleCustom.length === 0 ? (
          <p class="muted">No inboxes are assigned to your account.</p>
        ) : (
          <div class="admin-card-grid">
            {visibleBuiltIn.map((box) => (
              <InboxHubCard
                href={box.href}
                title={box.title}
                description={box.description}
                newCount={sumNewSubmissionCounts(newCounts, [...box.types])}
              />
            ))}
            {visibleCustom.map((row) => (
              <InboxHubCard
                href={`/admin/inbox/${encodeURIComponent(String(row.slug))}`}
                title={String(row.title ?? '')}
                description={`${String(row.description || `Custom form · ${row.slug}`)}${!row.active ? ' (inactive)' : ''}`}
                newCount={newCounts[String(row.slug)] ?? 0}
              />
            ))}
          </div>
        )}
      </AdminShell>,
    )
  })

  app.all('/admin/inbox/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageInboxes(ctx.user.role)) return redirect(c, '/admin/login')
    let error = ''
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      try {
        const id = await upsertFormInbox(c.env.DB, parseInboxBody(body as Record<string, string | File>))
        const created = await getFormInboxById(c.env.DB, id)
        return redirect(c, `/admin/inbox/${encodeURIComponent(String(created?.slug ?? id))}/edit`)
      } catch (err) {
        error = err instanceof Error ? err.message : 'Could not create inbox.'
      }
    }
    return c.html(
      <AdminShell ctx={ctx} title="Create inbox" activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-secondary" href="/admin/inbox">
            All inboxes
          </a>
        </p>
        {error ? <p class="form-status form-status-error">{escapeHtml(error)}</p> : null}
        <InboxForm />
      </AdminShell>,
    )
  })

  for (const box of builtInInboxes.filter((b) => b.key !== 'newsletter')) {
    app.all(`/admin/inbox/${box.key}`, async (c) => {
      const inboxKey = box.key
      if (c.req.method === 'POST') {
        const ctx = await requireAdmin(c)
        if (!ctx || !canManageInboxes(ctx.user.role)) return redirect(c, '/admin/login')
        const body = (await c.req.parseBody()) as Record<string, string | File>
        await saveInboxAccess(c.env, inboxKey, body)
        return redirect(c, `/admin/inbox/${box.key}`)
      }
      const { ctx, denied } = await guardInboxView(c, requireAdmin, redirect, inboxKey)
      if (denied) return denied
      const page = parsePageParam(c.req.query('page'))
      const typeFilter = c.req.query('type') || undefined
      const status = c.req.query('status') || undefined
      const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), SUBMISSION_SORT_COLUMNS)
      const formType = typeFilter && box.types.includes(typeFilter as never) ? typeFilter : undefined
      let result
      if (formType) {
        result = await listFormSubmissionsPaginated(c.env.DB, page, formType, status, sort)
      } else {
        result = await listFormSubmissionsPaginatedByTypes(c.env.DB, page, [...box.types], status, false, sort)
      }
      const accessUsers = canManageInboxes(ctx.user.role) ? await listUsers(c.env.DB) : []
      const assignedUserIds = canManageInboxes(ctx.user.role) ? await listInboxAssigneeIds(c.env.DB, inboxKey) : []
      const basePath = `/admin/inbox/${box.key}`
      const listParams = { ...sortParams(sort), type: formType, status }
      return c.html(
        <AdminShell ctx={ctx} title={`${box.title} inbox`} activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
          <p>
            <a class="btn btn-secondary" href="/admin/inbox">
              All inboxes
            </a>
          </p>
          <SubmissionTable items={result.items} current={sort} basePath={basePath} params={listParams} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath={basePath}
            params={listParams}
          />
          {canManageInboxes(ctx.user.role) ? (
            <InboxAccessForm
              inboxKey={inboxKey}
              users={accessUsers}
              assignedUserIds={assignedUserIds}
              showTrainerNote={inboxKey === 'training'}
            />
          ) : null}
        </AdminShell>,
      )
    })
  }

  app.all('/admin/inbox/submission/:id', async (c) => {
    const { ctx, denied } = await guardInboxSection(c, requireAdmin, redirect)
    if (denied) return denied
    const row = await getFormSubmissionById(c.env.DB, c.req.param('id'))
    if (!row) return c.text('Not found', 404)
    const formType = String(row.form_type ?? '')
    if (!canViewSubmission(ctx, formType)) return redirect(c, '/admin/inbox')
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        if (!canManageInboxes(ctx.user.role)) return redirect(c, `/admin/inbox/submission/${row.id}`)
        await deleteFormSubmission(c.env.DB, row.id as string)
        return redirect(c, '/admin/inbox')
      }
      if (typeof body.status === 'string') {
        await updateFormSubmissionStatus(c.env.DB, row.id as string, body.status)
      }
      return redirect(c, `/admin/inbox/submission/${row.id}`)
    }
    const payload = parseSubmissionPayload(row.payload_json)
    const labelMap = await submissionFieldLabels(c.env.DB, formType)
    return c.html(
      <AdminShell ctx={ctx} title="Submission" activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-secondary" href="/admin/inbox">
            All inboxes
          </a>
        </p>
        <div class="submission-meta">
          <div>
            <span class="submission-meta-label">Form</span>
            <strong>{escapeHtml(humanizeFormType(formType))}</strong>
          </div>
          <div>
            <span class="submission-meta-label">Status</span>
            <strong>{escapeHtml(String(row.status ?? ''))}</strong>
          </div>
          <div>
            <span class="submission-meta-label">Received</span>
            <strong>{escapeHtml(String(row.created_at ?? ''))}</strong>
          </div>
        </div>
        <SubmissionFields payload={payload} labels={labelMap} />
        <form method="post" class="admin-form">
          <label>Status</label>
          <select name="status">
            {['new', 'read', 'archived'].map((s) => (
              <option value={s} selected={String(row.status) === s}>
                {s}
              </option>
            ))}
          </select>
          {formActions('Update status')}
        </form>
        {canManageInboxes(ctx.user.role) ? (
          <form method="post" class="admin-form">
            <input type="hidden" name="_action" value="delete" />
            <button class="btn btn-danger" type="submit">
              Delete
            </button>
          </form>
        ) : null}
      </AdminShell>,
    )
  })

  app.all('/admin/inbox/newsletter', async (c) => {
    if (c.req.method === 'POST') {
      const ctx = await requireAdmin(c)
      if (!ctx || !canManageInboxes(ctx.user.role)) return redirect(c, '/admin/login')
      const body = (await c.req.parseBody()) as Record<string, string | File>
      await saveInboxAccess(c.env, 'newsletter', body)
      return redirect(c, '/admin/inbox/newsletter')
    }
    const { ctx, denied } = await guardInboxView(c, requireAdmin, redirect, 'newsletter')
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const search = parseSearchParam(c.req.query('q'))
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), NEWSLETTER_SORT_COLUMNS)
    const result = await listNewsletterPaginated(c.env.DB, page, search, sort)
    const listParams = sortParams(sort)
    const accessUsers = canManageInboxes(ctx.user.role) ? await listUsers(c.env.DB) : []
    const assignedUserIds = canManageInboxes(ctx.user.role) ? await listInboxAssigneeIds(c.env.DB, 'newsletter') : []
    return c.html(
      <AdminShell ctx={ctx} title="Newsletter subscribers" activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-secondary" href="/admin/inbox">
            All inboxes
          </a>{' '}
          {canManageInboxes(ctx.user.role) ? (
            <a class="btn btn-primary" href="/admin/inbox/newsletter/export.csv">
              Export CSV
            </a>
          ) : null}
        </p>
        <ListSearch
          action="/admin/inbox/newsletter"
          query={search}
          placeholder="Search email or name…"
          params={listParams}
        />
        <table class="admin-table">
          <SortableHead
            current={sort}
            basePath="/admin/inbox/newsletter"
            search={search}
            params={listParams}
            columns={[
              { key: 'email', label: 'Email' },
              { key: 'name', label: 'Name' },
              { key: 'status', label: 'Status' },
              { key: 'joined', label: 'Joined', defaultDir: 'desc' },
              { label: '' },
            ]}
          />
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.email ?? ''))}</td>
                <td>{escapeHtml(String(row.name ?? ''))}</td>
                <td>{escapeHtml(String(row.status ?? ''))}</td>
                <td>{escapeHtml(String(row.created_at ?? ''))}</td>
                <td>
                  <form method="post" action={`/admin/inbox/newsletter/${row.id}`} class="admin-form-inline">
                    <input type="hidden" name="_action" value="unsubscribe" />
                    <button class="btn btn-secondary" type="submit">
                      Unsubscribe
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
          basePath="/admin/inbox/newsletter"
          search={search}
          params={listParams}
        />
        {canManageInboxes(ctx.user.role) ? (
          <InboxAccessForm inboxKey="newsletter" users={accessUsers} assignedUserIds={assignedUserIds} />
        ) : null}
      </AdminShell>,
    )
  })

  app.get('/admin/inbox/newsletter/export.csv', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageInboxes(ctx.user.role)) return redirect(c, '/admin/login')
    const rows = await listAllNewsletterSubscribers(c.env.DB)
    const lines = ['email,name,status,created_at']
    for (const row of rows) {
      const email = String(row.email ?? '').replace(/"/g, '""')
      const name = String(row.name ?? '').replace(/"/g, '""')
      lines.push(`"${email}","${name}","${row.status}","${row.created_at}"`)
    }
    return new Response(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"',
      },
    })
  })

  app.post('/admin/inbox/newsletter/:id', async (c) => {
    const { ctx, denied } = await guardInboxView(c, requireAdmin, redirect, 'newsletter')
    if (denied) return denied
    const body = await c.req.parseBody()
    if (body._action === 'unsubscribe') {
      await updateNewsletterStatus(c.env.DB, c.req.param('id'), 'unsubscribed')
    } else if (body._action === 'delete' && canManageInboxes(ctx.user.role)) {
      await deleteNewsletterSubscriber(c.env.DB, c.req.param('id'))
    }
    return redirect(c, '/admin/inbox/newsletter')
  })

  app.all('/admin/inbox/:slug/edit', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageInboxes(ctx.user.role)) return redirect(c, '/admin/login')
    const slug = c.req.param('slug')
    if (isReservedInboxSlug(slug)) return c.text('Not found', 404)
    const row = await getFormInboxBySlug(c.env.DB, slug)
    if (!row) return c.text('Not found', 404)
    let error = ''
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'assign_users') {
        await saveInboxAccess(c.env, slug, body as Record<string, string | File>)
        return redirect(c, `/admin/inbox/${encodeURIComponent(slug)}/edit`)
      }
      if (body._action === 'delete') {
        await deleteFormInbox(c.env.DB, row.id as string)
        return redirect(c, '/admin/inbox')
      }
      try {
        await upsertFormInbox(c.env.DB, parseInboxBody(body as Record<string, string | File>), row.id as string)
        const updated = await getFormInboxById(c.env.DB, row.id as string)
        return redirect(c, `/admin/inbox/${encodeURIComponent(String(updated?.slug ?? slug))}/edit`)
      } catch (err) {
        error = err instanceof Error ? err.message : 'Could not save inbox.'
      }
    }
    const fresh = (await getFormInboxBySlug(c.env.DB, slug)) || row
    const schema = inboxToPublicSchema(fresh)
    const accessUsers = await listUsers(c.env.DB)
    const assignedUserIds = await listInboxAssigneeIds(c.env.DB, slug)
    return c.html(
      <AdminShell ctx={ctx} title={`Edit inbox · ${schema.title}`} activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-secondary" href="/admin/inbox">
            All inboxes
          </a>{' '}
          <a class="btn btn-secondary" href={`/admin/inbox/${encodeURIComponent(schema.slug)}`}>
            View submissions
          </a>
        </p>
        {error ? <p class="form-status form-status-error">{escapeHtml(error)}</p> : null}
        <InboxForm item={fresh} />
        <InboxAccessForm inboxKey={slug} users={accessUsers} assignedUserIds={assignedUserIds} />
        <div class="admin-form" style="margin-top:1.5rem">
          <h3>Put this form on a page</h3>
          <p class="muted">
            In the page editor, place the cursor where the form should go and click <strong>Form</strong> in the
            toolbar, then choose this inbox. You can also right-click an inserted form block to change or remove it.
          </p>
          <p class="muted">
            Advanced: mount div for static HTML pages —{' '}
            <code>{`<div data-nrcga-form-mount="${escapeHtml(schema.slug)}"></div>`}</code>
          </p>
          <p class="muted">
            Public endpoint: <code>GET /api/v1/forms/{escapeHtml(schema.slug)}</code> · submissions post to{' '}
            <code>POST /api/v1/forms/{escapeHtml(schema.slug)}</code>
          </p>
        </div>
      </AdminShell>,
    )
  })

  app.get('/admin/inbox/:slug', async (c) => {
    const slug = c.req.param('slug')
    if (isReservedInboxSlug(slug)) return c.text('Not found', 404)
    const inbox = await getFormInboxBySlug(c.env.DB, slug)
    if (!inbox) return c.text('Not found', 404)
    const { ctx, denied } = await guardInboxView(c, requireAdmin, redirect, slug)
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const status = c.req.query('status') || undefined
    const sort = parseSortParam(c.req.query('sort'), c.req.query('dir'), SUBMISSION_SORT_COLUMNS)
    const result = await listFormSubmissionsPaginated(c.env.DB, page, String(inbox.slug), status, sort)
    const basePath = `/admin/inbox/${encodeURIComponent(String(inbox.slug))}`
    const listParams = { ...sortParams(sort), status }
    return c.html(
      <AdminShell
        ctx={ctx}
        title={`${String(inbox.title)} inbox`}
        activePath="/admin/inbox"
        publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}
      >
        <p>
          <a class="btn btn-secondary" href="/admin/inbox">
            All inboxes
          </a>{' '}
          {canManageInboxes(ctx.user.role) ? (
            <a class="btn btn-primary" href={`/admin/inbox/${encodeURIComponent(String(inbox.slug))}/edit`}>
              Edit form schema
            </a>
          ) : null}
        </p>
        <SubmissionTable items={result.items} current={sort} basePath={basePath} params={listParams} />
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
}

function parseCommittee(body: Record<string, string | File>) {
  return {
    name: String(body.name ?? ''),
    slug: body.slug ? String(body.slug) : '',
    description: body.description ? String(body.description) : null,
    photo_url: body.photo_url ? String(body.photo_url) : null,
    sort_order: Number(body.sort_order ?? 0),
  }
}

function parsePerson(body: Record<string, string | File>) {
  return {
    name: String(body.name ?? ''),
    company: body.company ? String(body.company) : null,
    email: body.email ? String(body.email) : null,
  }
}

function parseCommitteeIds(body: Record<string, string | File>): string[] {
  const raw = body.committee_ids
  if (typeof raw === 'string' && raw) return raw.split(',').map((s) => s.trim()).filter(Boolean)
  const ids: string[] = []
  for (const [key, value] of Object.entries(body)) {
    if (key.startsWith('committee_') && value === '1') ids.push(key.replace('committee_', ''))
  }
  return ids
}

function parseResource(body: Record<string, string | File>) {
  return {
    title: String(body.title ?? ''),
    url: String(body.url ?? ''),
    category: body.category ? String(body.category) : null,
    description: body.description ? String(body.description) : null,
    sort_order: Number(body.sort_order ?? 0),
    active: body.active === '1' ? 1 : 0,
  }
}

function parseMemberType(body: Record<string, string | File>) {
  return {
    name: String(body.name ?? ''),
    slug: body.slug ? String(body.slug) : '',
    description: body.description ? String(body.description) : null,
    sort_order: Number(body.sort_order ?? 0),
    active: body.active === '1' ? 1 : 0,
  }
}

function parsePost(body: Record<string, string | File>) {
  return {
    title: String(body.title ?? ''),
    slug: body.slug ? String(body.slug) : '',
    excerpt: body.excerpt ? String(body.excerpt) : null,
    cover_url: body.cover_url ? String(body.cover_url) : null,
    cover_r2_key: body.cover_r2_key ? String(body.cover_r2_key) : null,
    body_html: body.body_html ? String(body.body_html) : null,
    pdf_url: body.pdf_url ? String(body.pdf_url) : null,
    published: body.published === '1' ? 1 : 0,
    published_at: body.published_at ? String(body.published_at) : null,
  }
}

function CommitteeForm({ item }: { item?: Record<string, unknown> }) {
  return (
    <form method="post" class="admin-form">
      <label>Name</label>
      <input name="name" required value={String(item?.name ?? '')} />
      <label>Slug</label>
      <input name="slug" value={String(item?.slug ?? '')} placeholder="auto from name if blank" />
      <label>Description</label>
      <textarea name="description">{String(item?.description ?? '')}</textarea>
      <AssetUrlField label="Photo URL" name="photo_url" value={String(item?.photo_url ?? '')} />
      <label>Sort order</label>
      <input name="sort_order" type="number" value={String(item?.sort_order ?? 0)} />
      {formActions()}
      {item ? (
        <button class="btn btn-danger" type="submit" name="_action" value="delete">
          Delete
        </button>
      ) : null}
    </form>
  )
}

function CommitteePersonForm({
  item,
  committees,
  selectedIds = [],
}: {
  item?: Record<string, unknown>
  committees: Array<{ id: string; name: string }>
  selectedIds?: string[]
}) {
  return (
    <form method="post" class="admin-form">
      <label>Name</label>
      <input name="name" required value={String(item?.name ?? '')} />
      <label>Company</label>
      <input name="company" value={String(item?.company ?? '')} />
      <label>Email</label>
      <input name="email" type="email" value={String(item?.email ?? '')} />
      <fieldset>
        <legend>Committees</legend>
        {committees.map((c) => (
          <label>
            <input
              type="checkbox"
              name={`committee_${c.id}`}
              value="1"
              checked={selectedIds.includes(c.id)}
            />{' '}
            {escapeHtml(c.name)}
          </label>
        ))}
      </fieldset>
      {formActions()}
      {item ? (
        <button class="btn btn-danger" type="submit" name="_action" value="delete">
          Delete
        </button>
      ) : null}
    </form>
  )
}

function ResourceForm({ item }: { item?: Record<string, unknown> }) {
  return (
    <form method="post" class="admin-form">
      <label>Title</label>
      <input name="title" required value={String(item?.title ?? '')} />
      <label>URL</label>
      <input name="url" required value={String(item?.url ?? '')} />
      <label>Category</label>
      <input name="category" value={String(item?.category ?? '')} />
      <label>Description</label>
      <textarea name="description">{String(item?.description ?? '')}</textarea>
      <label>Sort order</label>
      <input name="sort_order" type="number" value={String(item?.sort_order ?? 0)} />
      <label>
        <input type="checkbox" name="active" value="1" checked={!item || !!item.active} /> Active
      </label>
      {formActions()}
      {item ? (
        <button class="btn btn-danger" type="submit" name="_action" value="delete">
          Delete
        </button>
      ) : null}
    </form>
  )
}

function MemberTypeForm({ item }: { item?: Record<string, unknown> }) {
  return (
    <form method="post" class="admin-form">
      <label>Name</label>
      <input name="name" required value={String(item?.name ?? '')} />
      <label>Slug</label>
      <input name="slug" value={String(item?.slug ?? '')} placeholder="auto from name if blank" />
      <label>Description</label>
      <textarea name="description">{String(item?.description ?? '')}</textarea>
      <label>Sort order</label>
      <input name="sort_order" type="number" value={String(item?.sort_order ?? 0)} />
      <label>
        <input type="checkbox" name="active" value="1" checked={!item || !!item.active} /> Active
      </label>
      {formActions()}
      {item ? (
        <button class="btn btn-danger" type="submit" name="_action" value="delete">
          Delete
        </button>
      ) : null}
    </form>
  )
}

function PostForm({ item }: { item?: Record<string, unknown> }) {
  return (
    <form method="post" class="admin-form" id="post-form">
      <label>Title</label>
      <input name="title" required value={String(item?.title ?? '')} />
      <label>Slug</label>
      <input name="slug" value={String(item?.slug ?? '')} placeholder="auto from title if blank" />
      <label>Excerpt</label>
      <textarea name="excerpt">{String(item?.excerpt ?? '')}</textarea>
      <AssetUrlField
        label="Cover URL"
        name="cover_url"
        value={String(item?.cover_url ?? '')}
        r2Name="cover_r2_key"
        r2Value={String(item?.cover_r2_key ?? '')}
      />
      <label>PDF URL (optional)</label>
      <input name="pdf_url" value={String(item?.pdf_url ?? '')} />
      <label>Body</label>
      <div id="tiptap-editor" class="tiptap-host" data-initial={String(item?.body_html ?? '')}></div>
      <textarea name="body_html" id="body_html" style="display:none" value={String(item?.body_html ?? '')}></textarea>
      <label>
        <input type="checkbox" name="published" value="1" checked={!!item?.published} /> Published
      </label>
      <label>Published at (ISO, optional)</label>
      <input name="published_at" value={String(item?.published_at ?? '')} />
      {formActions()}
      {item ? (
        <button class="btn btn-danger" type="submit" name="_action" value="delete">
          Delete
        </button>
      ) : null}
      <script src="/tiptap-editor.js"></script>
    </form>
  )
}

function parseInboxBody(body: Record<string, string | File>) {
  return {
    title: String(body.title ?? ''),
    slug: body.slug ? String(body.slug) : null,
    description: body.description ? String(body.description) : null,
    fields: parseInboxFieldsFromBody(body),
    submit_label: body.submit_label ? String(body.submit_label) : null,
    success_message: body.success_message ? String(body.success_message) : null,
    notify_email: body.notify_email ? String(body.notify_email) : null,
    active: body.active === '1' || body.active === 'on',
    sort_order: Number(body.sort_order ?? 0),
  }
}

function submissionSummary(payloadJson: unknown): string {
  try {
    const p = JSON.parse(String(payloadJson ?? '{}')) as Record<string, unknown>
    for (const key of ['name', 'contact_name', 'nominee_name', 'email', 'company_name', 'title']) {
      if (p[key]) return String(p[key])
    }
    const first = Object.values(p).find((v) => typeof v === 'string' && v.trim())
    return first ? String(first) : ''
  } catch {
    return ''
  }
}

const BUILTIN_FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  subject: 'Subject',
  message: 'Message',
  organization: 'Organization',
  company: 'Company',
  company_name: 'Company',
  contact_name: 'Contact name',
  website: 'Website',
  membership_type: 'Membership type',
  stakeholder_group: 'Stakeholder group',
  notes: 'Notes',
  nominee_name: 'Nominee',
  nominator_name: 'Nominator',
  award: 'Award',
  statement: 'Statement',
  training_date: 'Training date',
  title: 'Title',
}

function humanizeFormType(formType: string): string {
  const known: Record<string, string> = {
    contact: 'Contact',
    member_application: 'Membership application',
    award_application: 'Award nomination',
    training_registration: 'Training registration',
    training_signin: 'Training sign-in',
    newsletter: 'Newsletter',
  }
  if (known[formType]) return known[formType]
  return formType
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function humanizeFieldKey(key: string): string {
  if (BUILTIN_FIELD_LABELS[key]) return BUILTIN_FIELD_LABELS[key]
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseSubmissionPayload(payloadJson: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(payloadJson ?? '{}')) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* ignore */
  }
  return {}
}

async function submissionFieldLabels(db: D1Database, formType: string): Promise<Record<string, string>> {
  const labels: Record<string, string> = { ...BUILTIN_FIELD_LABELS }
  try {
    const inbox = await getFormInboxBySlug(db, formType)
    if (inbox?.fields_json) {
      for (const field of parseFormFields(inbox.fields_json)) {
        if (field.name && field.label) labels[field.name] = field.label
      }
    }
  } catch {
    /* built-ins have no inbox row */
  }
  return labels
}

function formatSubmissionValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value == null) return '—'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : '—'
  }
  if (Array.isArray(value)) {
    return value.length ? value.map((v) => formatSubmissionValue(v)).join(', ') : '—'
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function SubmissionFields({
  payload,
  labels,
}: {
  payload: Record<string, unknown>
  labels: Record<string, string>
}) {
  const entries = Object.entries(payload)
  if (!entries.length) {
    return <p class="muted">No form fields were saved with this submission.</p>
  }
  return (
    <dl class="submission-fields">
      {entries.map(([key, value]) => {
        const display = formatSubmissionValue(value)
        const isLong = display.length > 120 || display.includes('\n')
        return (
          <>
            <dt>{escapeHtml(labels[key] || humanizeFieldKey(key))}</dt>
            <dd class={isLong ? 'submission-field-long' : undefined}>{escapeHtml(display)}</dd>
          </>
        )
      })}
    </dl>
  )
}

function InboxAccessForm({
  inboxKey,
  users,
  assignedUserIds,
  showTrainerNote,
}: {
  inboxKey: string
  users: Array<{ id: string; email: string; display_name: string | null; role: string }>
  assignedUserIds: string[]
  showTrainerNote?: boolean
}) {
  const assigned = new Set(assignedUserIds)
  const eligible = users.filter((u) => u.role !== 'admin')
  return (
    <form method="post" class="admin-form" style="margin-top:2rem">
      <input type="hidden" name="_action" value="assign_users" />
      <h3>Inbox access</h3>
      <p class="muted">
        Choose staff who can view this inbox. Admins always have access.
        {showTrainerNote ? ' Trainers also have access to the training inbox automatically.' : ''}
      </p>
      {eligible.length === 0 ? (
        <p class="muted">No non-admin users to assign.</p>
      ) : (
        <div class="admin-checkbox-list">
          {eligible.map((u) => (
            <label>
              <input type="checkbox" name="user_ids" value={u.id} checked={assigned.has(u.id)} />{' '}
              {escapeHtml(u.display_name || u.email)} ({escapeHtml(ROLE_LABELS[u.role as UserRole] ?? u.role)})
            </label>
          ))}
        </div>
      )}
      <div class="admin-actions">
        <button type="submit" class="btn btn-secondary">
          Save access
        </button>
      </div>
    </form>
  )
}

function InboxHubCard({
  href,
  title,
  description,
  newCount,
}: {
  href: string
  title: string
  description: string
  newCount: number
}) {
  const countLabel = newCount === 1 ? '1 new' : `${newCount} new`
  return (
    <a class="admin-card" href={href}>
      <h3>
        <span>{escapeHtml(title)}</span>
        {newCount > 0 ? (
          <span class="inbox-count" aria-label={countLabel}>
            {newCount > 99 ? '99+' : newCount}
          </span>
        ) : null}
      </h3>
      <p>
        {escapeHtml(description)}
        {newCount > 0 ? ` · ${countLabel}` : ''}
      </p>
    </a>
  )
}

function SubmissionTable({
  items,
  current,
  basePath,
  params,
}: {
  items: Array<Record<string, unknown>>
  current: SortSpec | null
  basePath: string
  params?: ListParams
}) {
  return (
    <table class="admin-table">
      <SortableHead
        current={current}
        basePath={basePath}
        params={params}
        columns={[
          { key: 'date', label: 'Date', defaultDir: 'desc' },
          { key: 'type', label: 'Type' },
          { key: 'status', label: 'Status' },
          { label: 'Summary' },
          { label: '' },
        ]}
      />
      <tbody>
        {items.map((row) => (
          <tr>
            <td>{escapeHtml(String(row.created_at ?? ''))}</td>
            <td>{escapeHtml(humanizeFormType(String(row.form_type ?? '')))}</td>
            <td>{escapeHtml(String(row.status ?? ''))}</td>
            <td>{escapeHtml(submissionSummary(row.payload_json))}</td>
            <td>
              <a href={`/admin/inbox/submission/${row.id}`}>View</a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function defaultInboxFields(): FormFieldDef[] {
  return [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'message', label: 'Message', type: 'textarea', required: true },
  ]
}

function InboxForm({ item }: { item?: Record<string, unknown> }) {
  const fields = item ? parseFormFields(item.fields_json) : defaultInboxFields()
  const fieldsJson = JSON.stringify(fields)
  return (
    <form method="post" class="admin-form" id="inbox-schema-form">
      <label>Title</label>
      <input name="title" required value={String(item?.title ?? '')} placeholder="Committee feedback" />
      <label>Slug</label>
      <input
        name="slug"
        value={String(item?.slug ?? '')}
        placeholder="auto from title if blank — used in data-nrcga-form-mount"
      />
      <label>Description</label>
      <textarea name="description" placeholder="Shown on the inboxes hub">{String(item?.description ?? '')}</textarea>
      <label>Notify email (optional)</label>
      <input
        name="notify_email"
        type="email"
        value={String(item?.notify_email ?? '')}
        placeholder="Defaults to site contact email"
      />
      <label>Submit button label</label>
      <input name="submit_label" value={String(item?.submit_label ?? 'Submit')} />
      <label>Success message</label>
      <input
        name="success_message"
        value={String(item?.success_message ?? 'Thank you — your submission was received.')}
      />
      <label>Sort order</label>
      <input name="sort_order" type="number" value={String(item?.sort_order ?? 0)} />
      <label>
        <input type="checkbox" name="active" value="1" checked={!item || !!item.active} /> Active (accepts
        submissions)
      </label>

      <h3>Form fields</h3>
      <p class="muted">These fields define the public form schema and how submissions are validated.</p>
      <div id="inbox-fields" data-inbox-fields data-initial={fieldsJson}>
        {fields.map((field, index) => (
          <div class="inbox-field-row" data-field-row>
            <div class="inbox-field-grid">
              <label>
                Label
                <input name={`field_label_${index}`} required value={field.label} />
              </label>
              <label>
                Name
                <input name={`field_name_${index}`} required value={field.name} placeholder="snake_case" />
              </label>
              <label>
                Type
                <select name={`field_type_${index}`} data-field-type>
                  {(
                    [
                      ['text', 'Text'],
                      ['email', 'Email'],
                      ['tel', 'Phone'],
                      ['url', 'URL'],
                      ['textarea', 'Text area'],
                      ['select', 'Select'],
                      ['checkbox', 'Checkbox'],
                    ] as const
                  ).map(([value, label]) => (
                    <option value={value} selected={field.type === value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label class="inbox-field-required">
                <input type="checkbox" name={`field_required_${index}`} value="1" checked={!!field.required} />{' '}
                Required
              </label>
            </div>
            <label data-field-options hidden={field.type !== 'select'}>
              Options (one per line, for select)
              <textarea name={`field_options_${index}`} rows={2}>
                {(field.options || []).join('\n')}
              </textarea>
            </label>
            <label>
              Placeholder (optional)
              <input name={`field_placeholder_${index}`} value={field.placeholder || ''} />
            </label>
            <p>
              <button type="button" class="btn btn-secondary" data-remove-field>
                Remove field
              </button>
            </p>
          </div>
        ))}
      </div>
      <p>
        <button type="button" class="btn btn-secondary" data-inbox-add-field>
          Add field
        </button>
      </p>

      {formActions(item ? 'Save inbox' : 'Create inbox')}
      {item ? (
        <button class="btn btn-danger" type="submit" name="_action" value="delete">
          Delete inbox
        </button>
      ) : null}
      <script src="/inbox-schema-editor.js"></script>
    </form>
  )
}
