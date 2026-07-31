/** Fixed stakeholder group / board seat names used across the member directory. */
export const STAKEHOLDER_GROUPS = [
  'Alliance Representative',
  'Design Engineering',
  'Electric',
  'Excavator',
  'Gas',
  'Locator',
  'One-Call',
  'Pipeline',
  'Public Works',
  'Regulator',
  'Road Builder',
  'Sewer',
  'Telecom',
  'Water',
] as const

export type StakeholderGroup = (typeof STAKEHOLDER_GROUPS)[number]

export const OFFICER_POSITIONS = ['Chair', 'Vice Chair'] as const
