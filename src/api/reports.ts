import { transactionsApi } from './transactions'
import {
  accountsApi,
  getBaseCurrencyMeta,
  isAccountIncludedInBaseAggregates,
} from './accounts'
import { categoriesApi } from './categories'
import type { ReportFilters } from '@/pages/reports/types'
import type { CashFlowGroupBy, TransactionType } from './reports-types'
import type { Account, Transaction } from '@/types'
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

function filterAggregateAccounts(accounts: Account[], baseCurrencyId?: string) {
  return accounts.filter((account) =>
    isAccountIncludedInBaseAggregates(
      account,
      baseCurrencyId ? { id: baseCurrencyId } : undefined,
    ),
  )
}

function filterAggregateTransactions(
  txns: Transaction[],
  baseCurrencyId?: string,
) {
  return txns.filter(
    (transaction) =>
      !!transaction.account &&
      isAccountIncludedInBaseAggregates(
        transaction.account,
        baseCurrencyId ? { id: baseCurrencyId } : undefined,
      ),
  )
}

// ── Data loader ──

async function loadAll() {
  const [txnRes, accounts, categories, { baseCurrency, currency }] =
    await Promise.all([
      transactionsApi.getAll({ per_page: 99999 }),
      accountsApi.getAll(),
      categoriesApi.getAll(),
      getBaseCurrencyMeta(),
    ])
  return {
    txns: txnRes.data,
    accounts,
    categories,
    baseCurrency,
    currency,
  }
}

// ── API ──

export const reportsApi = {
  getOverview: async (filters: ReportFilters): Promise<OverviewMetrics> => {
    const { txns, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    const prevRange = getPrevDateRange(filters)
    const curr = filterAggregateTransactions(
      filterTxns(txns, start, end, filters),
      baseCurrency?.id,
    )
    const prev = prevRange
      ? filterAggregateTransactions(
          filterTxns(txns, prevRange[0], prevRange[1], filters),
          baseCurrency?.id,
        )
      : []
    return computeOverview(curr, prev, start, end, currency)
  },

  getMoneyFlow: async (filters: ReportFilters): Promise<MoneyFlowData> => {
    const { txns, categories, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeMoneyFlow(
      filterAggregateTransactions(filterTxns(txns, start, end, filters), baseCurrency?.id),
      categories,
      currency,
    )
  },

  getExpensePace: async (filters: ReportFilters): Promise<ExpensePaceData> => {
    const { txns, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeExpensePace(
      filterAggregateTransactions(filterTxns(txns, start, end, filters), baseCurrency?.id),
      start,
      end,
      currency,
    )
  },

  // Returns the old { categories, currency } shape expected by ExpensesByCategory component
  getExpensesByCategory: async (filters: ReportFilters): Promise<ExpensesByCategoryData> => {
    const { txns, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    const prevRange = getPrevDateRange(filters)
    const curr = filterAggregateTransactions(
      filterTxns(txns, start, end, filters),
      baseCurrency?.id,
    )
    const prev = prevRange
      ? filterAggregateTransactions(
          filterTxns(txns, prevRange[0], prevRange[1], filters),
          baseCurrency?.id,
        )
      : []
    const result = computeByCategory(curr, prev, 'expense', currency)
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
    const { txns, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeCashFlow(
      filterAggregateTransactions(filterTxns(txns, start, end, filters), baseCurrency?.id),
      groupBy,
      start,
      end,
      currency,
    )
  },

  getActivityHeatmap: async (filters: ReportFilters): Promise<ActivityHeatmapData> => {
    const { txns, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeActivityHeatmap(
      filterAggregateTransactions(filterTxns(txns, start, end, filters), baseCurrency?.id),
      start,
      end,
      currency,
    )
  },

  getTransactionSummary: async (filters: ReportFilters, type: TransactionType): Promise<TransactionSummaryData> => {
    const { txns, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    const prevRange = getPrevDateRange(filters)
    const curr = filterAggregateTransactions(
      filterTxns(txns, start, end, filters),
      baseCurrency?.id,
    )
    const prev = prevRange
      ? filterAggregateTransactions(
          filterTxns(txns, prevRange[0], prevRange[1], filters),
          baseCurrency?.id,
        )
      : []
    return computeTransactionSummary(curr, prev, type, start, end, currency)
  },

  // Returns the { items, total, currency } shape expected by ExpensesStructureChart component
  getTransactionsByCategory: async (filters: ReportFilters, type: TransactionType): Promise<TransactionsByCategoryData> => {
    const { txns, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    const prevRange = getPrevDateRange(filters)
    const curr = filterAggregateTransactions(
      filterTxns(txns, start, end, filters),
      baseCurrency?.id,
    )
    const prev = prevRange
      ? filterAggregateTransactions(
          filterTxns(txns, prevRange[0], prevRange[1], filters),
          baseCurrency?.id,
        )
      : []
    const result = computeByCategory(curr, prev, type, currency)
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
    const { txns, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeDynamics(
      filterAggregateTransactions(filterTxns(txns, start, end, filters), baseCurrency?.id),
      type,
      groupBy,
      start,
      end,
      currency,
    )
  },

  getTopTransactions: async (filters: ReportFilters, type: TransactionType, limit = 10): Promise<TopTransactionsData> => {
    const { txns, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeTopTransactions(
      filterAggregateTransactions(filterTxns(txns, start, end, filters), baseCurrency?.id),
      type,
      limit,
      currency,
    )
  },

  getNetWorth: async (_filters: ReportFilters): Promise<NetWorthData> => {
    const { accounts, baseCurrency, currency } = await loadAll()
    return computeNetWorth(
      filterAggregateAccounts(accounts, baseCurrency?.id),
      currency,
    )
  },

  getNetWorthHistory: async (filters: ReportFilters, groupBy: CashFlowGroupBy = 'month'): Promise<NetWorthHistoryData> => {
    const { txns, accounts, baseCurrency, currency } = await loadAll()
    const [start, end] = getDateRange(filters)
    return computeNetWorthHistory(
      filterAggregateTransactions(txns, baseCurrency?.id),
      filterAggregateAccounts(accounts, baseCurrency?.id),
      groupBy,
      start,
      end,
      currency,
    )
  },
}
