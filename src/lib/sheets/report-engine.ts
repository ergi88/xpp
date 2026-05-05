import type { Transaction, Account, Category } from '@/types'
import type { ReportFilters } from '@/pages/reports/types'

export function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getDateRange(filters: ReportFilters): [string, string] {
  const { periodType, selectedMonth, selectedQuarter, selectedYear, customStartDate, customEndDate } = filters
  switch (periodType) {
    case 'month': {
      const [y, m] = selectedMonth.split('-').map(Number)
      return [`${selectedMonth}-01`, `${selectedMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`]
    }
    case 'quarter': {
      const [y, q] = selectedQuarter.split('-Q').map(Number)
      const sm = (q - 1) * 3 + 1
      const em = q * 3
      return [`${y}-${String(sm).padStart(2, '0')}-01`, `${y}-${String(em).padStart(2, '0')}-${new Date(y, em, 0).getDate()}`]
    }
    case 'year': return [`${selectedYear}-01-01`, `${selectedYear}-12-31`]
    case 'ytd': { const t = new Date(); return [`${t.getFullYear()}-01-01`, fmt(t)] }
    case 'custom': return [customStartDate, customEndDate]
    default: { const t = new Date(); return [`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`, fmt(t)] }
  }
}

export function getPrevDateRange(filters: ReportFilters): [string, string] | null {
  if (filters.compareWith === 'none') return null
  const [start, end] = getDateRange(filters)
  if (filters.compareWith === 'same_period_last_year') {
    return [`${Number(start.slice(0, 4)) - 1}${start.slice(4)}`, `${Number(end.slice(0, 4)) - 1}${end.slice(4)}`]
  }
  const s = new Date(start), e = new Date(end)
  const dur = e.getTime() - s.getTime()
  const pe = new Date(s.getTime() - 86400000)
  const ps = new Date(pe.getTime() - dur)
  return [fmt(ps), fmt(pe)]
}

export function filterTxns(
  txns: Transaction[],
  start: string,
  end: string,
  f: Pick<ReportFilters, 'accountIds' | 'categoryIds' | 'tagIds'>,
): Transaction[] {
  return txns.filter(t => {
    if (t.date < start || t.date > end) return false
    if (f.accountIds.length && !f.accountIds.map(String).includes(t.account?.id)) return false
    if (f.categoryIds.length && (!t.category || !f.categoryIds.map(String).includes(t.category.id))) return false
    if (f.tagIds.length && !t.tags.some(tag => f.tagIds.map(String).includes(tag.id))) return false
    return true
  })
}

export function sumIO(txns: Transaction[]) {
  let income = 0, expense = 0
  for (const t of txns) {
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense }
}

function dailyValues(txns: Transaction[], type: 'income' | 'expense', start: string, end: string): number[] {
  const s = new Date(start), e = new Date(end)
  const result: number[] = []
  const cur = new Date(s)
  while (cur <= e) {
    const d = fmt(cur)
    result.push(txns.filter(t => t.date === d && t.type === type).reduce((s, t) => s + t.amount, 0))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function groupBy(txns: Transaction[], gb: 'day' | 'week' | 'month', start: string, end: string): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>()
  for (const t of txns.filter(tx => tx.date >= start && tx.date <= end)) {
    let key: string
    if (gb === 'day') key = t.date
    else if (gb === 'week') {
      const d = new Date(t.date)
      const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      key = fmt(mon)
    } else key = t.date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return map
}

export function computeOverview(
  txns: Transaction[],
  prevTxns: Transaction[],
  start: string,
  end: string,
) {
  const curr = sumIO(filterTxns(txns, start, end, { accountIds: [], categoryIds: [], tagIds: [] }))
  const prev = sumIO(prevTxns)
  const spark = dailyValues(filterTxns(txns, start, end, { accountIds: [], categoryIds: [], tagIds: [] }), 'expense', start, end)
  const savingsRate = curr.income > 0 ? ((curr.income - curr.expense) / curr.income) * 100 : 0
  const prevSavingsRate = prev.income > 0 ? ((prev.income - prev.expense) / prev.income) * 100 : 0
  return {
    income: { value: curr.income, previous: prev.income, sparkline: spark },
    expenses: { value: curr.expense, previous: prev.expense, sparkline: spark },
    netCashFlow: { value: curr.income - curr.expense, previous: prev.income - prev.expense, sparkline: [] },
    savingsRate: { value: savingsRate, previous: prevSavingsRate, sparkline: [] },
    currency: 'USD',
  }
}

export function computeMoneyFlow(txns: Transaction[], categories: Category[]) {
  const nodes: { name: string; itemStyle: { color: string } }[] = []
  const links: { source: string; target: string; value: number }[] = []
  const seen = new Set<string>()

  const incomeTxns = txns.filter(t => t.type === 'income')
  const expenseTxns = txns.filter(t => t.type === 'expense')
  const totalIncome = incomeTxns.reduce((s, t) => s + t.amount, 0)
  const totalExpense = expenseTxns.reduce((s, t) => s + t.amount, 0)

  if (!seen.has('Income')) { nodes.push({ name: 'Income', itemStyle: { color: '#22c55e' } }); seen.add('Income') }
  for (const t of incomeTxns) {
    const catName = t.category?.name ?? 'Other'
    if (!seen.has(catName)) { nodes.push({ name: catName, itemStyle: { color: t.category?.color ?? '#6366f1' } }); seen.add(catName) }
    links.push({ source: catName, target: 'Income', value: t.amount })
  }
  if (!seen.has('Expenses')) { nodes.push({ name: 'Expenses', itemStyle: { color: '#ef4444' } }); seen.add('Expenses') }
  links.push({ source: 'Income', target: 'Expenses', value: totalExpense })
  for (const t of expenseTxns) {
    const catName = t.category?.name ?? 'Other'
    if (!seen.has(catName)) { nodes.push({ name: catName, itemStyle: { color: t.category?.color ?? '#f97316' } }); seen.add(catName) }
    links.push({ source: 'Expenses', target: catName, value: t.amount })
  }

  return { nodes, links, totals: { income: totalIncome, expenses: totalExpense, savings: totalIncome - totalExpense }, currency: 'USD' }
}

export function computeCashFlow(txns: Transaction[], gb: 'day' | 'week' | 'month', start: string, end: string) {
  const grouped = groupBy(txns, gb, start, end)
  const labels = Array.from(grouped.keys()).sort()
  let runningBalance = 0
  const items = labels.map(label => {
    const ts = grouped.get(label)!
    const { income, expense } = sumIO(ts)
    runningBalance += income - expense
    return { label, income, expenses: expense, balance: runningBalance }
  })
  return { items, currency: 'USD' }
}

export function computeActivityHeatmap(txns: Transaction[], start: string, end: string) {
  const map = new Map<string, { value: number; count: number }>()
  for (const t of txns.filter(tx => tx.date >= start && tx.date <= end && tx.type === 'expense')) {
    const e = map.get(t.date) ?? { value: 0, count: 0 }
    e.value += t.amount; e.count++
    map.set(t.date, e)
  }
  const items = Array.from(map.entries()).map(([date, { value, count }]) => ({ date, value, count }))
  const max = items.reduce((m, i) => Math.max(m, i.value), 0)
  return { items, max, currency: 'USD' }
}

export function computeTransactionSummary(txns: Transaction[], prevTxns: Transaction[], type: 'income' | 'expense', start: string, end: string) {
  const curr = txns.filter(t => t.type === type)
  const prev = prevTxns.filter(t => t.type === type)
  const total = curr.reduce((s, t) => s + t.amount, 0)
  const prevTotal = prev.reduce((s, t) => s + t.amount, 0)
  const days = Math.max(1, (new Date(end).getTime() - new Date(start).getTime()) / 86400000)
  return {
    total, previous: prevTotal,
    avgPerDay: total / days, avgPerWeek: total / (days / 7),
    prevAvgPerDay: prevTotal / days, prevAvgPerWeek: prevTotal / (days / 7),
    daysInPeriod: days, currency: 'USD',
  }
}

export function computeByCategory(txns: Transaction[], prevTxns: Transaction[], type: 'income' | 'expense') {
  const curr = txns.filter(t => t.type === type)
  const prev = prevTxns.filter(t => t.type === type)
  const total = curr.reduce((s, t) => s + t.amount, 0)
  const catMap = new Map<string, { cat: Transaction['category']; current: number; previous: number }>()
  for (const t of curr) {
    const id = t.category?.id ?? 'uncategorized'
    const e = catMap.get(id) ?? { cat: t.category, current: 0, previous: 0 }
    e.current += t.amount; catMap.set(id, e)
  }
  for (const t of prev) {
    const id = t.category?.id ?? 'uncategorized'
    const e = catMap.get(id) ?? { cat: t.category, current: 0, previous: 0 }
    e.previous += t.amount; catMap.set(id, e)
  }
  const items = Array.from(catMap.values()).map(({ cat, current, previous }) => ({
    id: cat?.id ?? 'uncategorized', name: cat?.name ?? 'Uncategorized',
    icon: cat?.icon ?? '📦', color: cat?.color ?? '#6366f1',
    value: current, previous,
    percentage: total > 0 ? (current / total) * 100 : 0,
    current, // also expose current for backward-compat with ExpensesByCategory
  })).sort((a, b) => b.value - a.value)
  return { items, total, currency: 'USD' }
}

export function computeTopTransactions(txns: Transaction[], type: 'income' | 'expense', limit: number) {
  const items = txns
    .filter(t => t.type === type)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map(t => ({
      id: t.id, description: t.description ?? '', amount: t.amount, date: t.date,
      category: { id: t.category?.id ?? '', name: t.category?.name ?? '', icon: t.category?.icon ?? '', color: t.category?.color ?? '' },
      account: { id: t.account?.id ?? '', name: t.account?.name ?? '' },
    }))
  return { items, currency: 'USD' }
}

export function computeNetWorth(accounts: Account[]) {
  const active = accounts.filter(a => a.isActive && a.type !== 'debt')
  const current = active.reduce((s, a) => s + a.currentBalance, 0)
  const total = active.reduce((s, a) => s + Math.abs(a.currentBalance), 0)
  return {
    current, previous: null, change: 0, changePercent: 0,
    accounts: active.map(a => ({
      id: a.id, name: a.name, type: a.type, balance: a.currentBalance,
      percentage: total > 0 ? (Math.abs(a.currentBalance) / total) * 100 : 0,
    })),
    currency: 'USD',
  }
}

export function computeNetWorthHistory(txns: Transaction[], accounts: Account[], gb: 'day' | 'week' | 'month', start: string, end: string) {
  const baseBalance = accounts.filter(a => a.isActive && a.type !== 'debt').reduce((s, a) => s + a.initialBalance, 0)
  const allTxnsSorted = [...txns].sort((a, b) => a.date.localeCompare(b.date))
  const grouped = groupBy(allTxnsSorted, gb, start, end)
  const labels = Array.from(grouped.keys()).sort()
  let running = baseBalance
  const values = labels.map(label => {
    const ts = grouped.get(label)!
    const { income, expense } = sumIO(ts)
    running += income - expense
    return running
  })
  return { labels, values, currency: 'USD' }
}

export function computeDynamics(txns: Transaction[], type: 'income' | 'expense', gb: 'day' | 'week' | 'month', start: string, end: string) {
  const filtered = txns.filter(t => t.type === type && t.date >= start && t.date <= end)
  const grouped = groupBy(filtered, gb, start, end)
  const labels = Array.from(grouped.keys()).sort()
  const catGroups = new Map<string, { cat: Transaction['category']; byLabel: Map<string, number> }>()
  for (const [label, ts] of grouped) {
    for (const t of ts) {
      const id = t.category?.id ?? 'uncategorized'
      if (!catGroups.has(id)) catGroups.set(id, { cat: t.category, byLabel: new Map() })
      const cg = catGroups.get(id)!
      cg.byLabel.set(label, (cg.byLabel.get(label) ?? 0) + t.amount)
    }
  }
  const datasets = Array.from(catGroups.values()).map(({ cat, byLabel }) => ({
    id: cat?.id ?? 'uncategorized', name: cat?.name ?? 'Uncategorized', color: cat?.color ?? '#6366f1',
    data: labels.map(l => byLabel.get(l) ?? 0),
  }))
  return { labels, datasets, currency: 'USD' }
}

export function computeExpensePace(txns: Transaction[], start: string, end: string) {
  const months: {
    label: string; budget: null; dailyExpenses: number[]; currentDay: number | null
    daysInMonth: number; totalSpent: number; monthStart: string; monthEnd: string
  }[] = []
  const s = new Date(start), e = new Date(end)
  const cur = new Date(s.getFullYear(), s.getMonth(), 1)
  const today = fmt(new Date())
  while (cur <= e) {
    const y = cur.getFullYear(), m = cur.getMonth() + 1
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const daysInMonth = new Date(y, m, 0).getDate()
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${daysInMonth}`
    const label = `${y}-${String(m).padStart(2, '0')}`
    const monthTxns = txns.filter(t => t.type === 'expense' && t.date >= monthStart && t.date <= monthEnd)
    const dailyExpenses = Array.from({ length: daysInMonth }, (_, i) => {
      const d = `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
      return monthTxns.filter(t => t.date === d).reduce((s, t) => s + t.amount, 0)
    })
    const currentDay = today >= monthStart && today <= monthEnd ? parseInt(today.slice(8)) : null
    months.push({ label, budget: null, dailyExpenses, currentDay, daysInMonth, totalSpent: monthTxns.reduce((s, t) => s + t.amount, 0), monthStart, monthEnd })
    cur.setMonth(cur.getMonth() + 1)
  }
  return { months, currency: 'USD' }
}
