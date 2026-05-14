import { describe, it, expect } from 'vitest'
import { advanceNextRunDate } from '@/lib/recurring-schedule'

describe('advanceNextRunDate', () => {
  it('daily: adds interval days', () => {
    expect(advanceNextRunDate('2026-05-10', 'daily', 1)).toBe('2026-05-11')
    expect(advanceNextRunDate('2026-05-10', 'daily', 3)).toBe('2026-05-13')
  })
  it('weekly with no day_of_week: adds interval*7 days', () => {
    expect(advanceNextRunDate('2026-05-10', 'weekly', 1)).toBe('2026-05-17')
    expect(advanceNextRunDate('2026-05-10', 'weekly', 2)).toBe('2026-05-24')
  })
  it('weekly with day_of_week clamps to next matching weekday', () => {
    // 2026-05-10 is a Sunday (day 0). +7 = 2026-05-17 (Sun). Clamp to Wed (3) → 2026-05-20.
    expect(advanceNextRunDate('2026-05-10', 'weekly', 1, 3)).toBe('2026-05-20')
  })
  it('monthly: adds interval months preserving day_of_month', () => {
    expect(advanceNextRunDate('2026-05-15', 'monthly', 1, undefined, 15)).toBe('2026-06-15')
    expect(advanceNextRunDate('2026-05-15', 'monthly', 2, undefined, 15)).toBe('2026-07-15')
  })
  it('monthly: clamps day_of_month=31 to last day of shorter months', () => {
    // 2026-01-31 + 1 month = clamp to 02-28
    expect(advanceNextRunDate('2026-01-31', 'monthly', 1, undefined, 31)).toBe('2026-02-28')
    // 2024-01-31 + 1 month (2024 is leap) = clamp to 02-29
    expect(advanceNextRunDate('2024-01-31', 'monthly', 1, undefined, 31)).toBe('2024-02-29')
  })
  it('yearly: adds interval years preserving month/day', () => {
    expect(advanceNextRunDate('2026-05-15', 'yearly', 1)).toBe('2027-05-15')
    expect(advanceNextRunDate('2026-05-15', 'yearly', 3)).toBe('2029-05-15')
  })
  it('yearly: 02-29 + 1 non-leap year → 02-28', () => {
    expect(advanceNextRunDate('2024-02-29', 'yearly', 1)).toBe('2025-02-28')
  })
})
