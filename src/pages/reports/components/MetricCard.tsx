import { Card, CardContent } from '@/components/ui/card'
import { AmountText } from '@/components/shared/AmountText'
import { Sparkline } from '@/components/ui/sparkline'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { CompareType } from '../types'

interface MetricCardProps {
    title: string
    value: number
    previousValue?: number | null
    sparklineData: number[]
    type: 'income' | 'expense' | 'net' | 'percent'
    compareWith: CompareType
    suffix?: string
    currency?: string
}

export function MetricCard({ title, value, previousValue, sparklineData, type, compareWith, suffix, currency = '$' }: MetricCardProps) {
    const absoluteChange = previousValue != null ? value - previousValue : null
    const percentChange = previousValue && previousValue !== 0
        ? ((value - previousValue) / previousValue) * 100
        : null

    const isPositiveChange = percentChange !== null && percentChange > 0

    // For expenses, negative change (decrease) is good
    // For income/net/percent, positive change (increase) is good
    const isGoodChange = type === 'expense' ? !isPositiveChange : isPositiveChange

    const sparklineColor = type === 'income' ? 'success' : type === 'expense' ? 'danger' : 'default'

    return (
        <Card>
            <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground truncate">{title}</p>
                        <p className={cn(
                            'text-2xl font-bold tracking-tight',
                            type === 'income' && 'text-green-600',
                            type === 'expense' && 'text-red-600',
                        )}>
                            {type === 'percent' ? (
                                `${value.toFixed(1)}%${suffix ?? ''}`
                            ) : (
                                <>
                                    <AmountText
                                        value={value}
                                        decimals={0}
                                        currency={currency}
                                    />
                                    {suffix}
                                </>
                            )}
                        </p>
                        {compareWith !== 'none' && percentChange !== null && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className={cn(
                                    'flex items-center gap-0.5',
                                    isGoodChange ? 'text-green-600' : 'text-red-600'
                                )}>
                                    {isPositiveChange ? (
                                        <TrendingUp className="size-3" />
                                    ) : (
                                        <TrendingDown className="size-3" />
                                    )}
                                    {Math.abs(percentChange).toFixed(1)}%
                                </span>
                                {absoluteChange !== null && (
                                    <span className="text-muted-foreground">
                                        {type === 'percent' ? (
                                            `(${absoluteChange > 0 ? '+' : ''}${absoluteChange.toFixed(1)}pp)`
                                        ) : (
                                            <>
                                                (
                                                <AmountText
                                                    value={absoluteChange}
                                                    decimals={0}
                                                    currency={currency}
                                                    signDisplay="always"
                                                />
                                                )
                                            </>
                                        )}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <Sparkline
                        data={sparklineData}
                        width={64}
                        height={28}
                        color={sparklineColor}
                        className="flex-shrink-0"
                    />
                </div>
            </CardContent>
        </Card>
    )
}
