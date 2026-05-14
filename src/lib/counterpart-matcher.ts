import type { Transaction } from '@/types'

const DAY_MS = 86400000
const DEFAULT_WINDOW_DAYS = 7

export interface CounterpartMatchOptions {
  windowDays?: number
}

function daysApart(a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.abs(da - db) / DAY_MS
}

function amountMatches(source: Transaction, other: Transaction): boolean {
  if (Math.abs(source.amount - other.amount) <= 0.01) return true
  if (source.toAmount != null && Math.abs(source.toAmount - other.amount) <= 0.01) return true
  if (other.toAmount != null && Math.abs(source.amount - other.toAmount) <= 0.01) return true
  return false
}

export function findCounterpartCandidates(
  source: Transaction,
  all: Transaction[],
  options: CounterpartMatchOptions = {},
): Transaction[] {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS
  const result = all.filter(t => {
    if (t.id === source.id) return false
    if (t.parentId) return false
    if (t.linkedTransactionId) return false
    if (!t.account || !source.account) return false
    if (t.account.id === source.account.id) return false
    const oppositeTypes =
      (source.type === 'expense' && t.type === 'income') ||
      (source.type === 'income' && t.type === 'expense')
    if (!oppositeTypes) return false
    if (daysApart(source.date, t.date) > windowDays) return false
    if (!amountMatches(source, t)) return false
    return true
  })
  result.sort((a, b) => daysApart(source.date, a.date) - daysApart(source.date, b.date))
  return result
}
