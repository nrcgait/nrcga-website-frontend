import type { Hono } from 'hono'
import type { Env } from '../env'
import {
  getPublicBreakingNews,
  getContactInfo,
  getFooterInfo,
  getNavigation,
  getThemeSettings,
  sendCancellationNotifications,
} from '../lib/site-settings'
import {
  listArchiveFeed,
  listCarouselSlides,
  listCommitteesData,
  listMembers,
  listPages,
  listPrograms,
  listQaItems,
  listZeroDamages,
  getPageBySlug,
  membersForPublicApi,
  parseArchiveFeedType,
} from '../lib/content-db'
import { parsePageParam } from '../lib/pagination'
import {
  listLeadership,
  listMembershipTypes,
  listPosts,
  listResourceLinks,
  getPostBySlug,
} from '../lib/parity-db'
import {
  createFormSubmission,
  getFormInboxBySlug,
  inboxToPublicSchema,
  isFormType,
  parseFormFields,
  upsertNewsletterSubscriber,
  validateFormPayload,
  validateSchemaPayload,
} from '../lib/forms-db'
import {
  cancelEventOccurrence,
  cancelEventSeries,
  getEventById,
  listExpandedPublishedEvents,
  markOccurrenceGuestsNotified,
  uncancelEventOccurrence,
  uncancelEventSeries,
} from '../lib/events-db'
import { getAvailability, listRegistrations, registerGuest } from '../lib/event-registrations'
import { instantOnNevadaDate, parseToInstant } from '../lib/nevada-time'
import { withCors, corsHeaders, PUBLIC_JSON_CACHE } from '../lib/cors'
import { clientIp, consumeRateLimit, RATE_LIMIT_MESSAGE, rateLimitHeaders } from '../lib/rate-limit'

function cachedJson(c: Parameters<typeof withCors>[0], body: unknown, status = 200) {
  return withCors(c, body, status, PUBLIC_JSON_CACHE)
}

export function registerPublicApiRoutes(app: Hono<{ Bindings: Env }>) {
  app.options('/api/v1/*', (c) => {
    const headers = corsHeaders(c.req.header('Origin') ?? '', c.env)
    return new Response(null, { status: 204, headers })
  })

  app.use('/api/v1/*', async (c, next) => {
    if (c.req.method !== 'POST') return next()
    const allowed = await consumeRateLimit(c.env.PUBLIC_WRITE_RATE_LIMITER, `ip:${clientIp(c)}`)
    if (!allowed) {
      return withCors(c, { success: false, error: RATE_LIMIT_MESSAGE }, 429, rateLimitHeaders())
    }
    return next()
  })

  app.get('/api/v1/members', async (c) => {
    const rows = await listMembers(c.env.DB)
    return cachedJson(c, membersForPublicApi(rows as Record<string, unknown>[]))
  })
  app.get('/api/v1/programs', async (c) => cachedJson(c, await listPrograms(c.env.DB)))
  app.get('/api/v1/archive', async (c) => {
    const page = parsePageParam(c.req.query('page'))
    const type = parseArchiveFeedType(c.req.query('type'))
    return cachedJson(c, await listArchiveFeed(c.env.DB, page, type))
  })
  app.get('/api/v1/carousel', async (c) => {
    const slides = await listCarouselSlides(c.env.DB)
    const mapped = slides.map((s: Record<string, unknown>) => ({
      image_url: s.image_url || (s.image_r2_key ? `/api/v1/media/${s.image_r2_key}` : ''),
      alt_text: s.alt_text,
      link_url: s.link_url,
      display_order: s.display_order,
      active: s.active,
    }))
    return cachedJson(c, mapped)
  })
  app.get('/api/v1/breaking-news', async (c) => cachedJson(c, await getPublicBreakingNews(c.env.DB)))
  app.get('/api/v1/committees', async (c) => cachedJson(c, await listCommitteesData(c.env.DB)))
  app.get('/api/v1/zero-damages', async (c) => cachedJson(c, await listZeroDamages(c.env.DB)))
  app.get('/api/v1/qa', async (c) => cachedJson(c, await listQaItems(c.env.DB, true)))
  app.get('/api/v1/pages', async (c) => cachedJson(c, await listPages(c.env.DB)))
  app.get('/api/v1/leadership', async (c) => cachedJson(c, await listLeadership(c.env.DB, true)))
  app.get('/api/v1/resources', async (c) => cachedJson(c, await listResourceLinks(c.env.DB, true)))
  app.get('/api/v1/member-types', async (c) => cachedJson(c, await listMembershipTypes(c.env.DB, true)))
  app.get('/api/v1/posts', async (c) => cachedJson(c, await listPosts(c.env.DB, true)))
  app.get('/api/v1/posts/:slug', async (c) => {
    const post = await getPostBySlug(c.env.DB, c.req.param('slug'), true)
    if (!post) return cachedJson(c, { error: 'Not found' }, 404)
    return cachedJson(c, post)
  })

  app.get('/api/v1/pages/:slug', async (c) => {
    const page = await getPageBySlug(c.env.DB, c.req.param('slug'), true)
    if (!page) return cachedJson(c, { error: 'Not found' }, 404)
    return cachedJson(c, page)
  })

  app.get('/api/v1/navigation', async (c) => cachedJson(c, (await getNavigation(c.env.DB)) ?? null))
  app.get('/api/v1/settings', async (c) =>
    cachedJson(c, {
      contact: await getContactInfo(c.env.DB),
      footer: await getFooterInfo(c.env.DB),
      theme: await getThemeSettings(c.env.DB),
    }),
  )

  app.get('/api/v1/events', async (c) => {
    const category = c.req.query('category') ?? undefined
    const events = await listExpandedPublishedEvents(c.env.DB, category, true)
    return cachedJson(c, { events })
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

  app.get('/api/v1/forms/:type', async (c) => {
    const formType = c.req.param('type')
    if (isFormType(formType)) {
      return cachedJson(c, {
        slug: formType,
        title: formType.replace(/_/g, ' '),
        builtin: true,
        fields: null,
        submit_label: 'Submit',
        success_message: 'Thank you — your submission was received.',
      })
    }
    const inbox = await getFormInboxBySlug(c.env.DB, formType)
    if (!inbox || !inbox.active) {
      return withCors(c, { success: false, error: 'Unknown form type.' }, 404)
    }
    return cachedJson(c, { ...inboxToPublicSchema(inbox), builtin: false })
  })

  app.post('/api/v1/forms/:type', async (c) => {
    const formType = c.req.param('type')
    let body: Record<string, unknown>
    try {
      body = await c.req.json<Record<string, unknown>>()
    } catch {
      return withCors(c, { success: false, error: 'Invalid JSON body.' }, 400)
    }

    let validated: { ok: true; payload: Record<string, unknown> } | { ok: false; error: string }
    let notifyEmail: string | null = null
    let successMessage = 'Thank you — your submission was received.'

    if (isFormType(formType)) {
      validated = validateFormPayload(formType, body)
    } else {
      const inbox = await getFormInboxBySlug(c.env.DB, formType)
      if (!inbox || !inbox.active) {
        return withCors(c, { success: false, error: 'Unknown form type.' }, 404)
      }
      validated = validateSchemaPayload(parseFormFields(inbox.fields_json), body)
      notifyEmail = inbox.notify_email ? String(inbox.notify_email) : null
      successMessage = String(inbox.success_message ?? successMessage)
    }

    if (!validated.ok) return withCors(c, { success: false, error: validated.error }, 400)

    if (formType === 'newsletter') {
      await upsertNewsletterSubscriber(
        c.env.DB,
        String(validated.payload.email),
        validated.payload.name ? String(validated.payload.name) : null,
      )
    }

    const id = await createFormSubmission(c.env.DB, formType, validated.payload)

    // Best-effort notify org contact for non-newsletter forms
    if (formType !== 'newsletter' && c.env.EMAIL) {
      try {
        const contact = await getContactInfo(c.env.DB)
        const to = notifyEmail || contact.email
        await c.env.EMAIL.send({
          to,
          from: `NRCGA <noreply@${new URL(c.env.PUBLIC_SITE_ORIGIN).hostname}>`,
          subject: `New ${formType.replace(/_/g, ' ')} submission`,
          text: `A new ${formType} submission was received (id ${id}).\n\n${JSON.stringify(validated.payload, null, 2)}`,
        })
      } catch {
        /* non-fatal */
      }
    }

    return withCors(c, { success: true, id, message: successMessage })
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
  const start = parseToInstant(event.starts_at)
  const occurrenceStart =
    occurrenceDate && start ? instantOnNevadaDate(start, occurrenceDate) : start
  const regs = await listRegistrations(env.DB, eventId, occurrenceDate ?? undefined)
  await sendCancellationNotifications(
    env,
    regs.map((r) => ({ email: r.guest_email, name: r.guest_name, spotCount: r.spot_count })),
    {
      eventTitle: event.title,
      occurrenceDate: occurrenceDate ?? 'Series',
      startsAt: occurrenceStart?.toISOString() ?? event.starts_at,
      location: event.location ?? '',
      message,
    },
  )
  if (occurrenceDate) await markOccurrenceGuestsNotified(env.DB, eventId, occurrenceDate)
}

export { cancelEventOccurrence, cancelEventSeries, uncancelEventOccurrence, uncancelEventSeries }
