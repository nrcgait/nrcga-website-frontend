import {
  defaultEventCategoryForCommittee,
  EDUCATION_TRAINING_COMMITTEE,
  isTrainingCommittee,
  linkMatchesPageSlugs,
  pageSlugsForCommittees,
} from '../config/committee-content'
import {
  canAccessEventsSection,
  canManageAllContent,
  canManageAllEvents,
} from '../config/roles'
import type { AdminContext } from './admin-context'
import { inboxKeyForFormType } from './inbox-access'

type EventLike = {
  committee_slug?: string | null
  category?: string | null
}

type CommitteeTagged = {
  committee_slug?: string | null
  link?: string | null
}

export function chairCommittees(ctx: AdminContext): string[] {
  return ctx.user.role === 'chair' ? ctx.chairCommittees : []
}

export function chairPageSlugs(ctx: AdminContext): string[] {
  return pageSlugsForCommittees(chairCommittees(ctx))
}

export function canViewEvents(ctx: AdminContext): boolean {
  return canAccessEventsSection(ctx.user.role, ctx.chairCommittees)
}

export function canEditEvent(ctx: AdminContext, event: EventLike): boolean {
  if (canManageAllEvents(ctx.user.role)) return true
  if (ctx.user.role === 'trainer') return event.category === 'training'
  if (ctx.user.role === 'chair') {
    const slug = event.committee_slug
    return Boolean(slug && ctx.chairCommittees.includes(slug))
  }
  return false
}

export function assignableCommitteesForEvents(ctx: AdminContext): string[] {
  if (ctx.user.role === 'admin') return []
  if (ctx.user.role === 'chair') return ctx.chairCommittees
  if (ctx.user.role === 'trainer') return [EDUCATION_TRAINING_COMMITTEE]
  return []
}

export function resolveEventCategory(
  committeeSlug: string,
  requested: string | undefined,
  ctx: AdminContext,
): 'general' | 'training' {
  if (isTrainingCommittee(committeeSlug)) return 'training'
  if (ctx.user.role === 'trainer') return 'training'
  return requested === 'training' ? 'training' : 'general'
}

export function validateEventAssignment(
  ctx: AdminContext,
  committeeSlug: string,
  category: 'general' | 'training',
): string | null {
  if (!committeeSlug) {
    if (ctx.user.role === 'admin') return null
    return 'A committee is required.'
  }
  if (ctx.user.role === 'chair' && !ctx.chairCommittees.includes(committeeSlug)) {
    return 'You are not assigned to that committee.'
  }
  if (ctx.user.role === 'trainer' && committeeSlug !== EDUCATION_TRAINING_COMMITTEE) {
    return 'Trainers can only manage Education & Training committee events.'
  }
  if (isTrainingCommittee(committeeSlug) && category !== 'training') {
    return 'Education & Training committee events must be training events.'
  }
  if (ctx.user.role === 'trainer' && category !== 'training') {
    return 'Trainers can only manage training events.'
  }
  return null
}

export function defaultCategoryForNewEvent(ctx: AdminContext, committeeSlug: string): 'general' | 'training' {
  if (ctx.user.role === 'trainer') return 'training'
  return defaultEventCategoryForCommittee(committeeSlug)
}

export function canAccessContent(ctx: AdminContext): boolean {
  return canManageAllContent(ctx.user.role) || chairCommittees(ctx).length > 0
}

export function canEditCommitteeTagged(ctx: AdminContext, item: CommitteeTagged): boolean {
  if (canManageAllContent(ctx.user.role)) return true
  const slugs = chairCommittees(ctx)
  if (slugs.length === 0) return false
  if (item.committee_slug) return slugs.includes(String(item.committee_slug))
  return linkMatchesPageSlugs(item.link, chairPageSlugs(ctx))
}

export function canEditPageSlug(ctx: AdminContext, slug: string): boolean {
  if (canManageAllContent(ctx.user.role)) return true
  return chairPageSlugs(ctx).includes(slug)
}

export function committeeSlugOptions(ctx: AdminContext): string[] | null {
  if (canManageAllContent(ctx.user.role)) return null
  const slugs = chairCommittees(ctx)
  if (ctx.user.role === 'trainer') return [EDUCATION_TRAINING_COMMITTEE]
  return slugs.length ? slugs : null
}

export function canViewInbox(ctx: AdminContext, inboxKey: string): boolean {
  if (ctx.user.role === 'admin') return true
  if (inboxKey === 'training' && ctx.user.role === 'trainer') return true
  return ctx.assignedInboxKeys.includes(inboxKey)
}

export function canViewSubmission(ctx: AdminContext, formType: string): boolean {
  return canViewInbox(ctx, inboxKeyForFormType(formType))
}
