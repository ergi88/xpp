import { BaseEntity } from './api'
import { Account } from './accounts'
import { Category } from './categories'
import { Tag } from './tags'

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction extends BaseEntity {
    type: TransactionType
    amount: number
    toAmount?: number
    exchangeRate?: number
    description?: string
    date: string
    account: Account
    toAccount?: Account
    category?: Category
    children?: Transaction[]
    childrenCount?: number
    tags: Tag[]
    // Phase 1 fields:
    isExcluded: boolean
    isOneTime: boolean
    parentId: string | null
    debtId: string | null
    linkedTransactionId: string | null
    recurringId: string | null
    // Phase 5 fix: engine-generated transactions start unapproved.
    // Legacy rows missing this column default to true (already-approved).
    isApproved: boolean
}

// Legacy alias preserved for any straggler component reading `items` / `itemsCount` —
// these point at children. Remove after a sweep confirms no readers remain.
export type TransactionItem = Transaction

export interface TransactionFilters {
    type?: 'income' | 'expense' | 'transfer'
    types?: string[]
    account_id?: string
    account_ids?: string[]
    category_id?: string
    category_ids?: string[]
    tag_ids?: string[]
    start_date?: string
    end_date?: string
    sort_by?: 'date' | 'amount' | 'created_at'
    sort_direction?: 'asc' | 'desc'
    per_page?: number
    page?: number
    include_excluded?: boolean
    include_split_children?: boolean
}

export interface TransactionSummary {
    income: number
    expense: number
    transfer: number
    balance: number
    transactions_count: number
    currency: string
    decimals: number
}
