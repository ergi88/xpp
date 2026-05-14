export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function lastDayOfMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate()
}

export function advanceNextRunDate(
  current: string,
  frequency: RecurringFrequency,
  interval: number,
  dayOfWeek?: number,
  dayOfMonth?: number,
): string {
  const [y, m, d] = current.split('-').map(Number)
  const base = new Date(y, m - 1, d)

  if (frequency === 'daily') {
    base.setDate(base.getDate() + interval)
    return fmt(base)
  }

  if (frequency === 'weekly') {
    base.setDate(base.getDate() + 7 * interval)
    if (typeof dayOfWeek === 'number') {
      const currentDow = base.getDay()
      const delta = (dayOfWeek - currentDow + 7) % 7
      base.setDate(base.getDate() + delta)
    }
    return fmt(base)
  }

  if (frequency === 'monthly') {
    const target = base.getMonth() + interval
    const newYear = base.getFullYear() + Math.floor(target / 12)
    const newMonth = ((target % 12) + 12) % 12
    const desiredDay = dayOfMonth ?? base.getDate()
    const clampedDay = Math.min(desiredDay, lastDayOfMonth(newYear, newMonth))
    return fmt(new Date(newYear, newMonth, clampedDay))
  }

  if (frequency === 'yearly') {
    const newYear = base.getFullYear() + interval
    const newMonth = base.getMonth()
    const desiredDay = base.getDate()
    const clampedDay = Math.min(desiredDay, lastDayOfMonth(newYear, newMonth))
    return fmt(new Date(newYear, newMonth, clampedDay))
  }

  throw new Error(`Unsupported frequency: ${frequency}`)
}
