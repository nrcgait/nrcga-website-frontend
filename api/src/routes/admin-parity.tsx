import type { Hono } from 'hono'
import type { Env } from '../env'
import { canManageAllContent } from '../config/roles'
import { escapeHtml, type AdminContext } from '../lib/admin-context'
import { parsePageParam, parseSearchParam } from '../lib/pagination'
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
  listNewsletterPaginated,
  parseFormFields,
  parseInboxFieldsFromBody,
  sumNewSubmissionCounts,
  updateFormSubmissionStatus,
  updateNewsletterStatus,
  upsertFormInbox,
  type FormFieldDef,
} from '../lib/forms-db'
import { AdminShell } from '../views/AdminShell'
import { AssetUrlField, ListSearch, Pagination } from '../views/AdminComponents'

type RequireAdmin = (c: { env: Env; req: { header: (name: string) => string | undefined } }) => Promise<AdminContext | null>
type Redirect = (c: { redirect: (url: string, status?: 303) => Response }, url: string) => Response

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
    const result = await listCommitteesPaginated(c.env.DB, page)
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
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Order</th>
              <th></th>
            </tr>
          </thead>
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
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/committees" />
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
    const result = await listCommitteePeoplePaginated(c.env.DB, page)
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
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
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
    const result = await listResourceLinksPaginated(c.env.DB, page)
    return c.html(
      <AdminShell ctx={ctx} title="Resources" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/resources/new">
            Add resource
          </a>
        </p>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>URL</th>
              <th></th>
            </tr>
          </thead>
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
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/resources" />
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
    const result = await listMembershipTypesPaginated(c.env.DB, page)
    return c.html(
      <AdminShell ctx={ctx} title="Membership types" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/member-types/new">
            Add type
          </a>
        </p>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
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
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/member-types" />
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
    const result = await listPostsPaginated(c.env.DB, page)
    return c.html(
      <AdminShell ctx={ctx} title="Posts" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/archive/new">
            Add item
          </a>
        </p>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Published</th>
              <th></th>
            </tr>
          </thead>
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
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/posts" />
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
  app.get('/admin/inbox', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const customInboxes = await listFormInboxes(c.env.DB)
    const newCounts = await countNewFormSubmissionsByType(c.env.DB)
    const builtIn = [
      {
        href: '/admin/inbox/contact',
        title: 'Contact',
        description: 'Contact form submissions',
        types: ['contact'],
      },
      {
        href: '/admin/inbox/applications',
        title: 'Applications',
        description: 'Member and award applications',
        types: ['member_application', 'award_application'],
      },
      {
        href: '/admin/inbox/training',
        title: 'Training',
        description: 'Training registration and sign-in',
        types: ['training_registration', 'training_signin'],
      },
      {
        href: '/admin/inbox/newsletter',
        title: 'Newsletter',
        description: 'Subscribers and CSV export',
        types: ['newsletter'],
      },
    ] as const
    return c.html(
      <AdminShell ctx={ctx} title="Inboxes" activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/inbox/new">
            Create inbox
          </a>
        </p>
        <p class="muted">
          Built-in inboxes collect site forms. Create an additional inbox to define a custom form schema you can mount
          on any page.
        </p>
        <div class="admin-card-grid">
          {builtIn.map((box) => (
            <InboxHubCard
              href={box.href}
              title={box.title}
              description={box.description}
              newCount={sumNewSubmissionCounts(newCounts, [...box.types])}
            />
          ))}
          {customInboxes.map((row) => (
            <InboxHubCard
              href={`/admin/inbox/${encodeURIComponent(String(row.slug))}`}
              title={String(row.title ?? '')}
              description={`${String(row.description || `Custom form · ${row.slug}`)}${!row.active ? ' (inactive)' : ''}`}
              newCount={newCounts[String(row.slug)] ?? 0}
            />
          ))}
        </div>
      </AdminShell>,
    )
  })

  app.all('/admin/inbox/new', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
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

  for (const box of [
    { path: 'contact', types: ['contact'], title: 'Contact inbox' },
    { path: 'applications', types: ['member_application', 'award_application'], title: 'Applications inbox' },
    { path: 'training', types: ['training_registration', 'training_signin'], title: 'Training inbox' },
  ] as const) {
    app.get(`/admin/inbox/${box.path}`, async (c) => {
      const ctx = await requireAdmin(c)
      if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
      const page = parsePageParam(c.req.query('page'))
      const typeFilter = c.req.query('type') || undefined
      const status = c.req.query('status') || undefined
      const formType = typeFilter && box.types.includes(typeFilter as never) ? typeFilter : undefined
      let result
      if (formType) {
        result = await listFormSubmissionsPaginated(c.env.DB, page, formType, status)
      } else if (box.types.length === 1) {
        result = await listFormSubmissionsPaginated(c.env.DB, page, box.types[0], status)
      } else {
        result = await listFormSubmissionsPaginated(c.env.DB, page, undefined, status)
        result = {
          ...result,
          items: result.items.filter((row) => box.types.includes(String(row.form_type) as never)),
        }
      }
      return c.html(
        <AdminShell ctx={ctx} title={box.title} activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
          <p>
            <a class="btn btn-secondary" href="/admin/inbox">
              All inboxes
            </a>
          </p>
          <SubmissionTable items={result.items} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath={`/admin/inbox/${box.path}`}
          />
        </AdminShell>,
      )
    })
  }

  app.all('/admin/inbox/submission/:id', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const row = await getFormSubmissionById(c.env.DB, c.req.param('id'))
    if (!row) return c.text('Not found', 404)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteFormSubmission(c.env.DB, row.id as string)
        return redirect(c, '/admin/inbox')
      }
      if (typeof body.status === 'string') {
        await updateFormSubmissionStatus(c.env.DB, row.id as string, body.status)
      }
      return redirect(c, `/admin/inbox/submission/${row.id}`)
    }
    let pretty = String(row.payload_json ?? '')
    try {
      pretty = JSON.stringify(JSON.parse(pretty), null, 2)
    } catch {
      /* keep raw */
    }
    return c.html(
      <AdminShell ctx={ctx} title="Submission" activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <strong>Type:</strong> {escapeHtml(String(row.form_type))} · <strong>Status:</strong>{' '}
          {escapeHtml(String(row.status))} · <strong>Date:</strong> {escapeHtml(String(row.created_at))}
        </p>
        <pre class="admin-code">{escapeHtml(pretty)}</pre>
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
        <form method="post" class="admin-form">
          <input type="hidden" name="_action" value="delete" />
          <button class="btn btn-danger" type="submit">
            Delete
          </button>
        </form>
      </AdminShell>,
    )
  })

  app.get('/admin/inbox/newsletter', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const page = parsePageParam(c.req.query('page'))
    const search = parseSearchParam(c.req.query('q'))
    const result = await listNewsletterPaginated(c.env.DB, page, search)
    return c.html(
      <AdminShell ctx={ctx} title="Newsletter subscribers" activePath="/admin/inbox" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-secondary" href="/admin/inbox">
            All inboxes
          </a>{' '}
          <a class="btn btn-primary" href="/admin/inbox/newsletter/export.csv">
            Export CSV
          </a>
        </p>
        <ListSearch action="/admin/inbox/newsletter" query={search} placeholder="Search email or name…" />
        <table class="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Status</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
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
        />
      </AdminShell>,
    )
  })

  app.get('/admin/inbox/newsletter/export.csv', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
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
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const body = await c.req.parseBody()
    if (body._action === 'unsubscribe') {
      await updateNewsletterStatus(c.env.DB, c.req.param('id'), 'unsubscribed')
    } else if (body._action === 'delete') {
      await deleteNewsletterSubscriber(c.env.DB, c.req.param('id'))
    }
    return redirect(c, '/admin/inbox/newsletter')
  })

  app.all('/admin/inbox/:slug/edit', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const slug = c.req.param('slug')
    if (isReservedInboxSlug(slug)) return c.text('Not found', 404)
    const row = await getFormInboxBySlug(c.env.DB, slug)
    if (!row) return c.text('Not found', 404)
    let error = ''
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
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
    const mountSnippet = `<div data-nrcga-form-mount="${schema.slug}"></div>\n<script src="js/api-client.js"></script>\n<script src="js/native-forms.js"></script>`
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
        <div class="admin-form" style="margin-top:1.5rem">
          <h3>Put this form on a page</h3>
          <p class="muted">
            Paste the mount div where the form should appear (and include the scripts if the page does not already load
            them).
          </p>
          <pre class="admin-code">{escapeHtml(mountSnippet)}</pre>
          <p class="muted">
            Public endpoint: <code>GET /api/v1/forms/{escapeHtml(schema.slug)}</code> · submissions post to{' '}
            <code>POST /api/v1/forms/{escapeHtml(schema.slug)}</code>
          </p>
        </div>
      </AdminShell>,
    )
  })

  app.get('/admin/inbox/:slug', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const slug = c.req.param('slug')
    if (isReservedInboxSlug(slug)) return c.text('Not found', 404)
    const inbox = await getFormInboxBySlug(c.env.DB, slug)
    if (!inbox) return c.text('Not found', 404)
    const page = parsePageParam(c.req.query('page'))
    const status = c.req.query('status') || undefined
    const result = await listFormSubmissionsPaginated(c.env.DB, page, String(inbox.slug), status)
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
          <a class="btn btn-primary" href={`/admin/inbox/${encodeURIComponent(String(inbox.slug))}/edit`}>
            Edit form schema
          </a>
        </p>
        <SubmissionTable items={result.items} />
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          basePath={`/admin/inbox/${encodeURIComponent(String(inbox.slug))}`}
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

function SubmissionTable({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <table class="admin-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Status</th>
          <th>Summary</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr>
            <td>{escapeHtml(String(row.created_at ?? ''))}</td>
            <td>{escapeHtml(String(row.form_type ?? ''))}</td>
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
