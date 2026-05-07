import type { Account } from '@/types/accounts'
import type { TransactionSummary } from '@/types/transactions'

export function firstDayOfCurrentMonth(): string {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

export function getDateRange(navMode: 'month' | 'day', navDate: string): { start_date: string; end_date: string } {
    if (navMode === 'day') return { start_date: navDate, end_date: navDate }
    const d = new Date(navDate + 'T00:00:00')
    const year = d.getFullYear()
    const month = d.getMonth()
    const pad = (n: number) => String(n).padStart(2, '0')
    const start = `${year}-${pad(month + 1)}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${pad(month + 1)}-${pad(lastDay)}`
    return { start_date: start, end_date: end }
}

export function stepMonth(navDate: string, dir: 1 | -1): string {
    const d = new Date(navDate + 'T00:00:00')
    d.setMonth(d.getMonth() + dir)
    d.setDate(1)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

export function stepDay(navDate: string, dir: 1 | -1): string {
    const d = new Date(navDate + 'T00:00:00')
    d.setDate(d.getDate() + dir)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatPeriod(navMode: 'month' | 'day', navDate: string): string {
    const d = new Date(navDate + 'T00:00:00')
    if (navMode === 'month') {
        return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    }
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getNavLabel(type: string | null | undefined): string {
    if (type === 'income') return 'Total Income'
    if (type === 'expense') return 'Total Expense'
    if (type === 'transfer') return 'Total Transfers'
    return 'Net Balance'
}

export function getNavValue(summary: TransactionSummary | undefined, type: string | null | undefined): number {
    if (!summary) return 0
    if (type === 'income') return summary.income
    if (type === 'expense') return summary.expense
    if (type === 'transfer') return summary.transfer
    return summary.income - summary.expense
}

export function getAccountLabel(accountIds: string[], accounts: Account[]): string {
    if (accountIds.length === 0) return 'All Accounts'
    const selected = accounts.filter(a => accountIds.includes(a.id))
    if (selected.length === 0) return 'All Accounts'
    if (selected.length <= 2) return selected.map(a => a.name).join(', ')
    return `${selected.length} Accounts`
}
