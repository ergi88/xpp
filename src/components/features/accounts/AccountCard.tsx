import { CreditCard, Landmark } from 'lucide-react'
import { Account } from '@/types'
import { cn } from '@/lib/utils'
import { getAccountColor } from '@/lib/account-icon'

interface AccountCardProps {
  account: Account
  className?: string
}

export function AccountCard({ account, className }: AccountCardProps) {
  if (!account.cardLastDigits && !account.cardExpiry) return null

  const isCredit = account.type === 'credit'
  const Icon = isCredit ? CreditCard : Landmark

  const baseColor = getAccountColor(account.type, account.color)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-6 text-white select-none',
        className
      )}
      style={{
        backgroundImage: `linear-gradient(to bottom right, ${baseColor}, color-mix(in srgb, ${baseColor}, black 40%))`,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">
            {isCredit ? 'Credit Card' : 'Debit Card'}
          </p>
          <p className="mt-1 text-xl font-semibold">{account.name}</p>
        </div>
        <Icon className="size-8 opacity-80" />
      </div>

      <div className="mt-8 flex items-end justify-between">
        <div>
          <p className="text-xs opacity-70 uppercase tracking-wider">Card Number</p>
          <p className="mt-1 font-mono text-lg tracking-widest">
            •••• •••• •••• {account.cardLastDigits ?? '????'}
          </p>
        </div>
        {account.cardExpiry && (
          <div className="text-right">
            <p className="text-xs opacity-70 uppercase tracking-wider">Expires</p>
            <p className="mt-1 font-mono">{account.cardExpiry}</p>
          </div>
        )}
      </div>
    </div>
  )
}
