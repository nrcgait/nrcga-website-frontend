import type { Hono } from 'hono'
import type { Env } from '../env'
import type { AdminContext } from '../lib/admin-context'
import { canAccessContentSection, canManageAllContent } from '../config/roles'
import { pageSlugsForCommittees } from '../config/committee-content'
import { escapeHtml } from '../lib/admin-context'
import {
  canEditCommitteeTagged,
  canEditPageSlug,
  chairCommittees,
} from '../lib/permissions'
import { parsePageParam } from '../lib/pagination'
import {
  deleteArchiveItem,
  deleteCarouselSlide,
  deleteProgram,
  deleteQaItem,
  deleteZeroDamage,
  getArchiveItemById,
  getCarouselSlideById,
  getPageById,
  getProgramById,
  getQaItemById,
  getZeroDamageById,
  listArchiveItemsPaginated,
  listCarouselSlidesPaginated,
  listCommittees,
  listPagesPaginated,
  listProgramsPaginated,
  listQaItemsPaginated,
  listZeroDamagesPaginated,
  upsertArchiveItem,
  upsertCarouselSlide,
  upsertPage,
  upsertProgram,
  upsertQaItem,
  upsertZeroDamage,
} from '../lib/content-db'
import { listFormInboxes } from '../lib/forms-db'
import { AdminShell } from '../views/AdminShell'
import { AssetUrlField, Pagination, CommitteeSelect } from '../views/AdminComponents'

type RequireAdmin = (c: { env: Env; req: { header: (name: string) => string | undefined } }) => Promise<AdminContext | null>
type Redirect = (c: { redirect: (url: string, status?: 303) => Response }, url: string) => Response

function committeeFilter(ctx: AdminContext): string[] | undefined {
  const slugs = chairCommittees(ctx)
  return slugs.length ? slugs : undefined
}

function chairPageSlugs(ctx: AdminContext): string[] | undefined {
  const slugs = pageSlugsForCommittees(chairCommittees(ctx))
  return slugs.length ? slugs : undefined
}

async function guardContent(
  c: { env: Env; req: { header: (name: string) => string | undefined }; redirect: (url: string, status?: 303) => Response },
  requireAdmin: RequireAdmin,
  redirect: Redirect,
  adminOnly = false,
): Promise<{ ctx: AdminContext; denied: null } | { ctx: null; denied: Response }> {
  const ctx = await requireAdmin(c)
  if (!ctx || !canAccessContentSection(ctx.user.role, ctx.chairCommittees)) {
    return { ctx: null, denied: redirect(c, '/admin/login') }
  }
  if (adminOnly && !canManageAllContent(ctx.user.role)) {
    return { ctx: null, denied: redirect(c, '/admin/content') }
  }
  return { ctx, denied: null }
}

function chairCanAccessPageSlug(ctx: AdminContext, slug: string): boolean {
  return canEditPageSlug(ctx, slug)
}

function formActions(saveLabel = 'Save') {
  return (
    <div class="admin-actions">
      <button class="btn btn-primary" type="submit">
        {saveLabel}
      </button>
      <button class="btn btn-danger" name="_action" value="delete" type="submit">
        Delete
      </button>
    </div>
  )
}

export function registerAdminContentRoutes(
  app: Hono<{ Bindings: Env }>,
  requireAdmin: RequireAdmin,
  redirect: Redirect,
) {
  app.get('/admin/content/carousel', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const result = await listCarouselSlidesPaginated(c.env.DB, page)
    return c.html(
      <AdminShell ctx={ctx} title="Carousel" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/carousel/new">
            Add slide
          </a>
        </p>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Alt</th>
              <th>Order</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.alt_text ?? ''))}</td>
                <td>{row.display_order}</td>
                <td>{row.active ? 'Yes' : 'No'}</td>
                <td>
                  <a href={`/admin/content/carousel/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/carousel" />
      </AdminShell>,
    )
  })

  app.all('/admin/content/carousel/new', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertCarouselSlide(c.env.DB, {
        image_url: body.image_url,
        image_r2_key: body.image_r2_key,
        alt_text: body.alt_text,
        link_url: body.link_url,
        display_order: body.display_order,
        active: body.active === '1' ? 1 : 0,
      })
      return redirect(c, '/admin/content/carousel')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add carousel slide" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <CarouselForm />
      </AdminShell>,
    )
  })

  app.all('/admin/content/carousel/:id/edit', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    const slide = await getCarouselSlideById(c.env.DB, c.req.param('id'))
    if (!slide) return c.text('Not found', 404)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteCarouselSlide(c.env.DB, slide.id as string)
        return redirect(c, '/admin/content/carousel')
      }
      await upsertCarouselSlide(
        c.env.DB,
        {
          image_url: body.image_url,
          image_r2_key: body.image_r2_key,
          alt_text: body.alt_text,
          link_url: body.link_url,
          display_order: body.display_order,
          active: body.active === '1' ? 1 : 0,
        },
        slide.id as string,
      )
      return redirect(c, '/admin/content/carousel')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit carousel slide" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <CarouselForm slide={slide} />
      </AdminShell>,
    )
  })

  app.get('/admin/content/programs', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const result = await listProgramsPaginated(c.env.DB, page, committeeFilter(ctx))
    return c.html(
      <AdminShell ctx={ctx} title="Programs" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/programs/new">
            Add program
          </a>
        </p>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Committee</th>
              <th>Link</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.title ?? ''))}</td>
                <td>{escapeHtml(String(row.committee_slug ?? ''))}</td>
                <td>{escapeHtml(String(row.link ?? ''))}</td>
                <td>
                  <a href={`/admin/content/programs/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/programs" />
      </AdminShell>,
    )
  })

  app.all('/admin/content/programs/new', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const committees = await listCommittees(c.env.DB)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertProgram(c.env.DB, {
        title: body.title,
        description: body.description,
        link: body.link,
        icon: body.icon,
        sort_order: body.sort_order,
        committee_slug: body.committee_slug || null,
      })
      return redirect(c, '/admin/content/programs')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add program" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <ProgramForm ctx={ctx} committees={committees as Array<{ slug: string; name: string }>} />
      </AdminShell>,
    )
  })

  app.all('/admin/content/programs/:id/edit', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const program = await getProgramById(c.env.DB, c.req.param('id'))
    if (!program) return c.text('Not found', 404)
    if (!canEditCommitteeTagged(ctx, program as Record<string, unknown>)) return c.text('Forbidden', 403)
    const committees = await listCommittees(c.env.DB)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteProgram(c.env.DB, program.id as string)
        return redirect(c, '/admin/content/programs')
      }
      await upsertProgram(
        c.env.DB,
        {
          title: body.title,
          description: body.description,
          link: body.link,
          icon: body.icon,
          sort_order: body.sort_order,
          committee_slug: body.committee_slug || null,
        },
        program.id as string,
      )
      return redirect(c, '/admin/content/programs')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit program" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <ProgramForm ctx={ctx} committees={committees as Array<{ slug: string; name: string }>} program={program as Record<string, unknown>} />
      </AdminShell>,
    )
  })

  app.get('/admin/content/archive', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const result = await listArchiveItemsPaginated(c.env.DB, page, committeeFilter(ctx))
    return c.html(
      <AdminShell ctx={ctx} title="Archive" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/archive/new">
            Add item
          </a>
        </p>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Committee</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.type ?? ''))}</td>
                <td>{escapeHtml(String(row.title ?? ''))}</td>
                <td>{escapeHtml(String(row.committee_slug ?? ''))}</td>
                <td>{escapeHtml(String(row.date ?? ''))}</td>
                <td>
                  <a href={`/admin/content/archive/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/archive" />
      </AdminShell>,
    )
  })

  app.all('/admin/content/archive/new', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const kind = (c.req.query('kind') ?? '').trim().toLowerCase()
    const canPost = canManageAllContent(ctx.user.role)

    if (!kind && c.req.method === 'GET') {
      return c.html(
        <AdminShell ctx={ctx} title="Add archive item" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
          <p class="admin-muted">What would you like to add?</p>
          <div class="admin-card-grid">
            <a class="admin-card" href="/admin/content/archive/new?kind=archive">
              <h3>Archive item</h3>
              <p>Meeting minutes or historical document (external link)</p>
            </a>
            {canPost ? (
              <a class="admin-card" href="/admin/content/posts/new">
                <h3>Post / update</h3>
                <p>Rich HTML newsletter or update published on the site</p>
              </a>
            ) : null}
          </div>
          <p>
            <a href="/admin/content/archive">Back to archive</a>
          </p>
        </AdminShell>,
      )
    }

    if (kind === 'post') {
      return redirect(c, '/admin/content/posts/new')
    }

    const committees = await listCommittees(c.env.DB)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertArchiveItem(c.env.DB, {
        type: body.type,
        title: body.title,
        date: body.date,
        link: body.link,
        committee_slug: body.committee_slug || null,
      })
      return redirect(c, '/admin/content/archive')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add archive item" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a href="/admin/content/archive/new">← Choose a different type</a>
        </p>
        <ArchiveForm ctx={ctx} committees={committees as Array<{ slug: string; name: string }>} />
      </AdminShell>,
    )
  })

  app.all('/admin/content/archive/:id/edit', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const item = await getArchiveItemById(c.env.DB, c.req.param('id'))
    if (!item) return c.text('Not found', 404)
    if (!canEditCommitteeTagged(ctx, item as Record<string, unknown>)) return c.text('Forbidden', 403)
    const committees = await listCommittees(c.env.DB)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteArchiveItem(c.env.DB, item.id as string)
        return redirect(c, '/admin/content/archive')
      }
      await upsertArchiveItem(
        c.env.DB,
        {
          type: body.type,
          title: body.title,
          date: body.date,
          link: body.link,
          committee_slug: body.committee_slug || null,
        },
        item.id as string,
      )
      return redirect(c, '/admin/content/archive')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit archive item" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <ArchiveForm ctx={ctx} committees={committees as Array<{ slug: string; name: string }>} item={item as Record<string, unknown>} />
      </AdminShell>,
    )
  })

  app.get('/admin/content/zero-damages', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const result = await listZeroDamagesPaginated(c.env.DB, page)
    return c.html(
      <AdminShell ctx={ctx} title="Zero at-fault damages" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/zero-damages/new">
            Add company
          </a>
        </p>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Company</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.company ?? ''))}</td>
                <td>
                  <a href={`/admin/content/zero-damages/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/zero-damages" />
      </AdminShell>,
    )
  })

  app.all('/admin/content/zero-damages/new', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertZeroDamage(c.env.DB, String(body.company ?? ''))
      return redirect(c, '/admin/content/zero-damages')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add company" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <form method="post" class="admin-form">
          <label>Company name</label>
          <input name="company" required />
          <div class="admin-actions">
            <button class="btn btn-primary" type="submit">
              Save
            </button>
          </div>
        </form>
      </AdminShell>,
    )
  })

  app.all('/admin/content/zero-damages/:id/edit', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    const row = await getZeroDamageById(c.env.DB, c.req.param('id'))
    if (!row) return c.text('Not found', 404)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteZeroDamage(c.env.DB, row.id as string)
        return redirect(c, '/admin/content/zero-damages')
      }
      await upsertZeroDamage(c.env.DB, String(body.company ?? ''), row.id as string)
      return redirect(c, '/admin/content/zero-damages')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit company" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <form method="post" class="admin-form">
          <label>Company name</label>
          <input name="company" required value={String(row.company ?? '')} />
          {formActions()}
        </form>
      </AdminShell>,
    )
  })

  app.get('/admin/content/qa', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const result = await listQaItemsPaginated(c.env.DB, page)
    return c.html(
      <AdminShell ctx={ctx} title="Q & A" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p>
          <a class="btn btn-primary" href="/admin/content/qa/new">
            Add question
          </a>
        </p>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Published</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.question ?? ''))}</td>
                <td>{row.published ? 'Yes' : 'No'}</td>
                <td>
                  <a href={`/admin/content/qa/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/qa" />
      </AdminShell>,
    )
  })

  app.all('/admin/content/qa/new', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertQaItem(c.env.DB, {
        question: body.question,
        answer_md: body.answer_md,
        sort_order: body.sort_order,
        published: body.published === '1' ? 1 : 0,
      })
      return redirect(c, '/admin/content/qa')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add Q & A" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <QaForm />
      </AdminShell>,
    )
  })

  app.all('/admin/content/qa/:id/edit', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    const item = await getQaItemById(c.env.DB, c.req.param('id'))
    if (!item) return c.text('Not found', 404)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteQaItem(c.env.DB, item.id as string)
        return redirect(c, '/admin/content/qa')
      }
      await upsertQaItem(
        c.env.DB,
        {
          question: body.question,
          answer_md: body.answer_md,
          sort_order: body.sort_order,
          published: body.published === '1' ? 1 : 0,
        },
        item.id as string,
      )
      return redirect(c, '/admin/content/qa')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit Q & A" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <QaForm item={item} />
      </AdminShell>,
    )
  })

  app.get('/admin/content/pages', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const slugFilter = chairPageSlugs(ctx)
    const result = await listPagesPaginated(c.env.DB, page, slugFilter)
    return c.html(
      <AdminShell ctx={ctx} title="Pages" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        {canManageAllContent(ctx.user.role) ? (
          <p>
            <a class="btn btn-primary" href="/admin/content/pages/new">
              Add page
            </a>
          </p>
        ) : null}
        <table class="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Title</th>
              <th>Published</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.slug ?? ''))}</td>
                <td>{escapeHtml(String(row.title ?? ''))}</td>
                <td>{row.published ? 'Yes' : 'No'}</td>
                <td>
                  <a href={`/admin/content/pages/${row.id}/edit`}>Edit</a>
                  {row.slug ? (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        href={pageLiveUrl(c.env.PUBLIC_SITE_ORIGIN, String(row.slug), row.is_custom)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Preview
                      </a>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/pages" />
      </AdminShell>,
    )
  })

  app.all('/admin/content/pages/new', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect, true)
    if (denied) return denied
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertPage(c.env.DB, parsePageForm(body as Record<string, string | File>))
      return redirect(c, '/admin/content/pages')
    }
    const formInboxes = await listFormInboxes(c.env.DB, true)
    return c.html(
      <AdminShell ctx={ctx} title="Add page" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <PageForm publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN} formInboxes={formInboxes} />
      </AdminShell>,
    )
  })

  app.all('/admin/content/pages/:id/edit', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const page = await getPageById(c.env.DB, c.req.param('id'))
    if (!page) return c.text('Not found', 404)
    if (!chairCanAccessPageSlug(ctx, String(page.slug ?? ''))) return c.text('Forbidden', 403)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await c.env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(page.id).run()
        return redirect(c, '/admin/content/pages')
      }
      await upsertPage(c.env.DB, parsePageForm(body as Record<string, string | File>), page.id as string)
      return redirect(c, '/admin/content/pages')
    }
    const formInboxes = await listFormInboxes(c.env.DB, true)
    return c.html(
      <AdminShell ctx={ctx} title="Edit page" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <PageForm page={page} publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN} formInboxes={formInboxes} />
      </AdminShell>,
    )
  })
}

function pageLiveUrl(publicSiteOrigin: string, slug: string, isCustom?: unknown) {
  if (!slug) return undefined
  if (slug === 'home') return `${publicSiteOrigin}/index.html`
  if (isCustom) return `${publicSiteOrigin}/page.html?slug=${encodeURIComponent(slug)}`
  return `${publicSiteOrigin}/${slug}.html`
}

const DEFAULT_HOME_HERO = `<div class="hero-badge">Nevada Regional Common Ground Alliance</div>
<h1 class="hero-title">
    Safer digging starts with<br>
    <span class="highlight">clear communication</span><br>
    and solid process.
</h1>
<p class="hero-description">
    NRCGA supports Nevada's damage prevention community with education, training, and programs
    that promote safe excavation and protection of buried infrastructure.
</p>
<div class="hero-actions">
    <a href="about.html" class="btn btn-primary">Learn About The NRCGA</a>
    <a href="about-811.html" class="btn btn-secondary">Learn About 811</a>
    <a href="training.html" class="btn btn-primary">View Training</a>
</div>`

const DEFAULT_HOME_CONTACT = `<h2>Get in Touch</h2>
<p>Have questions? Want to get involved? We'd love to hear from you.</p>
<div class="contact-details">
    <div class="contact-item">
        <strong>Email</strong>
        <a href="mailto:info@nrcga.org">info@nrcga.org</a>
    </div>
    <div class="contact-item">
        <strong>Response Time</strong>
        <span>1–2 business days</span>
    </div>
</div>`

function parsePageForm(body: Record<string, string | File>) {
  const slug = String(body.slug ?? '')
  let regionsJson: string | null = body.regions_json ? String(body.regions_json) : null
  if (slug === 'home') {
    const hero = body.hero_html != null ? String(body.hero_html) : ''
    const contact = body.contact_html != null ? String(body.contact_html) : ''
    regionsJson = JSON.stringify({ hero_html: hero, contact_html: contact })
  }
  return {
    slug,
    title: String(body.title ?? ''),
    section_label: body.section_label ? String(body.section_label) : null,
    subtitle: body.subtitle ? String(body.subtitle) : null,
    body_md: body.body_md ? String(body.body_md) : null,
    body_json: body.body_json ? String(body.body_json) : null,
    body_html: body.body_html != null ? String(body.body_html) : null,
    regions_json: regionsJson,
    published: body.published === '1' ? 1 : 0,
    is_custom: body.is_custom === '1' ? 1 : 0,
  }
}

function CarouselForm({ slide }: { slide?: Record<string, unknown> }) {
  return (
    <form method="post" class="admin-form">
      <AssetUrlField
        label="Image URL"
        name="image_url"
        value={String(slide?.image_url ?? '')}
        r2Name="image_r2_key"
        r2Value={String(slide?.image_r2_key ?? '')}
      />
      <label>Alt text</label>
      <input name="alt_text" value={String(slide?.alt_text ?? '')} />
      <label>Link URL</label>
      <input name="link_url" value={String(slide?.link_url ?? '')} />
      <label>Display order</label>
      <input name="display_order" type="number" value={String(slide?.display_order ?? 0)} />
      <label>
        <input type="checkbox" name="active" value="1" checked={slide?.active !== 0} /> Active
      </label>
      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">
          Save
        </button>
        {slide ? (
          <button class="btn btn-danger" name="_action" value="delete" type="submit">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  )
}

function ProgramForm({
  ctx,
  committees,
  program,
}: {
  ctx: AdminContext
  committees: Array<{ slug: string; name: string }>
  program?: Record<string, unknown>
}) {
  const allowed = ctx.user.role === 'admin' ? null : chairCommittees(ctx)
  return (
    <form method="post" class="admin-form">
      <CommitteeSelect
        committees={committees}
        allowedSlugs={allowed}
        selectedSlug={String(program?.committee_slug ?? allowed?.[0] ?? '')}
        required={ctx.user.role !== 'admin'}
      />
      <label>Title</label>
      <input name="title" required value={String(program?.title ?? '')} />
      <label>Description</label>
      <textarea name="description">{String(program?.description ?? '')}</textarea>
      <label>Link</label>
      <input name="link" value={String(program?.link ?? '')} />
      <label>Icon (CSS class or path)</label>
      <input name="icon" value={String(program?.icon ?? '')} />
      <label>Sort order</label>
      <input name="sort_order" type="number" value={String(program?.sort_order ?? 0)} />
      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">
          Save
        </button>
        {program ? (
          <button class="btn btn-danger" name="_action" value="delete" type="submit">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  )
}

function ArchiveForm({
  ctx,
  committees,
  item,
}: {
  ctx: AdminContext
  committees: Array<{ slug: string; name: string }>
  item?: Record<string, unknown>
}) {
  const allowed = ctx.user.role === 'admin' ? null : chairCommittees(ctx)
  return (
    <form method="post" class="admin-form">
      <CommitteeSelect
        committees={committees}
        allowedSlugs={allowed}
        selectedSlug={String(item?.committee_slug ?? allowed?.[0] ?? '')}
        required={ctx.user.role !== 'admin'}
      />
      <label>Type</label>
      <select name="type">
        <option value="meeting-minute" selected={item?.type === 'meeting-minute'}>
          Meeting minute
        </option>
        <option value="historical-document" selected={item?.type === 'historical-document'}>
          Historical document
        </option>
      </select>
      <label>Title</label>
      <input name="title" required value={String(item?.title ?? '')} />
      <label>Date</label>
      <input name="date" type="date" required value={String(item?.date ?? '')} />
      <label>Link (URL, R2 media path, or path)</label>
      <input name="link" required value={String(item?.link ?? '')} />
      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">
          Save
        </button>
        {item ? (
          <button class="btn btn-danger" name="_action" value="delete" type="submit">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  )
}

function QaForm({ item }: { item?: Record<string, unknown> }) {
  return (
    <form method="post" class="admin-form">
      <label>Question</label>
      <input name="question" required value={String(item?.question ?? '')} />
      <label>Answer (markdown)</label>
      <textarea name="answer_md" class="admin-textarea-tall">
        {String(item?.answer_md ?? '')}
      </textarea>
      <label>Sort order</label>
      <input name="sort_order" type="number" value={String(item?.sort_order ?? 0)} />
      <label>
        <input type="checkbox" name="published" value="1" checked={item?.published !== 0} /> Published
      </label>
      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">
          Save
        </button>
        {item ? (
          <button class="btn btn-danger" name="_action" value="delete" type="submit">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  )
}

function PageForm({
  page,
  publicSiteOrigin,
  formInboxes = [],
}: {
  page?: Record<string, unknown>
  publicSiteOrigin: string
  formInboxes?: Array<Record<string, unknown>>
}) {
  const slug = String(page?.slug ?? '')
  const isHome = slug === 'home'
  let regions: { hero_html?: string; contact_html?: string } = {}
  if (page?.regions_json) {
    try {
      regions = JSON.parse(String(page.regions_json)) as { hero_html?: string; contact_html?: string }
    } catch {
      regions = {}
    }
  }
  const heroHtml = String(regions.hero_html || (isHome ? DEFAULT_HOME_HERO : ''))
  const contactHtml = String(regions.contact_html || (isHome ? DEFAULT_HOME_CONTACT : ''))
  const bodyHtml = page?.body_html != null ? String(page.body_html) : ''
  const bodyJsonFallback = !bodyHtml && page?.body_json ? String(page.body_json) : ''
  const liveHref = pageLiveUrl(publicSiteOrigin, slug, page?.is_custom)
  const inboxPickerData = JSON.stringify(
    formInboxes.map((row) => ({
      slug: String(row.slug ?? ''),
      title: String(row.title ?? row.slug ?? ''),
    })),
  )

  return (
    <form method="post" class="admin-form admin-page-rich-form" id="page-form">
      <div class="admin-page-meta-grid">
        <label>Slug (URL key)</label>
        <input name="slug" required value={slug} placeholder="silver-shovel-award" id="page-slug-input" />
        <label>Title</label>
        <input name="title" required value={String(page?.title ?? '')} />
        <label>Section label</label>
        <input name="section_label" value={String(page?.section_label ?? '')} />
        <label>Subtitle</label>
        <input name="subtitle" value={String(page?.subtitle ?? '')} />
        <label class="admin-checkbox-label">
          <input type="checkbox" name="published" value="1" checked={page?.published !== 0} /> Published
        </label>
        <label class="admin-checkbox-label">
          <input type="checkbox" name="is_custom" value="1" checked={!!page?.is_custom} /> Custom page (served via
          page.html?slug=…)
        </label>
      </div>

      {isHome ? (
        <div class="admin-rich-section">
          <h3>Hero</h3>
          <p class="admin-muted">Badge, headline, description, and CTA buttons shown under the hero image.</p>
          <div
            class="tiptap-host"
            data-rich-editor
            data-field="hero_html"
            data-form="page-form"
            data-initial={heroHtml}
          ></div>
          <textarea name="hero_html" id="hero_html" class="admin-hidden-field">{heroHtml}</textarea>
        </div>
      ) : null}

      <div class="admin-rich-section">
        <h3>{isHome ? 'Mission / main content' : 'Page body'}</h3>
        <p class="admin-muted">
          Edit text inline. Use Font / Color / Size in the toolbar (select text first, or place the cursor in a
          paragraph). Insert Image, Button, Callout, Embed, Form, Grid, or Spacer as needed. Hover a block to see its
          bounds; right-click to edit images, buttons, callouts, embeds, forms, and grids.
        </p>
        <div
          class="tiptap-host"
          data-rich-editor
          data-field="body_html"
          data-form="page-form"
          data-form-inboxes={inboxPickerData}
          data-initial={bodyHtml}
          data-fallback-json={bodyJsonFallback || undefined}
        ></div>
        <textarea name="body_html" id="body_html" class="admin-hidden-field">{bodyHtml}</textarea>
        {page?.body_json ? <input type="hidden" name="body_json" value={String(page.body_json)} /> : null}
      </div>

      {isHome ? (
        <div class="admin-rich-section">
          <h3>Contact copy</h3>
          <p class="admin-muted">Heading, blurb, and contact details. The contact form stays on the page separately.</p>
          <div
            class="tiptap-host"
            data-rich-editor
            data-field="contact_html"
            data-form="page-form"
            data-initial={contactHtml}
          ></div>
          <textarea name="contact_html" id="contact_html" class="admin-hidden-field">{contactHtml}</textarea>
        </div>
      ) : null}

      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">
          Save page
        </button>
        {page ? (
          <button class="btn btn-danger" name="_action" value="delete" type="submit">
            Delete
          </button>
        ) : null}
        <a
          class="btn btn-secondary"
          id="page-live-link"
          href={liveHref}
          target="_blank"
          rel="noopener noreferrer"
          hidden={!slug}
        >
          View live page
        </a>
      </div>

      <script src="/page-blocks-render.js"></script>
      <script src="/tiptap-editor.js"></script>
    </form>
  )
}
