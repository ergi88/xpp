import { useParams, Link } from 'react-router-dom'
import { Pencil, ArrowLeft, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccount, useTransactions, useCurrencies } from '@/hooks'
import { AccountCard } from '@/components/features/accounts/AccountCard'
import { AccountStats } from '@/components/features/accounts/AccountStats'
import { AmountText } from '@/components/shared/AmountText'
import { ACCOUNT_TYPE_CONFIG } from '@/constants'
import { cn } from '@/lib/utils'

export default function AccountViewPage() {
  const { id } = useParams<{ id: string }>()
  const { data: account, isLoading } = useAccount(id!)
  const { data: currencies } = useCurrencies()
  const { data: txnsData } = useTransactions({ account_id: id, per_page: 10 })

  const enrichedAccount = account && currencies
    ? { ...account, currency: currencies.find((c) => c.id.toString() === account.currencyId) }
    : account

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!enrichedAccount) {
    return <div className="p-6 text-muted-foreground">Account not found.</div>
  }

  const config = ACCOUNT_TYPE_CONFIG[enrichedAccount.type]
  const Icon = config.icon
  const transactions = txnsData?.data ?? []

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/accounts">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className={cn('p-2 rounded-lg', config.color)}>
            <Icon className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{enrichedAccount.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className={config.color}>
                {config.label}
              </Badge>
              {enrichedAccount.currency && (
                <span className="text-sm text-muted-foreground font-mono">
                  {enrichedAccount.currency.code}
                </span>
              )}
              {!enrichedAccount.isActive && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          </div>
        </div>
        <Button asChild>
          <Link to={`/accounts/${id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Card visual — only renders if cardLastDigits or cardExpiry are set */}
      <AccountCard account={enrichedAccount} />

      {/* Balance / credit stats */}
      <AccountStats account={enrichedAccount} />

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/transactions?account_id=${id}`}>View all</Link>
          </Button>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div>
                  <p className="font-medium text-sm">{t.description ?? 'No description'}</p>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                </div>
                <p
                  className={cn(
                    'font-mono font-medium',
                    t.type === 'income' ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  <AmountText
                    value={t.type === 'income' ? t.amount : -t.amount}
                    decimals={enrichedAccount.currency?.decimals ?? 2}
                    currency={enrichedAccount.currency?.symbol}
                    signDisplay="always"
                  />
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recurring / Maintenance Fee */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Maintenance Fee</h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/recurring/create">
              <Plus className="mr-1 size-4" />
              Set up
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Create a recurring expense to track monthly maintenance or subscription fees for this account.
        </p>
      </div>
    </div>
  )
}
