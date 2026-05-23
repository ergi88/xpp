import type { Budget, Transaction } from '@/types'

export function getPeriodBounds(
  period: Budget['period'],
  start: string | null,
  end: string | null,
  offset = 0,
): { periodStart: string; periodEnd: string } {
  if (start && end) {
    return { periodStart: start, periodEnd: end }
  }
  const now = new Date()
  if (period === 'monthly') {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const periodStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    const periodEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { periodStart, periodEnd }
  }
  if (period === 'yearly') {
    const y = now.getFullYear() - offset
    return { periodStart: `${y}-01-01`, periodEnd: `${y}-12-31` }
  }
  if (period === 'weekly') {
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday - offset * 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { periodStart: fmt(monday), periodEnd: fmt(sunday) }
  }
  return {
    periodStart: start ?? '1970-01-01',
    periodEnd: end ?? '9999-12-31',
  }
}

export function inPeriod(date: string, periodStart: string, periodEnd: string): boolean {
  const d = date.slice(0, 10)
  return d >= periodStart && d <= periodEnd
}

export function budgetMatchesTxn(budget: Budget, txn: Transaction): boolean {
  if (budget.isGlobal) return true
  const categoryIds = (budget.categories ?? []).map(c => c.id)
  const tagIds = (budget.tags ?? []).map(t => t.id)
  if (categoryIds.length > 0 && txn.category && categoryIds.includes(txn.category.id)) return true
  if (tagIds.length > 0 && txn.tags.some(t => tagIds.includes(t.id))) return true
  return false
}

export function periodLabel(
  period: Budget['period'],
  periodStart: string,
  periodEnd: string,
): string {
  if (period === 'monthly') {
    const d = new Date(periodStart + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  if (period === 'weekly') {
    const s = new Date(periodStart + 'T00:00:00')
    const e = new Date(periodEnd + 'T00:00:00')
    const sm = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const em = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${sm} – ${em}`
  }
  if (period === 'yearly') {
    return new Date(periodStart + 'T00:00:00').getFullYear().toString()
  }
  return `${periodStart} – ${periodEnd}`
}

export const UNCATEGORIZED_COLOR = '#94a3b8'

export interface CategoryTotal {
  category: {
    id: string
    name: string
    color: string
    icon: string
    type: 'income' | 'expense'
  }
  amount: number
  segPct: number
}

export function computeCategoryTotals(
  transactions: Transaction[],
  budgetAmount: number,
): CategoryTotal[] {
  const map = new Map<string, { category: CategoryTotal['category']; amount: number }>()

  for (const t of transactions) {
    const catId = t.category?.id ?? '__none__'
    const cat = t.category ?? {
      id: '__none__',
      name: 'Uncategorized',
      color: UNCATEGORIZED_COLOR,
      icon: 'circle',
      type: 'expense' as const,
    }
    const prev = map.get(catId) ?? { category: cat, amount: 0 }
    prev.amount += t.amount
    map.set(catId, prev)
  }

  const sorted = [...map.values()].sort((a, b) => b.amount - a.amount)

  let usedPct = 0
  return sorted.map(entry => {
    const raw = budgetAmount > 0 ? (entry.amount / budgetAmount) * 100 : 0
    const segPct = Math.min(raw, Math.max(0, 100 - usedPct))
    usedPct += segPct
    return { ...entry, segPct }
  })
}
