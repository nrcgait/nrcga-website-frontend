import type { Hono } from 'hono'
import type { Env } from '../env'
import type { AdminContext } from '../lib/admin-context'
import { escapeHtml } from '../lib/admin-context'
import { canAccessAssets, canManageAllContent } from '../config/roles'
import { parsePageParam } from '../lib/pagination'
import {
  deleteR2Asset,
  formatBytes,
  getR2Object,
  listR2Assets,
  mediaUrlForKey,
  uploadR2Asset,
} from '../lib/r2-assets'
import { AdminShell } from '../views/AdminShell'
import { Pagination } from '../views/AdminComponents'

type RequireAdmin = (c: { env: Env; req: { header: (name: string) => string | undefined } }) => Promise<AdminContext | null>
type Redirect = (c: { redirect: (url: string, status?: 303) => Response }, url: string) => Response

async function guardAssets(
  c: { env: Env; req: { header: (name: string) => string | undefined }; redirect: (url: string, status?: 303) => Response },
  requireAdmin: RequireAdmin,
  redirect: Redirect,
): Promise<{ ctx: AdminContext; denied: null } | { ctx: null; denied: Response }> {
  const ctx = await requireAdmin(c)
  if (!ctx || !canAccessAssets(ctx.user.role)) {
    return { ctx: null, denied: redirect(c, '/admin/login') }
  }
  return { ctx, denied: null }
}

export function registerAdminAssetRoutes(
  app: Hono<{ Bindings: Env }>,
  requireAdmin: RequireAdmin,
  redirect: Redirect,
) {
  app.get('/admin/assets', async (c) => {
    const { ctx, denied } = await guardAssets(c, requireAdmin, redirect)
    if (denied) return denied
    const page = parsePageParam(c.req.query('page'))
    const result = await listR2Assets(c.env.R2, c.env.DB, page)
    return c.html(
      <AdminShell ctx={ctx} title="Assets" activePath="/admin/assets" publicSiteOrigin={c.env.PUBLIC_SITE_ORIGIN}>
        <p class="muted">
          Files stored in R2 (persistent media). Static site assets deployed with Pages are separate and are not listed
          here.
        </p>
        <form method="post" action="/admin/assets/upload" encType="multipart/form-data" class="admin-form">
          <label>Upload file to R2</label>
          <input type="file" name="file" required />
          <div class="admin-actions">
            <button class="btn btn-primary" type="submit">
              Upload
            </button>
          </div>
        </form>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Size</th>
              <th>Uploaded</th>
              <th>Public URL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colspan={5} class="muted">
                  No files in R2 yet. Upload images, PDFs, and other media here.
                </td>
              </tr>
            ) : (
              result.items.map((asset) => (
                <tr>
                  <td>{escapeHtml(asset.filename)}</td>
                  <td>{formatBytes(asset.size)}</td>
                  <td>{escapeHtml(asset.uploaded?.slice(0, 10) ?? '')}</td>
                  <td>
                    <a href={mediaUrlForKey(asset.key)} target="_blank" rel="noopener">
                      {escapeHtml(asset.key)}
                    </a>
                  </td>
                  <td>
                    <a class="btn btn-secondary" href={`/admin/assets/download?key=${encodeURIComponent(asset.key)}`}>
                      Download
                    </a>
                    {canManageAllContent(ctx.user.role) ? (
                      <form method="post" action="/admin/assets/delete" class="admin-form-inline">
                        <input type="hidden" name="key" value={asset.key} />
                        <button class="btn btn-danger" type="submit">
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} basePath="/admin/assets" />
      </AdminShell>,
    )
  })

  app.post('/admin/assets/upload', async (c) => {
    const { ctx, denied } = await guardAssets(c, requireAdmin, redirect)
    if (denied) return denied
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File) || file.size === 0) {
      return c.text('No file uploaded', 400)
    }
    await uploadR2Asset(c.env.R2, c.env.DB, file, ctx.user.id)
    return redirect(c, '/admin/assets')
  })

  app.get('/admin/assets/download', async (c) => {
    const { ctx, denied } = await guardAssets(c, requireAdmin, redirect)
    if (denied) return denied
    const key = c.req.query('key') ?? ''
    const object = await getR2Object(c.env.R2, key)
    if (!object) return c.text('Not found', 404)
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    const filename = key.split('/').pop() ?? 'download'
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    return new Response(object.body, { headers })
  })

  app.post('/admin/assets/delete', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx || !canManageAllContent(ctx.user.role)) return redirect(c, '/admin/login')
    const body = await c.req.parseBody()
    const key = String(body.key ?? '')
    if (key) await deleteR2Asset(c.env.R2, c.env.DB, key)
    return redirect(c, '/admin/assets')
  })

  app.get('/admin/api/assets', async (c) => {
    const ctx = await requireAdmin(c)
    if (!ctx) return c.json({ error: 'Unauthorized' }, 401)
    const result = await listR2Assets(c.env.R2, c.env.DB, 1)
    return c.json({
      assets: result.items.map((asset) => ({
        key: asset.key,
        name: asset.filename,
        url: mediaUrlForKey(asset.key),
      })),
    })
  })
}
