// Date helpers for normalizing values read back from the sheet.
//
// GAS returns Date-typed cells as ISO strings shifted by the script's tz
// (e.g. "2026-05-13T22:00:00.000Z" for a CEST midnight on 2026-05-14).
// Naive .slice(0, 10) on those strings yields the WRONG day. Always
// convert through a Date so the local-tz day is preserved.

export function toLocalDateString(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return ''
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw as string | number | Date)
  if (isNaN(d.getTime())) {
    return typeof raw === 'string' ? raw.slice(0, 10) : ''
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseLocalDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  return new Date(y, m - 1, d)
}
