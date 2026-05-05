import { BaseEntity } from './api'
import { Account } from './accounts'
import { Category } from './categories'
import { Tag } from './tags'

export type TransactionType = 'income' | 'expense' | 'transfer' | 'debt_payment' | 'debt_collection'

export interface TransactionItem {
    id?: string
    name: string
    quantity: number
    pricePerUnit: number
    totalPrice: number
}

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
    items: TransactionItem[]
    itemsCount?: number
    tags: Tag[]
}


export interface TransactionFilters {
    type?: 'income' | 'expense' | 'transfer'
    account_id?: string
    category_id?: string
    category_ids?: string[]
    tag_ids?: string[]
    start_date?: string
    end_date?: string
    sort_by?: 'date' | 'amount' | 'created_at'
    sort_direction?: 'asc' | 'desc'
    per_page?: number
    page?: number
}

export interface TransactionSummary {
    income: number
    expense: number
    balance: number
    transactions_count: number
    currency: string
}
