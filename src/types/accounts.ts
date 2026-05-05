import { BaseEntity } from './api'
import { Currency } from './currencies'

// All account types including debt
export type AccountType = 'bank' | 'crypto' | 'cash' | 'debt'

// Regular account types (excluding debt) - for account creation
export type RegularAccountType = 'bank' | 'crypto' | 'cash'

export interface Account extends BaseEntity {
    name: string
    type: AccountType
    currencyId: string
    initialBalance: number
    currentBalance: number
    isActive: boolean
    currency?: Currency
}


export interface AccountsSummary {
  total_balance: number
  currency: string
  currency_code: string
  decimals: number
  accounts_count: number
}

export interface AccountsResponse {
  data: Account[]
  summary?: AccountsSummary
}

export interface BalanceHistorySeries {
  name: string
  type: string
  data: number[]
}

export interface BalanceHistoryResponse {
  dates: string[]
  series: BalanceHistorySeries[]
  currency: string
  decimals: number
}

export interface BalanceComparisonResponse {
  current: number
  previous: number | null
  currency: string
  decimals: number
}
