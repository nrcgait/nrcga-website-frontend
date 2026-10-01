const EMAIL_RE = /^[^\s@<>()[\]\\,;:]+@[^\s@<>()[\]\\,;:]+\.[^\s@<>()[\]\\,;:]+$/

export function isValidEmailAddress(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 254) return false
  if (/[\r\n]/.test(trimmed)) return false
  return EMAIL_RE.test(trimmed)
}
