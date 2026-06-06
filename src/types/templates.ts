import { BaseEntity } from './api'
import { Account } from './accounts'
import { Category } from './categories'
import { Tag } from './tags'
import { TransactionType } from './transactions'

export interface TransactionTemplate extends BaseEntity {
    name: string
    icon?: string
    type: TransactionType
    accountId: string
    toAccountId?: string
    categoryId?: string
    amount?: number
    description?: string
    tagIds: string[]
    sortOrder?: number
    // hydrated relations
    account?: Account
    toAccount?: Account
    category?: Category
    tags: Tag[]
}
