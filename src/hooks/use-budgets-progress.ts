import { useQuery } from '@tanstack/react-query'
import { budgetsApi } from '@/api/budgets'
import { transactionsApi } from '@/api/transactions'
import {
  collapseLinkedPairs,
  expandSplitChildrenForCategoryView,
  excludeExcluded,
  excludeOneTime,
} from '@/lib/transaction-filters'
import { getPeriodBounds, inPeriod, budgetMatchesTxn } from '@/lib/budget-period'
import type { Budget, BudgetProgress, Transaction } from '@/types'

async function fetchFilteredExpenses(): Promise<Transaction[]> {
  const resp = await transactionsApi.getAll({
    per_page: 99999,
    type: 'expense',
    include_excluded: true,
    include_split_children: true,
  })
  let filtered = resp.data
  filtered = collapseLinkedPairs(filtered)
  filtered = expandSplitChildrenForCategoryView(filtered)
  filtered = excludeExcluded(filtered)
  filtered = excludeOneTime(filtered)
  return filtered
}

function calcProgress(
  budget: Budget,
  transactions: Transaction[],
  offset: number,
): BudgetProgress {
  const { periodStart, periodEnd } = getPeriodBounds(budget.period, budget.startDate, budget.endDate, offset)
  const matching = transactions.filter(t =>
    inPeriod(t.date, periodStart, periodEnd) && budgetMatchesTxn(budget, t),
  )
  const spent = matching.reduce((s, t) => s + t.amount, 0)
  const remaining = Math.max(0, budget.amount - spent)
  const percent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0
  return {
    spent,
    remaining,
    percent,
    is_exceeded: spent > budget.amount,
    period_start: periodStart,
    period_end: periodEnd,
  }
}

export function useBudgetsWithProgress() {
  return useQuery({
    queryKey: ['budgets-with-progress'],
    queryFn: async (): Promise<Budget[]> => {
      const [budgets, filtered] = await Promise.all([
        budgetsApi.getAll(),
        fetchFilteredExpenses(),
      ])
      return budgets.map(b => {
        const progress = calcProgress(b, filtered, 0)
        const matchingTransactions = filtered.filter(t =>
          inPeriod(t.date, progress.period_start, progress.period_end) &&
          budgetMatchesTxn(b, t),
        )
        return { ...b, progress, matchingTransactions }
      })
    },
  })
}

export function useBudgetWithProgress(id: string, offset: number) {
  return useQuery({
    queryKey: ['budget-with-progress', id, offset],
    queryFn: async () => {
      const [budget, filtered] = await Promise.all([
        budgetsApi.getById(id),
        fetchFilteredExpenses(),
      ])
      const progress = calcProgress(budget, filtered, offset)
      const matchingTxns = filtered.filter(t =>
        inPeriod(t.date, progress.period_start, progress.period_end) &&
        budgetMatchesTxn(budget, t),
      )
      return { budget, progress, transactions: matchingTxns }
    },
    enabled: !!id,
  })
}
