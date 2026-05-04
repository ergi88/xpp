import { BaseEntity } from './api'
import { Account } from './accounts'
import { Category } from './categories'
import { Tag } from './tags'

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type TransactionType = 'income' | 'expense' | 'transfer'

export interface RecurringTransaction extends BaseEntity {
    type: TransactionType
    accountId: string
    toAccountId?: string
    categoryId?: string
    amount: number
    toAmount?: number
    description?: string
    frequency: RecurringFrequency
    frequencyLabel: string
    interval: number
    dayOfWeek?: number
    dayOfMonth?: number
    startDate: string
    endDate?: string
    nextRunDate: string
    lastRunDate?: string
    isActive: boolean
    account: Account
    toAccount?: Account
    category?: Category
    tags: Tag[]
}

export interface RecurringFormData {
    type: TransactionType
    account_id: string
    to_account_id?: string | null
    category_id?: string | null
    amount: number
    to_amount?: number | null
    description?: string
    frequency: RecurringFrequency
    interval: number
    day_of_week?: number | null
    day_of_month?: number | null
    start_date: string
    end_date?: string | null
    is_active: boolean
    tag_ids?: string[]
}
