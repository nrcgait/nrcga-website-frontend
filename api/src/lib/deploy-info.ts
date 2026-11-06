import { NEVADA_TIME_ZONE } from './nevada-time'

type VersionMetadata = { id: string; tag?: string; timestamp: string }

let current: VersionMetadata | undefined

export function setDeployInfo(meta: VersionMetadata | undefined): void {
  current = meta
}

export function formatDeployTime(): string {
  if (!current?.timestamp) return 'unknown (local dev)'
  const date = new Date(current.timestamp)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: NEVADA_TIME_ZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date) + ' PT'
  )
}
