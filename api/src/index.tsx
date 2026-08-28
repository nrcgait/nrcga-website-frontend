import { Hono } from 'hono'
import type { Env } from './env'
import { registerPublicApiRoutes } from './routes/api'
import { registerAdminRoutes } from './routes/admin'

const app = new Hono<{ Bindings: Env }>()

app.onError((err, c) => {
  console.error(err)
  return c.text('Internal Server Error', 500)
})

registerPublicApiRoutes(app)
registerAdminRoutes(app)

app.get('/', (c) => c.redirect('/admin', 302))

app.get('/health', (c) => c.json({ ok: true }))

export default app
