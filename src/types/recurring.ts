import { BaseEntity } from './api'
import { Account } from './accounts'
import { Category } from './categories'
import { Tag } from './tags'

import { TransactionType } from './transactions'

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type { TransactionType }

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

