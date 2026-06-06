import { Landmark, Wallet, Bitcoin, HandCoins, CreditCard } from 'lucide-react'
import type { AccountType, RegularAccountType } from '@/types'

export interface AccountTypeConfig {
    icon: typeof Landmark
    /** Default lucide icon name used when an account has no custom icon. */
    defaultIcon: string
    label: string
    color: string
    bgColor: string
    textColor: string
    /** Default hex tint used when an account has no custom color. */
    defaultColor: string
}

// All account types including debt (for display purposes)
export const ACCOUNT_TYPE_CONFIG: Record<AccountType, AccountTypeConfig> = {
    bank: {
        icon: Landmark,
        defaultIcon: 'Landmark',
        label: 'Bank',
        color: 'bg-blue-100 text-blue-700',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-600',
        defaultColor: '#60a5fa', // blue-400
    },
    cash: {
        icon: Wallet,
        defaultIcon: 'Wallet',
        label: 'Cash',
        color: 'bg-green-100 text-green-700',
        bgColor: 'bg-green-100',
        textColor: 'text-green-600',
        defaultColor: '#4ade80', // green-400
    },
    crypto: {
        icon: Bitcoin,
        defaultIcon: 'Bitcoin',
        label: 'Crypto',
        color: 'bg-orange-100 text-orange-700',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-600',
        defaultColor: '#fb923c', // orange-400
    },
    debt: {
        icon: HandCoins,
        defaultIcon: 'HandCoins',
        label: 'Debt',
        color: 'bg-purple-100 text-purple-700',
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-600',
        defaultColor: '#a78bfa', // violet-400
    },
    credit: {
        icon: CreditCard,
        defaultIcon: 'CreditCard',
        label: 'Credit',
        color: 'bg-rose-100 text-rose-700',
        bgColor: 'bg-rose-100',
        textColor: 'text-rose-600',
        defaultColor: '#fb7185', // rose-400
    },
}

// Curated lucide icons suggested for accounts (used in the account icon picker).
// When no icon is chosen, rendering falls back to the per-type default icon above.
export const ACCOUNT_ICON_OPTIONS: string[] = [
    'Landmark',
    'Wallet',
    'CreditCard',
    'Bitcoin',
    'PiggyBank',
    'Banknote',
    'Coins',
    'DollarSign',
    'CircleDollarSign',
    'BadgeDollarSign',
    'HandCoins',
    'Vault',
    'Building2',
    'Gem',
    'Smartphone',
    'Globe',
    'TrendingUp',
    'Receipt',
    'Briefcase',
    'Star',
]

// Regular account types (excluding debt) - for account creation/selection
export const REGULAR_ACCOUNT_TYPES: RegularAccountType[] = ['bank', 'cash', 'crypto', 'credit']

export const REGULAR_ACCOUNT_TYPE_CONFIG: Record<RegularAccountType, AccountTypeConfig> = {
    bank: ACCOUNT_TYPE_CONFIG.bank,
    cash: ACCOUNT_TYPE_CONFIG.cash,
    crypto: ACCOUNT_TYPE_CONFIG.crypto,
    credit: ACCOUNT_TYPE_CONFIG.credit,
}
