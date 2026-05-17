import { useQuery } from '@tanstack/react-query'
import { budgetsApi } from '@/api/budgets'
import { transactionsApi } from '@/api/transactions'
import {
  collapseLinkedPairs,
  expandSplitChildrenForCategoryView,
  excludeExcluded,
  excludeOneTime,
} from '@/lib/transaction-filters'
import type { Budget, Transaction } from '@/types'

function getPeriodBounds(
  period: Budget['period'],
  start: string | null,
  end: string | null,
): { periodStart: string; periodEnd: string } {
  if (start && end) {
    return { periodStart: start, periodEnd: end }
  }
  const now = new Date()
  if (period === 'monthly') {
    const y = now.getFullYear()
    const m = now.getMonth()
    const periodStart = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const lastDay = new Date(y, m + 1, 0).getDate()
    const periodEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { periodStart, periodEnd }
  }
  if (period === 'yearly') {
    const y = now.getFullYear()
    return { periodStart: `${y}-01-01`, periodEnd: `${y}-12-31` }
  }
  if (period === 'weekly') {
    const day = now.getDay()
    const diffToMonday = (day === 0 ? -6 : 1 - day)
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { periodStart: fmt(monday), periodEnd: fmt(sunday) }
  }
  // one_time or fallback: use start/end if provided, else open range
  return {
    periodStart: start ?? '1970-01-01',
    periodEnd: end ?? '9999-12-31',
  }
}

function inPeriod(
  date: string,
  periodStart: string,
  periodEnd: string,
): boolean {
  const d = date.slice(0, 10)
  return d >= periodStart && d <= periodEnd
}

function budgetMatchesTxn(budget: Budget, txn: Transaction): boolean {
  if (budget.isGlobal) return true
  const categoryIds = (budget.categories ?? []).map(c => c.id)
  const tagIds = (budget.tags ?? []).map(t => t.id)
  if (categoryIds.length > 0 && txn.category && categoryIds.includes(txn.category.id)) return true
  if (tagIds.length > 0 && txn.tags.some(t => tagIds.includes(t.id))) return true
  return false
}

export function useBudgetsWithProgress() {
  return useQuery({
    queryKey: ['budgets-with-progress'],
    queryFn: async (): Promise<Budget[]> => {
      const [budgets, txnsResp] = await Promise.all([
        budgetsApi.getAll(),
        transactionsApi.getAll({
          per_page: 99999,
          type: 'expense',
          include_excluded: true,
          include_split_children: true,
        }),
      ])

      // Phase 2 filter chain: collapse linked pairs, expand split children,
      // exclude excluded, exclude one-time.
      let filtered = txnsResp.data
      filtered = collapseLinkedPairs(filtered)
      filtered = expandSplitChildrenForCategoryView(filtered)
      filtered = excludeExcluded(filtered)
      filtered = excludeOneTime(filtered)

      return budgets.map(b => {
        const { periodStart, periodEnd } = getPeriodBounds(b.period, b.startDate, b.endDate)

        const matching = filtered.filter(t =>
          inPeriod(t.date, periodStart, periodEnd) && budgetMatchesTxn(b, t)
        )

        const spent = matching.reduce((s, t) => s + t.amount, 0)
        const remaining = Math.max(0, b.amount - spent)
        const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0
        const is_exceeded = spent > b.amount

        return {
          ...b,
          progress: {
            spent,
            remaining,
            percent,
            is_exceeded,
            period_start: periodStart,
            period_end: periodEnd,
          },
        }
      })
    },
  })
}
