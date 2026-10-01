import { Hono } from 'hono'
import type { Env } from './env'
import { registerPublicApiRoutes } from './routes/api'
import { registerAdminRoutes } from './routes/admin'
import { applySecurityHeaders, isHttpsRequest, type SecurityHeaderMode } from './lib/security-headers'

const app = new Hono<{ Bindings: Env }>()

function securityMode(path: string): SecurityHeaderMode {
  if (path.startsWith('/admin/login') || path.startsWith('/admin/forgot-password') || path.startsWith('/admin/reset-password')) {
    return 'adminAuth'
  }
  if (path.startsWith('/admin')) return 'admin'
  return 'api'
}

app.use('*', async (c, next) => {
  await next()
  const mode = securityMode(c.req.path)
  const https = isHttpsRequest(c.req.url)
  const secured = applySecurityHeaders(c.res, mode, https)
  c.res = secured
})

app.onError((err, c) => {
  console.error(err)
  return c.text('Internal Server Error', 500)
})

registerPublicApiRoutes(app)
registerAdminRoutes(app)

app.get('/', (c) => c.redirect('/admin', 302))

app.get('/health', (c) => c.json({ ok: true }))

export default app
