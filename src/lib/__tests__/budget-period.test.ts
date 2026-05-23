import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getPeriodBounds, inPeriod, budgetMatchesTxn, periodLabel, computeCategoryTotals, UNCATEGORIZED_COLOR } from '@/lib/budget-period'
import type { Budget, Transaction } from '@/types'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getPeriodBounds - monthly', () => {
  it('returns current month bounds at offset 0', () => {
    vi.setSystemTime(new Date('2026-05-15'))
    const { periodStart, periodEnd } = getPeriodBounds('monthly', null, null, 0)
    expect(periodStart).toBe('2026-05-01')
    expect(periodEnd).toBe('2026-05-31')
  })

  it('returns previous month at offset 1', () => {
    vi.setSystemTime(new Date('2026-05-15'))
    const { periodStart, periodEnd } = getPeriodBounds('monthly', null, null, 1)
    expect(periodStart).toBe('2026-04-01')
    expect(periodEnd).toBe('2026-04-30')
  })

  it('wraps year at offset crossing Jan', () => {
    vi.setSystemTime(new Date('2026-01-10'))
    const { periodStart, periodEnd } = getPeriodBounds('monthly', null, null, 1)
    expect(periodStart).toBe('2025-12-01')
    expect(periodEnd).toBe('2025-12-31')
  })
})

describe('getPeriodBounds - weekly', () => {
  it('returns Mon–Sun of current week at offset 0', () => {
    vi.setSystemTime(new Date('2026-05-20')) // Wednesday
    const { periodStart, periodEnd } = getPeriodBounds('weekly', null, null, 0)
    expect(periodStart).toBe('2026-05-18') // Monday
    expect(periodEnd).toBe('2026-05-24')   // Sunday
  })

  it('returns previous week at offset 1', () => {
    vi.setSystemTime(new Date('2026-05-20'))
    const { periodStart, periodEnd } = getPeriodBounds('weekly', null, null, 1)
    expect(periodStart).toBe('2026-05-11')
    expect(periodEnd).toBe('2026-05-17')
  })
})

describe('getPeriodBounds - yearly', () => {
  it('returns current year at offset 0', () => {
    vi.setSystemTime(new Date('2026-05-15'))
    const { periodStart, periodEnd } = getPeriodBounds('yearly', null, null, 0)
    expect(periodStart).toBe('2026-01-01')
    expect(periodEnd).toBe('2026-12-31')
  })

  it('returns 2025 at offset 1', () => {
    vi.setSystemTime(new Date('2026-05-15'))
    const { periodStart, periodEnd } = getPeriodBounds('yearly', null, null, 1)
    expect(periodStart).toBe('2025-01-01')
    expect(periodEnd).toBe('2025-12-31')
  })
})

describe('getPeriodBounds - one_time with explicit dates', () => {
  it('uses explicit start/end regardless of offset', () => {
    const { periodStart, periodEnd } = getPeriodBounds('one_time', '2026-01-01', '2026-03-31', 5)
    expect(periodStart).toBe('2026-01-01')
    expect(periodEnd).toBe('2026-03-31')
  })
})

describe('inPeriod', () => {
  it('returns true when date is within period', () => {
    expect(inPeriod('2026-05-15', '2026-05-01', '2026-05-31')).toBe(true)
  })
  it('returns false when date is outside period', () => {
    expect(inPeriod('2026-04-30', '2026-05-01', '2026-05-31')).toBe(false)
  })
  it('is inclusive on both ends', () => {
    expect(inPeriod('2026-05-01', '2026-05-01', '2026-05-31')).toBe(true)
    expect(inPeriod('2026-05-31', '2026-05-01', '2026-05-31')).toBe(true)
  })
})

describe('budgetMatchesTxn', () => {
  const base = { categories: [], tags: [], isGlobal: false } as unknown as Budget
  const txn = { category: { id: 'cat1' }, tags: [] } as unknown as Transaction

  it('global budget matches any transaction', () => {
    expect(budgetMatchesTxn({ ...base, isGlobal: true }, txn)).toBe(true)
  })

  it('matches by category id', () => {
    const budget = { ...base, categories: [{ id: 'cat1' }] } as unknown as Budget
    expect(budgetMatchesTxn(budget, txn)).toBe(true)
  })

  it('no match when category differs', () => {
    const budget = { ...base, categories: [{ id: 'cat2' }] } as unknown as Budget
    expect(budgetMatchesTxn(budget, txn)).toBe(false)
  })

  it('matches by tag id', () => {
    const budget = { ...base, tags: [{ id: 'tag1' }] } as unknown as Budget
    const tagTxn = { category: null, tags: [{ id: 'tag1' }] } as unknown as Transaction
    expect(budgetMatchesTxn(budget, tagTxn)).toBe(true)
  })
})

describe('periodLabel', () => {
  it('formats monthly label', () => {
    expect(periodLabel('monthly', '2026-05-01', '2026-05-31')).toBe('May 2026')
  })
  it('formats weekly label', () => {
    const label = periodLabel('weekly', '2026-05-18', '2026-05-24')
    expect(label).toContain('May 18')
    expect(label).toContain('May 24')
  })
  it('formats yearly label', () => {
    expect(periodLabel('yearly', '2026-01-01', '2026-12-31')).toBe('2026')
  })
})

describe('computeCategoryTotals', () => {
  const makeTxn = (id: string, amount: number, categoryId?: string, color = '#ff0000') =>
    ({
      id,
      amount,
      date: '2026-05-01',
      account: { id: 'a1' } as Transaction['account'],
      items: [],
      tags: [],
      isExcluded: false,
      isOneTime: false,
      parentId: null,
      debtId: null,
      linkedTransactionId: null,
      recurringId: null,
      type: 'expense',
      category: categoryId
        ? { id: categoryId, name: categoryId, color, icon: 'x', type: 'expense' as const }
        : null,
    }) as unknown as Transaction

  it('groups transactions by category and sorts by amount desc', () => {
    const txns = [
      makeTxn('t1', 100, 'food'),
      makeTxn('t2', 200, 'transport'),
      makeTxn('t3', 50, 'food'),
    ]
    const result = computeCategoryTotals(txns, 1000)
    expect(result[0].category.id).toBe('transport')
    expect(result[0].amount).toBe(200)
    expect(result[1].category.id).toBe('food')
    expect(result[1].amount).toBe(150)
  })

  it('groups uncategorized transactions under __none__', () => {
    const txns = [makeTxn('t1', 80, undefined)]
    const result = computeCategoryTotals(txns, 1000)
    expect(result[0].category.id).toBe('__none__')
    expect(result[0].category.name).toBe('Uncategorized')
    expect(result[0].category.color).toBe(UNCATEGORIZED_COLOR)
  })

  it('computes segPct as percentage of budgetAmount', () => {
    const txns = [makeTxn('t1', 250, 'food')]
    const result = computeCategoryTotals(txns, 1000)
    expect(result[0].segPct).toBe(25)
  })

  it('clamps total segPct at 100 when budget is exceeded', () => {
    const txns = [
      makeTxn('t1', 600, 'food'),
      makeTxn('t2', 600, 'transport'),
    ]
    const result = computeCategoryTotals(txns, 1000)
    const total = result.reduce((s, r) => s + r.segPct, 0)
    expect(total).toBeLessThanOrEqual(100)
    expect(result[0].segPct).toBe(60) // food 600/1000
    expect(result[1].segPct).toBe(40) // transport capped at remaining 40%
  })

  it('returns empty array for empty transactions', () => {
    expect(computeCategoryTotals([], 1000)).toHaveLength(0)
  })

  it('handles budgetAmount of 0 without dividing by zero', () => {
    const txns = [makeTxn('t1', 100, 'food')]
    const result = computeCategoryTotals(txns, 0)
    expect(result[0].segPct).toBe(0)
  })
})
