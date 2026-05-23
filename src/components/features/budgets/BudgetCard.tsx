import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AmountText } from '@/components/shared/AmountText'
import { CategoryPill } from '@/components/shared/CategoryPill'
import { SegmentedProgressBar } from '@/components/shared/SegmentedProgressBar'
import { computeCategoryTotals } from '@/lib/budget-period'
import { cn } from '@/lib/utils'
import type { Budget } from '@/types'

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  one_time: 'One-time',
}

interface BudgetCardProps {
  budget: Budget
  onDelete: (id: string) => void
}

export function BudgetCard({ budget, onDelete }: BudgetCardProps) {
  const progress = budget.progress
  const symbol = budget.currency?.symbol ?? ''
  const decimals = budget.currency?.decimals ?? 2
  const isExceeded = progress?.is_exceeded ?? false

  const categoryTotals = useMemo(
    () => computeCategoryTotals(budget.matchingTransactions ?? [], budget.amount),
    [budget.matchingTransactions, budget.amount],
  )

  return (
    <Card className={cn('relative transition-shadow hover:shadow-md', !budget.isActive && 'opacity-60')}>
      {/* Status stripe — rounded-t-lg matches card border-radius without overflow-hidden */}
      <div className={cn('h-1 rounded-tl-lg rounded-tr-lg', budget.isActive ? 'bg-primary' : 'bg-muted-foreground/30')} />

      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <Link to={`/budgets/${budget.id}`} className="flex-1 min-w-0 hover:underline">
            <p className="font-semibold text-sm leading-tight truncate">{budget.name}</p>
          </Link>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-xs">
              {PERIOD_LABELS[budget.period] ?? budget.period}
            </Badge>
            {!budget.isActive && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/budgets/${budget.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete budget?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The budget "{budget.name}" will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(budget.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-1 min-h-5">
          {budget.isGlobal ? (
            <span className="text-xs text-muted-foreground">All expenses</span>
          ) : budget.categories.length > 0 ? (
            budget.categories.map(c => (
              <CategoryPill key={c.id} name={c.name} icon={c.icon} color={c.color} size="sm" />
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No categories</span>
          )}
        </div>

        {/* Amount row */}
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold font-mono">
            <AmountText value={budget.amount} decimals={decimals} currency={symbol} />
          </span>
          {progress && (
            <span className={cn('text-xs font-medium', isExceeded ? 'text-red-600' : 'text-muted-foreground')}>
              {progress.percent.toFixed(0)}% used
            </span>
          )}
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="space-y-1">
            <SegmentedProgressBar
              categoryTotals={categoryTotals}
              budgetAmount={budget.amount}
              spent={progress.spent}
              isExceeded={isExceeded}
              decimals={decimals}
              currency={symbol}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                <AmountText value={progress.spent} decimals={decimals} currency={symbol} /> spent
              </span>
              <span className={cn(isExceeded && 'text-red-600 font-medium')}>
                {isExceeded ? (
                  <>Over by <AmountText value={progress.spent - budget.amount} decimals={decimals} currency={symbol} /></>
                ) : (
                  <><AmountText value={progress.remaining} decimals={decimals} currency={symbol} /> left</>
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
