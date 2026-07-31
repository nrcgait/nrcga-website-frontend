/** Maps committee slugs (from committees table) to editable CMS page slugs. */
export const COMMITTEE_PAGE_SLUGS: Record<string, string> = {
  budget: 'budget-committee',
  '811Day': '811-day',
  craigRogers: 'craig-rogers-award',
  educationTraining: 'training',
  golfTournament: 'golf-tournament',
  utilityLocateRodeo: 'utility-locate-rodeo',
  operations: 'operations',
  silverShovel: 'silver-shovel-award',
  techSolutions: 'technical-solutions-committee',
  embeddedFacilities: 'embedded-facilities-taskforce',
}

export const EDUCATION_TRAINING_COMMITTEE = 'educationTraining'

export function pageSlugsForCommittees(committeeSlugs: string[]): string[] {
  const slugs = new Set<string>()
  for (const c of committeeSlugs) {
    const page = COMMITTEE_PAGE_SLUGS[c]
    if (page) slugs.add(page)
  }
  return [...slugs]
}

export function committeeSlugForPageSlug(pageSlug: string): string | undefined {
  return Object.entries(COMMITTEE_PAGE_SLUGS).find(([, slug]) => slug === pageSlug)?.[0]
}

export function isTrainingCommittee(committeeSlug: string): boolean {
  return committeeSlug === EDUCATION_TRAINING_COMMITTEE
}

/** Default event category when a chair creates an event for a committee. */
export function defaultEventCategoryForCommittee(committeeSlug: string): 'general' | 'training' {
  return isTrainingCommittee(committeeSlug) ? 'training' : 'general'
}

export function linkMatchesPageSlugs(link: string | null | undefined, pageSlugs: string[]): boolean {
  if (!link || pageSlugs.length === 0) return false
  const normalized = link.toLowerCase()
  return pageSlugs.some((slug) => normalized.includes(slug.toLowerCase()))
}
