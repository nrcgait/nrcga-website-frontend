import type { Env } from '../env'
import { formatInNevada, formatNevadaDateParam } from './nevada-time'

export type ContactInfo = {
  organization_name: string
  email: string
  phone: string
  address: string
  hours: string
  response_time: string
}

export type FooterInfo = {
  tagline: string
  copyright: string
}

export type BreakingNews = {
  active: boolean
  title: string
  content: string
  image_url: string
  read_more_url: string
  storage_key: string
  expires_at: string | null
}

export type NavigationConfig = {
  logo: {
    image: string
    alt: string
    text: string
    link: string
  }
  menuItems: Array<{
    type: 'link' | 'dropdown'
    text: string
    href: string
    external?: boolean
    items?: Array<{ text: string; href: string; external?: boolean }>
  }>
}

export type ThemeSettings = {
  primary: string
  primary_dark: string
  secondary: string
  accent: string
}

const DEFAULT_CONTACT: ContactInfo = {
  organization_name: 'Nevada Regional Common Ground Alliance',
  email: 'info@nrcga.org',
  phone: '',
  address: '',
  hours: '',
  response_time: 'We typically respond within 1-2 business days.',
}

const DEFAULT_FOOTER: FooterInfo = {
  tagline: 'Promoting public safety and damage prevention across Nevada.',
  copyright: '© 2026 NRCGA. All rights reserved.',
}

const DEFAULT_BREAKING: BreakingNews = {
  active: false,
  title: '',
  content: '',
  image_url: '',
  read_more_url: '',
  storage_key: 'nrcga_breaking_news_dismissed',
  expires_at: null,
}

const DEFAULT_THEME: ThemeSettings = {
  primary: '#0066cc',
  primary_dark: '#0052a3',
  secondary: '#00a86b',
  accent: '#ff6b35',
}

async function getSetting<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const row = await db
    .prepare('SELECT value_json FROM site_settings WHERE key = ?')
    .bind(key)
    .first<{ value_json: string }>()
  if (!row?.value_json) return fallback
  try {
    return JSON.parse(row.value_json) as T
  } catch {
    return fallback
  }
}

export async function setSetting(db: D1Database, key: string, value: unknown): Promise<void> {
  await db
    .prepare(
      `INSERT INTO site_settings (key, value_json, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')`,
    )
    .bind(key, JSON.stringify(value))
    .run()
}

export async function getContactInfo(db: D1Database): Promise<ContactInfo> {
  return getSetting(db, 'contact', DEFAULT_CONTACT)
}

export async function getFooterInfo(db: D1Database): Promise<FooterInfo> {
  return getSetting(db, 'footer', DEFAULT_FOOTER)
}

export async function getBreakingNews(db: D1Database): Promise<BreakingNews> {
  return getSetting(db, 'breaking_news', DEFAULT_BREAKING)
}

export async function getNavigation(db: D1Database): Promise<NavigationConfig | null> {
  return getSetting<NavigationConfig | null>(db, 'navigation', null)
}

export async function getThemeSettings(db: D1Database): Promise<ThemeSettings> {
  return getSetting(db, 'theme', DEFAULT_THEME)
}

function formatEventEmailWhen(occurrenceDate: string, startsAt: string): { dateLabel: string; timeLabel: string } {
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

export async function sendRegistrationConfirmation(
  env: Env,
  data: {
    to: string
    eventTitle: string
    occurrenceDate: string
    startsAt: string
    location: string
    guestName: string
    spotCount: number
  },
): Promise<boolean> {
  if (!env.EMAIL) return false
  const contact = await getContactInfo(env.DB)
  const { dateLabel, timeLabel } = formatEventEmailWhen(data.occurrenceDate, data.startsAt)
  try {
    await env.EMAIL.send({
      to: data.to,
      from: `NRCGA <noreply@${new URL(env.PUBLIC_SITE_ORIGIN).hostname}>`,
      subject: `Registration confirmed: ${data.eventTitle}`,
      text: [
        `Hello ${data.guestName},`,
        '',
        `You are registered for ${data.eventTitle}.`,
        `Date: ${dateLabel}`,
        `Time: ${timeLabel}`,
        data.location ? `Location: ${data.location}` : '',
        `Spots booked: ${data.spotCount}`,
        '',
        `Questions? Contact ${contact.email}`,
      ]
        .filter(Boolean)
        .join('\n'),
    })
    return true
  } catch {
    return false
  }
}

export async function sendCancellationNotifications(
  env: Env,
  guests: Array<{ email: string; name: string; spotCount: number }>,
  data: {
    eventTitle: string
    occurrenceDate: string
    startsAt: string
    location: string
    message?: string
  },
): Promise<void> {
  if (!env.EMAIL) return
  const contact = await getContactInfo(env.DB)
  const { dateLabel, timeLabel } = formatEventEmailWhen(data.occurrenceDate, data.startsAt)
  const seen = new Set<string>()
  for (const guest of guests) {
    const key = guest.email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    try {
      await env.EMAIL.send({
        to: guest.email,
        from: `NRCGA <noreply@${new URL(env.PUBLIC_SITE_ORIGIN).hostname}>`,
        subject: `Event cancelled: ${data.eventTitle}`,
        text: [
          `Hello ${guest.name},`,
          '',
          `The following event has been cancelled:`,
          data.eventTitle,
          `Date: ${dateLabel}`,
          `Time: ${timeLabel}`,
          data.location ? `Location: ${data.location}` : '',
          `Spots you had booked: ${guest.spotCount}`,
          data.message ? `\n${data.message}` : '',
          '',
          `Questions? Contact ${contact.email}`,
        ]
          .filter(Boolean)
          .join('\n'),
      })
    } catch {
      /* non-fatal */
    }
  }
}
