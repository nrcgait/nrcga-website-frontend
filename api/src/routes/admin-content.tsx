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
  deleteEmbed,
  deleteProgram,
  deleteQaItem,
  deleteZeroDamage,
  getArchiveItemById,
  getCarouselSlideById,
  getEmbedById,
  getPageById,
  getProgramById,
  getQaItemById,
  getZeroDamageById,
  listArchiveItemsPaginated,
  listCarouselSlidesPaginated,
  listCommittees,
  listEmbedsPaginated,
  listPagesPaginated,
  listProgramsPaginated,
  listQaItemsPaginated,
  listZeroDamagesPaginated,
  upsertArchiveItem,
  upsertCarouselSlide,
  upsertEmbed,
  upsertPage,
  upsertProgram,
  upsertQaItem,
  upsertZeroDamage,
} from '../lib/content-db'
import { AdminShell } from '../views/AdminShell'
import { Pagination, CommitteeSelect } from '../views/AdminComponents'

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
                      <a href={`${c.env.PUBLIC_SITE_ORIGIN}/${String(row.slug)}.html`} target="_blank" rel="noopener noreferrer">
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
    return c.html(
      <AdminShell ctx={ctx} title="Add page" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <PageForm publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN} />
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
    return c.html(
      <AdminShell ctx={ctx} title="Edit page" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <PageForm page={page} publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN} />
      </AdminShell>,
    )
  })

  app.get('/admin/content/embeds', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const slugFilter = chairPageSlugs(ctx)
    const result = await listEmbedsPaginated(c.env.DB, page, slugFilter)
    return c.html(
      <AdminShell ctx={ctx} title="Embeds" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        {canManageAllContent(ctx.user.role) ? (
          <p>
            <a class="btn btn-primary" href="/admin/content/embeds/new">
              Add embed
            </a>
          </p>
        ) : null}
        <table class="admin-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Type</th>
              <th>URL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr>
                <td>{escapeHtml(String(row.page_slug ?? ''))}</td>
                <td>{escapeHtml(String(row.embed_type ?? ''))}</td>
                <td>{escapeHtml(String(row.url ?? ''))}</td>
                <td>
                  <a href={`/admin/content/embeds/${row.id}/edit`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/content/embeds" />
      </AdminShell>,
    )
  })

  app.all('/admin/content/embeds/new', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    if (!canManageAllContent(ctx.user.role)) return c.text('Forbidden', 403)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      await upsertEmbed(c.env.DB, {
        page_slug: body.page_slug,
        embed_type: body.embed_type,
        url: body.url,
        label: body.label,
        config_json: body.config_json,
      })
      return redirect(c, '/admin/content/embeds')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Add embed" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <EmbedForm />
      </AdminShell>,
    )
  })

  app.all('/admin/content/embeds/:id/edit', async (c) => {
    const { ctx, denied } = await guardContent(c, requireAdmin, redirect)
    if (denied) return denied
    const embed = await getEmbedById(c.env.DB, c.req.param('id'))
    if (!embed) return c.text('Not found', 404)
    if (!chairCanAccessPageSlug(ctx, String(embed.page_slug ?? ''))) return c.text('Forbidden', 403)
    if (c.req.method === 'POST') {
      const body = await c.req.parseBody()
      if (body._action === 'delete') {
        await deleteEmbed(c.env.DB, embed.id as string)
        return redirect(c, '/admin/content/embeds')
      }
      await upsertEmbed(
        c.env.DB,
        {
          page_slug: body.page_slug,
          embed_type: body.embed_type,
          url: body.url,
          label: body.label,
          config_json: body.config_json,
        },
        embed.id as string,
      )
      return redirect(c, '/admin/content/embeds')
    }
    return c.html(
      <AdminShell ctx={ctx} title="Edit embed" activePath="/admin/content" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <EmbedForm embed={embed} />
      </AdminShell>,
    )
  })
}

function parsePageForm(body: Record<string, string | File>) {
  return {
    slug: String(body.slug ?? ''),
    title: String(body.title ?? ''),
    section_label: body.section_label ? String(body.section_label) : null,
    subtitle: body.subtitle ? String(body.subtitle) : null,
    body_md: body.body_md ? String(body.body_md) : null,
    body_json: body.body_json ? String(body.body_json) : null,
    published: body.published === '1' ? 1 : 0,
  }
}

function CarouselForm({ slide }: { slide?: Record<string, unknown> }) {
  return (
    <form method="post" class="admin-form">
      <label>Image URL</label>
      <input name="image_url" value={String(slide?.image_url ?? '')} />
      <label>R2 key (optional)</label>
      <input name="image_r2_key" value={String(slide?.image_r2_key ?? '')} />
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

function PageForm({ page, publicSiteOrigin }: { page?: Record<string, unknown>; publicSiteOrigin: string }) {
  const blocksJson = page?.body_json ? String(page.body_json) : '[]'
  return (
    <div class="admin-page-editor-visual" data-public-site-origin={publicSiteOrigin}>
      <form method="post" class="admin-form admin-page-meta-form" id="page-form">
        <div class="admin-page-meta-grid">
          <label>Slug (URL key)</label>
          <input name="slug" required value={String(page?.slug ?? '')} placeholder="silver-shovel-award" />
          <label>Title</label>
          <input name="title" required value={String(page?.title ?? '')} />
          <label>Section label</label>
          <input name="section_label" value={String(page?.section_label ?? '')} />
          <label>Subtitle</label>
          <input name="subtitle" value={String(page?.subtitle ?? '')} />
          <label class="admin-checkbox-label">
            <input type="checkbox" name="published" value="1" checked={page?.published !== 0} /> Published
          </label>
        </div>
        <input type="hidden" id="body_json" name="body_json" value={blocksJson} />
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
            href={page?.slug ? `${publicSiteOrigin}/${String(page.slug)}.html` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            hidden={!page?.slug}
          >
            View live page
          </a>
        </div>
      </form>

      <div class="admin-page-workspace">
        <div class="admin-page-preview-col">
          <div class="admin-page-editor-preview-header">
            <div>
              <h3>Live preview</h3>
              <p class="admin-muted">Click any section to edit it.</p>
            </div>
            <div class="admin-page-editor-preview-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="page-preview-refresh">
                Refresh
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="page-preview-open-tab">
                Open in tab
              </button>
            </div>
          </div>
          <iframe
            id="page-preview-frame"
            class="admin-page-preview-frame"
            title="Page preview"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          ></iframe>
        </div>

        <aside class="admin-page-inspector-col">
          <h3>Block editor</h3>
          <div id="page-add-block-menu" class="page-add-block-menu"></div>
          <p id="page-inspector-empty" class="inspector-hint">
            Click a block in the preview to edit its content and design.
          </p>
          <div id="page-inspector-panel" class="page-inspector-panel" hidden></div>
        </aside>
      </div>

      <script src="/page-blocks-render.js"></script>
      <script src="/page-blocks-editor.js"></script>
      <script src="/page-block-inspector.js"></script>
      <script src="/page-preview.js"></script>
    </div>
  )
}

function EmbedForm({ embed }: { embed?: Record<string, unknown> }) {
  return (
    <form method="post" class="admin-form">
      <label>Page slug</label>
      <input name="page_slug" required value={String(embed?.page_slug ?? '')} placeholder="contact" />
      <label>Embed type</label>
      <select name="embed_type">
        <option value="ms_forms" selected={embed?.embed_type === 'ms_forms'}>
          Microsoft Forms
        </option>
        <option value="youtube" selected={embed?.embed_type === 'youtube'}>
          YouTube
        </option>
        <option value="pdf" selected={embed?.embed_type === 'pdf'}>
          PDF
        </option>
      </select>
      <label>URL</label>
      <input name="url" required value={String(embed?.url ?? '')} />
      <label>Label</label>
      <input name="label" value={String(embed?.label ?? '')} />
      <label>Config JSON (optional)</label>
      <textarea name="config_json">{String(embed?.config_json ?? '')}</textarea>
      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">
          Save
        </button>
        {embed ? (
          <button class="btn btn-danger" name="_action" value="delete" type="submit">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  )
}
