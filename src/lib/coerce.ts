export function toBool(v: unknown): boolean {
  if (v === true) return true
  if (v === 1) return true
  if (typeof v === 'string') {
    const norm = v.trim().toLowerCase()
    return norm === 'true' || norm === '1'
  }
  return false
}

export function toIdOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v)
  return s === '' ? null : s
}
