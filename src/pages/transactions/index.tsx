import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryStates, parseAsInteger, parseAsString, parseAsArrayOf, parseAsStringLiteral } from 'nuqs'
import { Plus, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Filter, ArrowUpDown, X } from 'lucide-react'
import { Row } from '@tanstack/react-table'
import { Page, PageHeader, DataTable, ServerPagination } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { createTransactionColumns } from '@/components/features/transactions'
import { AmountText } from '@/components/shared/AmountText'
import { useTransactions, useDeleteTransaction, useDuplicateTransaction, useCategories, useTags, useTransactionSummary, useAccounts } from '@/hooks'
import { Transaction } from '@/types'
import { cn } from '@/lib/utils'
import { DateNavBlock } from './DateNavBlock'
import {
    firstDayOfCurrentMonth,
    getDateRange,
    stepMonth,
    stepDay,
} from './dateNavHelpers'

const TYPE_FILTERS: { value: 'income' | 'expense' | 'transfer' | null; label: string; icon?: typeof ArrowDownLeft }[] = [
    { value: null, label: 'All' },
    { value: 'income', label: 'Income', icon: ArrowDownLeft },
    { value: 'expense', label: 'Expense', icon: ArrowUpRight },
    { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
]

function TransactionItems({ row }: { row: Row<Transaction> }) {
    const items = row.original.items
    const decimals = row.original.account.currency?.decimals ?? 2
    const symbol = row.original.account.currency?.symbol
    if (!items || items.length === 0) return null

    return (
        <div className="px-4 py-3 ml-10">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-muted-foreground text-xs">
                        <th className="text-left font-medium pb-2">Item</th>
                        <th className="text-right font-medium pb-2 w-20">Qty</th>
                        <th className="text-right font-medium pb-2 w-24">Price</th>
                        <th className="text-right font-medium pb-2 w-24">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={item.id ?? idx} className="border-t border-border/50">
                            <td className="py-1.5">{item.name}</td>
                            <td className="py-1.5 text-right font-mono">{item.quantity}</td>
                            <td className="py-1.5 text-right font-mono">
                                <AmountText
                                    value={item.pricePerUnit}
                                    decimals={decimals}
                                    currency={symbol}
                                />
                            </td>
                            <td className="py-1.5 text-right font-mono font-medium">
                                <AmountText
                                    value={item.totalPrice}
                                    decimals={decimals}
                                    currency={symbol}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const SORT_OPTIONS = [
    { value: 'date:desc', label: 'Date (Newest)' },
    { value: 'date:asc', label: 'Date (Oldest)' },
    { value: 'amount:desc', label: 'Amount (High to Low)' },
    { value: 'amount:asc', label: 'Amount (Low to High)' },
    { value: 'created_at:desc', label: 'Date Added (Newest)' },
    { value: 'created_at:asc', label: 'Date Added (Oldest)' },
]

const transactionSearchParams = {
    type: parseAsStringLiteral(['income', 'expense', 'transfer'] as const),
    sortBy: parseAsStringLiteral(['date', 'amount', 'created_at'] as const).withDefault('date'),
    sortDir: parseAsStringLiteral(['asc', 'desc'] as const).withDefault('desc'),
    page: parseAsInteger.withDefault(1),
    categoryIds: parseAsArrayOf(parseAsString).withDefault([]),
    tagIds: parseAsArrayOf(parseAsString).withDefault([]),
    navMode: parseAsStringLiteral(['month', 'day'] as const).withDefault('month'),
    navDate: parseAsString.withDefault(firstDayOfCurrentMonth()),
    accountIds: parseAsArrayOf(parseAsString).withDefault([]),
}

export default function TransactionsPage() {
    const [params, setParams] = useQueryStates(transactionSearchParams)
    const [filtersOpen, setFiltersOpen] = useState(false)

    const dateRange = getDateRange(params.navMode, params.navDate)

    const filters = {
        per_page: 20,
        page: params.page,
        type: params.type ?? undefined,
        sort_by: params.sortBy,
        sort_direction: params.sortDir,
        category_ids: params.categoryIds.length > 0 ? params.categoryIds : undefined,
        tag_ids: params.tagIds.length > 0 ? params.tagIds : undefined,
        account_ids: params.accountIds.length > 0 ? params.accountIds : undefined,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
    }

    const summaryFilters = {
        type: params.type ?? undefined,
        account_ids: params.accountIds.length > 0 ? params.accountIds : undefined,
        category_ids: params.categoryIds.length > 0 ? params.categoryIds : undefined,
        tag_ids: params.tagIds.length > 0 ? params.tagIds : undefined,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
    }

    const { data, isLoading } = useTransactions(filters)
    const { data: summary } = useTransactionSummary(summaryFilters)
    const deleteTransaction = useDeleteTransaction()
    const duplicateTransaction = useDuplicateTransaction()
    const { data: categories } = useCategories()
    const { data: tags } = useTags()
    const { data: accountsData } = useAccounts({ active: true })
    const accounts = accountsData ?? []
    const isReadOnly = false

    const columns = createTransactionColumns(
        (id) => deleteTransaction.mutate(id),
        (id) => duplicateTransaction.mutate(id),
        isReadOnly
    )

    const transactions = data?.data ?? []
    const meta = data?.meta

    const activeFiltersCount = [
        params.categoryIds.length > 0,
        params.tagIds.length > 0,
    ].filter(Boolean).length

    const clearFilters = () => {
        setParams({
            categoryIds: null,
            tagIds: null,
            page: 1,
        })
    }

    const toggleCategory = (id: string) => {
        const current = params.categoryIds
        const newIds = current.includes(id)
            ? current.filter(c => c !== id)
            : [...current, id]
        setParams({ categoryIds: newIds.length ? newIds : null, page: 1 })
    }

    const toggleTag = (id: string) => {
        const current = params.tagIds
        const newIds = current.includes(id)
            ? current.filter(t => t !== id)
            : [...current, id]
        setParams({ tagIds: newIds.length ? newIds : null, page: 1 })
    }

    const toggleAccount = (id: string) => {
        const current = params.accountIds
        const newIds = current.includes(id)
            ? current.filter(a => a !== id)
            : [...current, id]
        setParams({ accountIds: newIds.length ? newIds : null, page: 1 })
    }

    const handleNavPrev = () => {
        const newDate = params.navMode === 'month'
            ? stepMonth(params.navDate, -1)
            : stepDay(params.navDate, -1)
        setParams({ navDate: newDate, page: 1 })
    }

    const handleNavNext = () => {
        const newDate = params.navMode === 'month'
            ? stepMonth(params.navDate, 1)
            : stepDay(params.navDate, 1)
        setParams({ navDate: newDate, page: 1 })
    }

    const handleNavToggleMode = () => {
        if (params.navMode === 'month') {
            const now = new Date()
            const navD = new Date(params.navDate + 'T00:00:00')
            const isCurrentMonth = now.getFullYear() === navD.getFullYear() && now.getMonth() === navD.getMonth()
            const pad = (n: number) => String(n).padStart(2, '0')
            const dayDate = isCurrentMonth
                ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
                : params.navDate
            setParams({ navMode: 'day', navDate: dayDate, page: 1 })
        } else {
            const d = new Date(params.navDate + 'T00:00:00')
            const pad = (n: number) => String(n).padStart(2, '0')
            const monthDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
            setParams({ navMode: 'month', navDate: monthDate, page: 1 })
        }
    }

    const filteredCategories = categories?.filter(c =>
        !params.type || params.type === 'transfer' || c.type === params.type
    ) ?? []

    return (
        <Page title="Transactions">
            <PageHeader
                title="Transactions"
                description="Track your income, expenses and transfers"
                createLink={params.type ? `/transactions/create?type=${params.type}` : '/transactions/create'}
                createLabel="New Transaction"
            />

            {/* Date Navigation */}
            <DateNavBlock
                navMode={params.navMode}
                navDate={params.navDate}
                type={params.type}
                summary={summary}
                accountIds={params.accountIds}
                accounts={accounts}
                onPrev={handleNavPrev}
                onNext={handleNavNext}
                onToggleMode={handleNavToggleMode}
            />

            {/* Type Filter Row */}
            <div className="flex flex-wrap gap-2 mb-2">
                {TYPE_FILTERS.map(({ value, label, icon: Icon }) => (
                    <Button
                        key={label}
                        variant={params.type === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setParams({ type: value, page: 1 })}
                    >
                        {Icon && <Icon className="size-4 mr-1" />}
                        {label}
                    </Button>
                ))}
            </div>

            {/* Account Filter Row */}
            {accounts.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    <Button
                        variant={params.accountIds.length === 0 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setParams({ accountIds: null, page: 1 })}
                    >
                        All Accounts
                    </Button>
                    {accounts.map((account) => (
                        <Button
                            key={account.id}
                            variant={params.accountIds.includes(account.id) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleAccount(account.id)}
                        >
                            {account.name}
                        </Button>
                    ))}
                </div>
            )}

            {/* Sort + Advanced Filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                        <div className="flex items-center gap-2">
                            <CollapsibleTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Filter className="size-4 mr-2" />
                                    Filters
                                    {activeFiltersCount > 0 && (
                                        <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                                            {activeFiltersCount}
                                        </Badge>
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                            {activeFiltersCount > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="size-4 mr-1" />
                                    Clear
                                </Button>
                            )}
                        </div>
                        <CollapsibleContent className="mt-4 space-y-4">
                            <Card>
                                <CardContent className="pt-4 space-y-4">
                                    {/* Categories */}
                                    {filteredCategories.length > 0 && (
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Categories</label>
                                            <div className="flex flex-wrap gap-2">
                                                {filteredCategories.map((category) => {
                                                    const isSelected = params.categoryIds.includes(category.id)
                                                    return (
                                                        <Badge
                                                            key={category.id}
                                                            variant={isSelected ? 'default' : 'outline'}
                                                            className={cn(
                                                                'cursor-pointer transition-colors',
                                                                isSelected ? 'hover:bg-primary/80' : 'hover:bg-muted'
                                                            )}
                                                            onClick={() => toggleCategory(category.id)}
                                                        >
                                                            {category.icon} {category.name}
                                                        </Badge>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tags */}
                                    {tags && tags.length > 0 && (
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Tags</label>
                                            <div className="flex flex-wrap gap-2">
                                                {tags.map((tag) => {
                                                    const isSelected = params.tagIds.includes(tag.id)
                                                    return (
                                                        <Badge
                                                            key={tag.id}
                                                            variant={isSelected ? 'default' : 'outline'}
                                                            className={cn(
                                                                'cursor-pointer transition-colors',
                                                                isSelected ? 'hover:bg-primary/80' : 'hover:bg-muted'
                                                            )}
                                                            onClick={() => toggleTag(tag.id)}
                                                        >
                                                            #{tag.name}
                                                        </Badge>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </CollapsibleContent>
                    </Collapsible>
                </div>

                <Select
                    value={`${params.sortBy}:${params.sortDir}`}
                    onValueChange={(val) => {
                        const parts = val.split(':')
                        const sortDir = parts[parts.length - 1] as 'asc' | 'desc'
                        const sortBy = parts.slice(0, -1).join(':') as 'date' | 'amount' | 'created_at'
                        setParams({ sortBy, sortDir, page: 1 })
                    }}
                >
                    <SelectTrigger className="w-[180px] h-9">
                        <ArrowUpDown className="size-4 mr-2" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SORT_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                data={transactions}
                columns={columns}
                isLoading={isLoading}
                emptyTitle="No transactions found"
                emptyDescription="Create your first transaction to start tracking"
                emptyAction={
                    <Button asChild>
                        <Link to={params.type ? `/transactions/create?type=${params.type}` : '/transactions/create'}>
                            <Plus className="size-4" />
                            New Transaction
                        </Link>
                    </Button>
                }
                renderSubComponent={TransactionItems}
                getRowCanExpand={(row) => (row.original.itemsCount ?? row.original.items?.length ?? 0) > 1}
                manualPagination
            />

            {meta && (
                <ServerPagination
                    meta={meta}
                    onPageChange={(page) => setParams({ page })}
                    infoLabel="transactions"
                />
            )}
        </Page>
    )
}
