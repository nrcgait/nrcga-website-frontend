import type { Hono } from 'hono'
import type { Env } from '../env'
import {
  getBreakingNews,
  getContactInfo,
  getFooterInfo,
  getNavigation,
  getSiteLogoUrl,
} from '../lib/site-settings'
import {
  listArchiveItems,
  listCarouselSlides,
  listCommitteesData,
  listEmbeds,
  listMembers,
  listPages,
  listPrograms,
  listQaItems,
  listZeroDamages,
  getPageBySlug,
  membersForPublicApi,
} from '../lib/content-db'
import {
  cancelEventOccurrence,
  cancelEventSeries,
  getEventById,
  listExpandedPublishedEvents,
  markOccurrenceGuestsNotified,
} from '../lib/events-db'
import { getAvailability, listRegistrations, registerGuest } from '../lib/event-registrations'
import { sendCancellationNotifications } from '../lib/site-settings'
import { withCors, corsHeaders } from '../lib/cors'

export function registerPublicApiRoutes(app: Hono<{ Bindings: Env }>) {
  app.options('/api/v1/*', (c) => {
    const headers = corsHeaders(c.req.header('Origin') ?? '', c.env)
    return new Response(null, { status: 204, headers })
  })

  app.get('/api/v1/members', async (c) => {
    const rows = await listMembers(c.env.DB)
    return withCors(c, membersForPublicApi(rows as Record<string, unknown>[]))
  })
  app.get('/api/v1/programs', async (c) => withCors(c, await listPrograms(c.env.DB)))
  app.get('/api/v1/archive', async (c) => withCors(c, await listArchiveItems(c.env.DB)))
  app.get('/api/v1/carousel', async (c) => {
    const slides = await listCarouselSlides(c.env.DB)
    const mapped = slides.map((s: Record<string, unknown>) => ({
      image_url: s.image_url || (s.image_r2_key ? `/api/v1/media/${s.image_r2_key}` : ''),
      alt_text: s.alt_text,
      link_url: s.link_url,
      display_order: s.display_order,
      active: s.active,
    }))
    return withCors(c, mapped)
  })
  app.get('/api/v1/breaking-news', async (c) => withCors(c, await getBreakingNews(c.env.DB)))
  app.get('/api/v1/committees', async (c) => withCors(c, await listCommitteesData(c.env.DB)))
  app.get('/api/v1/zero-damages', async (c) => withCors(c, await listZeroDamages(c.env.DB)))
  app.get('/api/v1/qa', async (c) => withCors(c, await listQaItems(c.env.DB, true)))
  app.get('/api/v1/embeds', async (c) => withCors(c, await listEmbeds(c.env.DB)))
  app.get('/api/v1/pages', async (c) => withCors(c, await listPages(c.env.DB)))

  app.get('/api/v1/pages/:slug', async (c) => {
    const page = await getPageBySlug(c.env.DB, c.req.param('slug'), true)
    if (!page) return withCors(c, { error: 'Not found' }, 404)
    return withCors(c, page)
  })

  app.get('/api/v1/navigation', async (c) => withCors(c, (await getNavigation(c.env.DB)) ?? null))
  app.get('/api/v1/settings', async (c) =>
    withCors(c, {
      contact: await getContactInfo(c.env.DB),
      footer: await getFooterInfo(c.env.DB),
      logo_url: await getSiteLogoUrl(c.env.DB),
    }),
  )

  app.get('/api/v1/events', async (c) => {
    const category = c.req.query('category') ?? undefined
    const events = await listExpandedPublishedEvents(c.env.DB, category, true)
    return withCors(c, { events })
  })

  app.get('/api/v1/events/:id/availability', async (c) => {
    const event = await getEventById(c.env.DB, c.req.param('id'))
    const occurrenceDate = c.req.query('occurrence_date')
    if (!event || !occurrenceDate) return withCors(c, { error: 'Not found' }, 404)
    return withCors(c, await getAvailability(c.env.DB, event, occurrenceDate))
  })

  app.post('/api/v1/events/:id/register', async (c) => {
    const event = await getEventById(c.env.DB, c.req.param('id'))
    if (!event) return withCors(c, { success: false, error: 'Event not found.' }, 404)
    const body = await c.req.json<{
      occurrence_date?: string
      guest_name?: string
      guest_email?: string
      guest_phone?: string
      organization?: string
      spot_count?: number
      notes?: string
    }>()
    if (!body.occurrence_date || !body.guest_name || !body.guest_email) {
      return withCors(c, { success: false, error: 'Missing required fields.' }, 400)
    }
    const result = await registerGuest(c.env, event, body.occurrence_date, {
      guest_name: body.guest_name,
      guest_email: body.guest_email,
      guest_phone: body.guest_phone,
      organization: body.organization,
      spot_count: Number(body.spot_count ?? 1),
      notes: body.notes,
    })
    if (!result.ok) return withCors(c, { success: false, error: result.error }, 400)
    return withCors(c, {
      success: true,
      registration: {
        id: result.registrationId,
        event_title: event.title,
        occurrence_date: body.occurrence_date,
        starts_at: event.starts_at,
        location: event.location,
        guest_name: body.guest_name,
        spot_count: Number(body.spot_count ?? 1),
        email_sent: result.emailSent,
      },
      availability: result.availability,
    })
  })

  app.post('/api/v1/events/:id/cancel', async (c) => {
    return withCors(c, { error: 'Use admin portal to cancel events.' }, 403)
  })

  app.get('/api/v1/media/*', async (c) => {
    const key = c.req.path.replace(/^\/api\/v1\/media\//, '')
    if (!key) return c.notFound()
    const object = await c.env.R2.get(key)
    if (!object) return c.notFound()
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Cache-Control', 'public, max-age=86400')
    return new Response(object.body, { headers })
  })
}

export async function notifyCancelledGuests(
  env: Env,
  eventId: string,
  occurrenceDate: string | null,
  message?: string,
) {
  const event = await getEventById(env.DB, eventId)
  if (!event) return
  const regs = await listRegistrations(env.DB, eventId, occurrenceDate ?? undefined)
  await sendCancellationNotifications(
    env,
    regs.map((r) => ({ email: r.guest_email, name: r.guest_name, spotCount: r.spot_count })),
    {
      eventTitle: event.title,
      occurrenceDate: occurrenceDate ?? 'Series',
      startsAt: event.starts_at,
      location: event.location ?? '',
      message,
    },
  )
  if (occurrenceDate) await markOccurrenceGuestsNotified(env.DB, eventId, occurrenceDate)
}

export { cancelEventOccurrence, cancelEventSeries }
