import { transactionsApi } from './transactions'
import { accountsApi } from './accounts'
import { categoriesApi } from './categories'
import type { ReportFilters } from '@/pages/reports/types'
import type { CashFlowGroupBy, TransactionType } from './reports-types'
import {
  getDateRange, getPrevDateRange, filterTxns,
  computeOverview, computeMoneyFlow, computeCashFlow,
  computeActivityHeatmap, computeTransactionSummary, computeByCategory,
  computeTopTransactions, computeNetWorth, computeNetWorthHistory,
  computeDynamics, computeExpensePace,
} from '@/lib/sheets/report-engine'

export type { CashFlowGroupBy, TransactionType }

// ── Keep interface types so existing imports in api/index.ts & hooks stay valid ──

export interface MetricData {
  value: number
  previous: number | null
  sparkline: number[]
}

export interface OverviewMetrics {
  income: MetricData
  expenses: MetricData
  netCashFlow: MetricData
  savingsRate: MetricData
  currency: string
}

export interface SankeyNode {
  name: string
  itemStyle: { color: string }
}

export interface SankeyLink {
  source: string
  target: string
  value: number
}

export interface MoneyFlowData {
  nodes: SankeyNode[]
  links: SankeyLink[]
  totals: {
    income: number
    expenses: number
    savings: number
  }
  currency: string
}

export interface ExpensePaceMonth {
  label: string
  budget: number | null
  dailyExpenses: number[]
  currentDay: number | null
  daysInMonth: number
  totalSpent: number
  monthStart: string
  monthEnd: string
}

export interface ExpensePaceData {
  months: ExpensePaceMonth[]
  currency: string
}

export interface CategoryExpense {
  id: string
  name: string
  icon: string
  color: string
  current: number
  previous: number
}

export interface ExpensesByCategoryData {
  categories: CategoryExpense[]
  currency: string
}

export interface CashFlowDataPoint {
  label: string
  income: number
  expenses: number
  balance: number
  prevIncome?: number
  prevExpenses?: number
  prevBalance?: number
}

export interface CashFlowOverTimeData {
  items: CashFlowDataPoint[]
  currency: string
}

export interface HeatmapDataPoint {
  date: string
  value: number
  count: number
}

export interface ActivityHeatmapData {
  items: HeatmapDataPoint[]
  max: number
  currency: string
}

export interface TransactionSummaryData {
  total: number
  previous: number | null
  avgPerDay: number
  avgPerWeek: number
  prevAvgPerDay: number | null
  prevAvgPerWeek: number | null
  daysInPeriod: number
  currency: string
}

export interface TransactionCategoryItem {
  id: string
  name: string
  icon: string
  color: string
  value: number
  percentage: number
}

export interface TransactionsByCategoryData {
  items: TransactionCategoryItem[]
  total: number
  currency: string
}

export interface TransactionDynamicsDataset {
  id: string
  name: string
  color: string
  data: number[]
}

export interface TransactionDynamicsData {
  labels: string[]
  datasets: TransactionDynamicsDataset[]
  currency: string
}

export interface TopTransactionItem {
  id: string
  description: string
  amount: number
  date: string
  category: {
    id: string
    name: string
    icon: string
    color: string
  }
  account: {
    id: string
    name: string
  }
}

export interface TopTransactionsData {
  items: TopTransactionItem[]
  currency: string
}

export interface NetWorthAccount {
  id: string
  name: string
  type: string
  balance: number
  percentage: number
}

export interface NetWorthData {
  current: number
  previous: number | null
  change: number
  changePercent: number
  accounts: NetWorthAccount[]
  currency: string
}

export interface NetWorthHistoryData {
  labels: string[]
  values: number[]
  currency: string
}

// ── Data loader ──

async function loadAll() {
  const [txnRes, accounts, categories] = await Promise.all([
    transactionsApi.getAll({ per_page: 99999 }),
    accountsApi.getAll(),
    categoriesApi.getAll(),
  ])
  return { txns: txnRes.data, accounts, categories }
}

// ── API ──

export const reportsApi = {
  getOverview: async (filters: ReportFilters): Promise<OverviewMetrics> => {
    const { txns } = await loadAll()
    const [start, end] = getDateRange(filters)
    const prevRange = getPrevDateRange(filters)
    const curr = filterTxns(txns, start, end, filters)
    const prev = prevRange ? filterTxns(txns, prevRange[0], prevRange[1], filters) : []
    return computeOverview(curr, prev, start, end)
  },

  getMoneyFlow: async (filters: ReportFilters): Promise<MoneyFlowData> => {
    const { txns, categories } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeMoneyFlow(filterTxns(txns, start, end, filters), categories)
  },

  getExpensePace: async (filters: ReportFilters): Promise<ExpensePaceData> => {
    const { txns } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeExpensePace(filterTxns(txns, start, end, filters), start, end)
  },

  // Returns the old { categories, currency } shape expected by ExpensesByCategory component
  getExpensesByCategory: async (filters: ReportFilters): Promise<ExpensesByCategoryData> => {
    const { txns } = await loadAll()
    const [start, end] = getDateRange(filters)
    const prevRange = getPrevDateRange(filters)
    const curr = filterTxns(txns, start, end, filters)
    const prev = prevRange ? filterTxns(txns, prevRange[0], prevRange[1], filters) : []
    const result = computeByCategory(curr, prev, 'expense')
    return {
      categories: result.items.map(item => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        color: item.color,
        current: item.value,
        previous: item.previous,
      })),
      currency: result.currency,
    }
  },

  getCashFlowOverTime: async (filters: ReportFilters, groupBy: CashFlowGroupBy = 'day'): Promise<CashFlowOverTimeData> => {
    const { txns } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeCashFlow(filterTxns(txns, start, end, filters), groupBy, start, end)
  },

  getActivityHeatmap: async (filters: ReportFilters): Promise<ActivityHeatmapData> => {
    const { txns } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeActivityHeatmap(filterTxns(txns, start, end, filters), start, end)
  },

  getTransactionSummary: async (filters: ReportFilters, type: TransactionType): Promise<TransactionSummaryData> => {
    const { txns } = await loadAll()
    const [start, end] = getDateRange(filters)
    const prevRange = getPrevDateRange(filters)
    const curr = filterTxns(txns, start, end, filters)
    const prev = prevRange ? filterTxns(txns, prevRange[0], prevRange[1], filters) : []
    return computeTransactionSummary(curr, prev, type, start, end)
  },

  // Returns the { items, total, currency } shape expected by ExpensesStructureChart component
  getTransactionsByCategory: async (filters: ReportFilters, type: TransactionType): Promise<TransactionsByCategoryData> => {
    const { txns } = await loadAll()
    const [start, end] = getDateRange(filters)
    const prevRange = getPrevDateRange(filters)
    const curr = filterTxns(txns, start, end, filters)
    const prev = prevRange ? filterTxns(txns, prevRange[0], prevRange[1], filters) : []
    const result = computeByCategory(curr, prev, type)
    return {
      items: result.items.map(item => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        color: item.color,
        value: item.value,
        percentage: item.percentage,
      })),
      total: result.total,
      currency: result.currency,
    }
  },

  getTransactionDynamics: async (filters: ReportFilters, type: TransactionType, groupBy: CashFlowGroupBy = 'day'): Promise<TransactionDynamicsData> => {
    const { txns } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeDynamics(filterTxns(txns, start, end, filters), type, groupBy, start, end)
  },

  getTopTransactions: async (filters: ReportFilters, type: TransactionType, limit = 10): Promise<TopTransactionsData> => {
    const { txns } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeTopTransactions(filterTxns(txns, start, end, filters), type, limit)
  },

  getNetWorth: async (_filters: ReportFilters): Promise<NetWorthData> => {
    const { accounts } = await loadAll()
    return computeNetWorth(accounts)
  },

  getNetWorthHistory: async (filters: ReportFilters, groupBy: CashFlowGroupBy = 'month'): Promise<NetWorthHistoryData> => {
    const { txns, accounts } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeNetWorthHistory(txns, accounts, groupBy, start, end)
  },
}
