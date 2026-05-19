import { useQuery } from '@tanstack/react-query'
import { transactionsApi } from '@/api'
import type { Transaction } from '@/types'

export interface PeriodIO {
  income: number
  expense: number
}

export interface WidgetSummaries {
  currency: string
  decimals: number
  today: PeriodIO
  yesterday: PeriodIO
  thisWeek: PeriodIO
  prevWeek: PeriodIO
  thisMonth: PeriodIO
  prevMonth: PeriodIO
  allTime: PeriodIO
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function nDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return iso(d)
}

function startOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function prevMonthRange(): [string, string] {
  const d = new Date()
  const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()
  const month = d.getMonth() === 0 ? 12 : d.getMonth()
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = iso(new Date(d.getFullYear(), d.getMonth(), 0))
  return [start, end]
}

function filterForWidgets(txns: Transaction[]): Transaction[] {
  return txns.filter(
    (t) => !t.isExcluded && !t.isOneTime && t.isApproved && t.type !== 'transfer',
  )
}

function sumPeriod(txns: Transaction[], start: string, end: string): PeriodIO {
  let income = 0
  let expense = 0
  for (const t of txns) {
    if (t.date < start || t.date > end) continue
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense }
}

export function useWidgetSummaries() {
  return useQuery<WidgetSummaries>({
    queryKey: ['transactions', 'widget-summaries'],
    queryFn: async () => {
      const res = await transactionsApi.getAll({ per_page: 99999, include_excluded: true })
      const txns = filterForWidgets(res.data)

      const ref = res.data.find((t) => t.account?.currency)
      const currency = ref?.account?.currency?.symbol ?? '$'
      const decimals = ref?.account?.currency?.decimals ?? 2

      const today = iso(new Date())
      const yesterday = nDaysAgo(1)
      const weekStart = nDaysAgo(6)
      const prevWeekStart = nDaysAgo(13)
      const prevWeekEnd = nDaysAgo(7)
      const monthStart = startOfMonth()
      const [prevMonthStart, prevMonthEnd] = prevMonthRange()

      return {
        currency,
        decimals,
        today: sumPeriod(txns, today, today),
        yesterday: sumPeriod(txns, yesterday, yesterday),
        thisWeek: sumPeriod(txns, weekStart, today),
        prevWeek: sumPeriod(txns, prevWeekStart, prevWeekEnd),
        thisMonth: sumPeriod(txns, monthStart, today),
        prevMonth: sumPeriod(txns, prevMonthStart, prevMonthEnd),
        allTime: sumPeriod(txns, '0000-01-01', '9999-12-31'),
      }
    },
  })
}
