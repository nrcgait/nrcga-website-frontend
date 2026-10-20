import type { Env } from '../env'
import type { EventRecord } from './event-repeat'
import { isValidEmailAddress } from './email-address'
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

function mailFromAddress(env: Env): string {
  return `noreply@${new URL(env.PUBLIC_SITE_ORIGIN).hostname}`
}

export async function sendMail(
  env: Env,
  opts: { to: string; subject: string; text: string; replyTo?: string },
): Promise<boolean> {
  if (!env.EMAIL) {
    console.error('email send skipped: EMAIL binding missing')
    return false
  }
  const to = opts.to.trim()
  if (!isValidEmailAddress(to)) return false
  const replyTo = opts.replyTo?.trim()
  const safeReplyTo = replyTo && isValidEmailAddress(replyTo) ? replyTo : undefined
  if (replyTo && !safeReplyTo) {
    console.error('email send omitting invalid replyTo', { to, replyTo })
  }
  try {
    await env.EMAIL.send({
      from: { email: mailFromAddress(env), name: 'NRCGA' },
      to,
      subject: opts.subject,
      text: opts.text,
      replyTo: safeReplyTo,
    } as Parameters<SendEmail['send']>[0])
    return true
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
    console.error('email send failed', {
      to,
      code,
      message: error instanceof Error ? error.message : String(error),
    })
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
