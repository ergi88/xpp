import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AmountText } from '@/components/shared/AmountText'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTransactions } from '@/hooks'
import { findCounterpartCandidates } from '@/lib/counterpart-matcher'
import type { Transaction } from '@/types'

interface Props {
  source: Transaction
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (targetId: string) => void
  isSubmitting?: boolean
}

export function CounterpartLinkPicker({
  source,
  open,
  onOpenChange,
  onPick,
  isSubmitting,
}: Props) {
  const { data } = useTransactions({
    per_page: 9999,
    include_split_children: false,
    include_excluded: true,
  })

  const candidates = useMemo(() => {
    if (!data?.data) return []
    return findCounterpartCandidates(source, data.data)
  }, [data, source])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link counterpart</DialogTitle>
          <DialogDescription>
            Pick an opposite-type transaction on a different account, within
            ±7 days, with matching amount. Linking removes the pair from
            category / budget aggregates so the transfer is not double-counted.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No candidates found. The other side must be an opposite-type
            transaction on a different account within ±7 days, with the same
            amount, not already linked, and not a split child.
          </p>
        ) : (
          <ul className="divide-y border rounded-lg max-h-96 overflow-auto">
            {candidates.map((c) => {
              const Icon = c.type === 'income' ? ArrowDownLeft : ArrowUpRight
              const color = c.type === 'income' ? 'text-green-600' : 'text-red-600'
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c.id)}
                    disabled={isSubmitting}
                    className="w-full text-left p-3 hover:bg-muted transition-colors flex items-center gap-3"
                  >
                    <Icon className={cn('size-4 shrink-0', color)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {c.description || (
                          <span className="italic text-muted-foreground">
                            No description
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(c.date).toLocaleDateString()} ·{' '}
                        {c.account?.name}
                      </div>
                    </div>
                    <div className="font-mono font-medium tabular-nums">
                      <AmountText
                        value={c.amount}
                        decimals={c.account.currency?.decimals ?? 2}
                        currency={c.account.currency?.symbol}
                      />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
