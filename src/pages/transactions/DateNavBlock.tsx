import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AmountText } from '@/components/shared/AmountText'
import type { TransactionSummary } from '@/types/transactions'
import type { Account } from '@/types/accounts'
import {
    formatPeriod,
    getNavLabel,
    getNavValue,
    getAccountLabel,
} from './dateNavHelpers'

interface DateNavBlockProps {
    navMode: 'month' | 'day'
    navDate: string
    type: string | null | undefined
    summary?: TransactionSummary
    accountIds: string[]
    accounts: Account[]
    onPrev: () => void
    onNext: () => void
    onToggleMode: () => void
}

export function DateNavBlock({
    navMode,
    navDate,
    type,
    summary,
    accountIds,
    accounts,
    onPrev,
    onNext,
    onToggleMode,
}: DateNavBlockProps) {
    const period = formatPeriod(navMode, navDate)
    const label = getNavLabel(type)
    const value = getNavValue(summary, type)
    const accountLabel = getAccountLabel(accountIds, accounts)
    const currency = summary?.currency ?? ''
    const decimals = summary?.decimals ?? 2

    return (
        <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={onPrev} className="shrink-0">
                <ChevronLeft className="size-4" />
            </Button>
            <button
                onClick={onToggleMode}
                className="flex flex-col items-center gap-0.5 flex-1 py-2 cursor-pointer select-none rounded-md hover:bg-muted/50 transition-colors"
            >
                <span className="text-xs text-muted-foreground font-medium">
                    {label}: {period}
                </span>
                <AmountText
                    value={value}
                    decimals={decimals}
                    currency={currency}
                    signDisplay={!type ? 'always' : 'auto'}
                    className="text-2xl font-bold"
                />
                <span className="text-xs text-muted-foreground">{accountLabel}</span>
            </button>
            <Button variant="outline" size="icon" onClick={onNext} className="shrink-0">
                <ChevronRight className="size-4" />
            </Button>
        </div>
    )
}
