import { BaseEntity } from './api'
import { Currency } from './currencies'

export type DebtType = 'i_owe' | 'owed_to_me'

export interface Debt extends BaseEntity {
    name: string
    type: 'debt'
    debtType: DebtType
    debtTypeLabel: string
    currencyId: string
    targetAmount: number
    paidAmount: number
    // Signed running net = origin contribution + sum of debt_id-linked TX deltas.
    // Negative for owed_to_me when money is still owed to you; positive after overpayment.
    currentBalance: number
    remainingDebt: number
    paymentProgress: number
    dueDate?: string
    counterparty?: string
    description?: string
    isPaidOff: boolean
    isActive: boolean
    currency?: Currency
    originTransactionId?: string | null
}


export interface DebtSummary {
    total_i_owe: number
    total_owed_to_me: number
    net_debt: number
    debts_count: number
    currency: string
    decimals: number
}

export interface DebtsResponse {
    data: Debt[]
    summary?: DebtSummary
}
