import { Account } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface AccountStatsProps {
  account: Account
}

function fmt(amount: number, currency?: { symbol: string; decimals: number }) {
  if (!currency) return Math.abs(amount).toFixed(2)
  return `${currency.symbol}${Math.abs(amount).toFixed(currency.decimals)}`
}

export function AccountStats({ account }: AccountStatsProps) {
  const isCredit = account.type === 'credit'

  if (isCredit) {
    const used = Math.abs(account.currentBalance)
    const limit = account.creditLimit ?? 0
    const available = Math.max(0, limit - used)
    const utilization = limit > 0 ? (used / limit) * 100 : 0

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Used</p>
              <p className="text-2xl font-semibold text-rose-600">
                {fmt(used, account.currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-semibold text-green-600">
                {fmt(available, account.currency)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Limit</p>
              <p className="text-2xl font-semibold">
                {fmt(limit, account.currency)}
              </p>
            </CardContent>
          </Card>
        </div>
        <div>
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>Utilization</span>
            <span>{utilization.toFixed(1)}%</span>
          </div>
          <Progress
            value={utilization}
            className={cn(utilization > 80 && '[&>div]:bg-rose-500')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Current Balance</p>
          <p
            className={cn(
              'text-2xl font-semibold',
              account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {account.currency?.symbol ?? ''}
            {account.currentBalance.toFixed(account.currency?.decimals ?? 2)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Initial Balance</p>
          <p className="text-2xl font-semibold text-muted-foreground">
            {fmt(account.initialBalance, account.currency)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
