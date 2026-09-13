import { EmailMessage } from 'cloudflare:email'
import type { Env } from '../env'
import type { EventRecord } from './event-repeat'
import { inboxKeyForFormType } from './inbox-access'
import { formatInNevada, formatNevadaDateParam } from './nevada-time'
import { listStaffEmailsForEvent, listStaffEmailsForInbox } from './notification-prefs'
import { getContactInfo, getEmailSettings, type EmailSettings } from './site-settings'

export function formatEventEmailWhen(
  occurrenceDate: string,
  startsAt: string,
): { dateLabel: string; timeLabel: string } {
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)
    ? formatNevadaDateParam(occurrenceDate)
    : occurrenceDate
  const timeLabel = formatInNevada(startsAt, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return { dateLabel, timeLabel: timeLabel || startsAt }
}

function mailFrom(env: Env): string {
  return `NRCGA <noreply@${new URL(env.PUBLIC_SITE_ORIGIN).hostname}>`
}

function extractAddress(value: string): string {
  const match = value.match(/<([^>]+)>/)
  return (match?.[1] || value).trim()
}

function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value
  const bytes = new TextEncoder().encode(value)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `=?UTF-8?B?${btoa(bin)}?=`
}

function buildRawMime(opts: {
  from: string
  to: string
  subject: string
  text: string
  replyTo?: string
}): string {
  const headers = [`From: ${opts.from}`, `To: ${opts.to}`]
  if (opts.replyTo) headers.push(`Reply-To: ${opts.replyTo}`)
  headers.push(`Subject: ${encodeHeaderValue(opts.subject)}`)
  headers.push('MIME-Version: 1.0')
  headers.push('Content-Type: text/plain; charset=utf-8')
  headers.push('Content-Transfer-Encoding: 8bit')
  return `${headers.join('\r\n')}\r\n\r\n${opts.text.replace(/\n/g, '\r\n')}`
}

export async function sendMail(
  env: Env,
  opts: { to: string; subject: string; text: string; replyTo?: string },
): Promise<boolean> {
  if (!env.EMAIL) return false
  const to = opts.to.trim()
  if (!to || !to.includes('@')) return false
  const from = mailFrom(env)
  const fromAddr = extractAddress(from)
  const raw = buildRawMime({
    from,
    to,
    subject: opts.subject,
    text: opts.text,
    replyTo: opts.replyTo?.trim() || undefined,
  })
  try {
    await env.EMAIL.send(new EmailMessage(fromAddr, to, raw) as unknown as Parameters<SendEmail['send']>[0])
    return true
  } catch {
    return false
  }
}

export function applyEmailTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function confirmationVars(
  data: {
    eventTitle: string
    occurrenceDate: string
    startsAt: string
    location: string
    meetingUrl?: string
    guestName: string
    spotCount: number
  },
  contactEmail: string,
): Record<string, string> {
  const { dateLabel, timeLabel } = formatEventEmailWhen(data.occurrenceDate, data.startsAt)
  return {
    guestName: data.guestName,
    eventTitle: data.eventTitle,
    date: dateLabel,
    time: timeLabel,
    location: data.location ? `Location: ${data.location}` : '',
    meetingUrl: data.meetingUrl ? `Join: ${data.meetingUrl}` : '',
    spotCount: String(data.spotCount),
    contactEmail,
  }
}

export async function sendRegistrationConfirmation(
  env: Env,
  data: {
    to: string
    eventTitle: string
    occurrenceDate: string
    startsAt: string
    location: string
    meetingUrl?: string
    guestName: string
    spotCount: number
  },
): Promise<boolean> {
  const [contact, settings] = await Promise.all([getContactInfo(env.DB), getEmailSettings(env.DB)])
  const vars = confirmationVars(data, contact.email)
  return sendMail(env, {
    to: data.to,
    subject: applyEmailTemplate(settings.registration_confirmation.subject, vars),
    text: applyEmailTemplate(settings.registration_confirmation.body, vars),
    replyTo: contact.email,
  })
}

export async function sendCancellationNotifications(
  env: Env,
  guests: Array<{ email: string; name: string; spotCount: number }>,
  data: {
    eventTitle: string
    occurrenceDate: string
    startsAt: string
    location: string
    meetingUrl?: string
    message?: string
  },
): Promise<void> {
  const contact = await getContactInfo(env.DB)
  const { dateLabel, timeLabel } = formatEventEmailWhen(data.occurrenceDate, data.startsAt)
  const seen = new Set<string>()
  for (const guest of guests) {
    const key = guest.email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    await sendMail(env, {
      to: guest.email,
      subject: `Event cancelled: ${data.eventTitle}`,
      text: [
        `Hello ${guest.name},`,
        '',
        `The following event has been cancelled:`,
        data.eventTitle,
        `Date: ${dateLabel}`,
        `Time: ${timeLabel}`,
        data.location ? `Location: ${data.location}` : '',
        data.meetingUrl ? `Join: ${data.meetingUrl}` : '',
        `Spots you had booked: ${guest.spotCount}`,
        data.message ? `\n${data.message}` : '',
        '',
        `Questions? Contact ${contact.email}`,
      ]
        .filter(Boolean)
        .join('\n'),
      replyTo: contact.email,
    })
  }
}

export async function sendStaffRegistrationNotices(
  env: Env,
  event: EventRecord,
  data: {
    guestName: string
    guestEmail: string
    occurrenceDate: string
    startsAt: string
    location: string
    meetingUrl?: string
    spotCount: number
    organization?: string
  },
): Promise<void> {
  const recipients = await listStaffEmailsForEvent(env.DB, event)
  const guestKey = data.guestEmail.toLowerCase()
  const { dateLabel, timeLabel } = formatEventEmailWhen(data.occurrenceDate, data.startsAt)
  const text = [
    `${data.guestName} (${data.guestEmail}) registered for ${event.title}.`,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    data.location ? `Location: ${data.location}` : '',
    data.meetingUrl ? `Join: ${data.meetingUrl}` : '',
    data.organization ? `Organization: ${data.organization}` : '',
    `Spots booked: ${data.spotCount}`,
  ]
    .filter(Boolean)
    .join('\n')
  for (const to of recipients) {
    if (to.toLowerCase() === guestKey) continue
    await sendMail(env, {
      to,
      subject: `New registration: ${event.title}`,
      text,
      replyTo: data.guestEmail,
    })
  }
}

export async function sendFormSubmissionNotifications(
  env: Env,
  opts: {
    formType: string
    submissionId: string
    payload: Record<string, unknown>
    inboxNotifyEmail?: string | null
  },
): Promise<void> {
  const settings = await getEmailSettings(env.DB)
  const inboxKey = inboxKeyForFormType(opts.formType)
  const orgTo = (opts.inboxNotifyEmail?.trim() || settings.default_notify_email).toLowerCase().trim()
  const staff = await listStaffEmailsForInbox(env.DB, inboxKey)
  const recipients = [...new Set([orgTo, ...staff.map((email) => email.toLowerCase().trim())])].filter(
    (email) => email.includes('@'),
  )
  const replyTo = submitterEmail(opts.payload)
  const label = opts.formType.replace(/_/g, ' ')
  const text = `A new ${opts.formType} submission was received (id ${opts.submissionId}).\n\n${JSON.stringify(opts.payload, null, 2)}`
  for (const to of recipients) {
    await sendMail(env, {
      to,
      subject: `New ${label} submission`,
      text,
      replyTo,
    })
  }
}

export async function sendPasswordResetEmail(env: Env, to: string, resetUrl: string): Promise<boolean> {
  return sendMail(env, {
    to,
    subject: 'Reset your NRCGA staff password',
    text: [
      'We received a request to reset the password for this NRCGA staff portal account.',
      '',
      'Open this link within one hour to choose a new password:',
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  })
}

function submitterEmail(payload: Record<string, unknown>): string | undefined {
  const value = payload.email
  if (typeof value === 'string' && value.includes('@')) return value.trim()
  return undefined
}

export function emailSettingsHelpText(): string {
  return 'Placeholders: {{guestName}}, {{eventTitle}}, {{date}}, {{time}}, {{location}}, {{meetingUrl}}, {{spotCount}}, {{contactEmail}}. Location and meeting URL include their labels when set, and are blank when missing.'
}

export type { EmailSettings }
