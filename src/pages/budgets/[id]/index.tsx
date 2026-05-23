import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { Page } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AmountText } from '@/components/shared/AmountText'
import { CategoryPill } from '@/components/shared/CategoryPill'
import { useBudgetWithProgress } from '@/hooks'
import { periodLabel } from '@/lib/budget-period'
import { cn } from '@/lib/utils'

const PERIOD_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  one_time: 'One-time',
}

const NAVIGABLE_PERIODS = new Set(['weekly', 'monthly', 'yearly'])

export default function BudgetViewPage() {
  const { id } = useParams<{ id: string }>()
  const [offset, setOffset] = useState(0)
  const { data, isLoading } = useBudgetWithProgress(id!, offset)

  if (isLoading) {
    return (
      <Page title="Budget">
        <div className="p-8 text-muted-foreground text-sm">Loading…</div>
      </Page>
    )
  }

  if (!data) {
    return (
      <Page title="Budget">
        <div className="p-8 text-muted-foreground text-sm">Budget not found.</div>
      </Page>
    )
  }

  const { budget, progress, transactions } = data
  const symbol = budget.currency?.symbol ?? ''
  const decimals = budget.currency?.decimals ?? 2
  const percent = Math.min(progress.percent, 100)
  const isExceeded = progress.is_exceeded
  const canNavigate = NAVIGABLE_PERIODS.has(budget.period)
  const currentPeriodLabel = periodLabel(budget.period, progress.period_start, progress.period_end)

  return (
    <Page title={budget.name}>
      <div className="max-w-2xl mx-auto p-4 pb-12 space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/budgets" className="hover:text-foreground transition-colors flex items-center gap-1.5">
            <ArrowLeft className="size-3.5" />
            Budgets
          </Link>
          <span>/</span>
          <span className="truncate">{budget.name}</span>
        </div>

        {/* Hero */}
        <Card className="overflow-hidden">
          <div className={cn('h-1', budget.isActive ? 'bg-primary' : 'bg-muted-foreground/30')} />
          <CardContent className="p-5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <h1 className="text-xl font-bold">{budget.name}</h1>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline">{PERIOD_LABELS[budget.period] ?? budget.period}</Badge>
                  {!budget.isActive && <Badge variant="secondary">Inactive</Badge>}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/budgets/${budget.id}/edit`}>
                  <Pencil className="size-3.5 mr-1.5" />
                  Edit
                </Link>
              </Button>
            </div>

            {/* Categories */}
            {budget.isGlobal ? (
              <p className="text-sm text-muted-foreground">Applies to all expenses</p>
            ) : budget.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {budget.categories.map(c => (
                  <CategoryPill key={c.id} name={c.name} icon={c.icon} color={c.color} size="sm" />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Period navigator */}
        {canNavigate && (
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(o => o + 1)}
              className="gap-1.5"
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <span className="text-sm font-medium">{currentPeriodLabel}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(o => o - 1)}
              disabled={offset === 0}
              className="gap-1.5"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        {/* Progress card */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-3xl font-bold font-mono">
                  <AmountText value={progress.spent} decimals={decimals} currency={symbol} />
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  of <AmountText value={budget.amount} decimals={decimals} currency={symbol} /> limit
                </p>
              </div>
              <span className={cn('text-2xl font-bold', isExceeded ? 'text-red-600' : 'text-muted-foreground')}>
                {progress.percent.toFixed(0)}%
              </span>
            </div>

            <Progress value={percent} className={cn('h-3', isExceeded && '[&>div]:bg-red-500')} />

            <p className={cn('text-sm', isExceeded ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
              {isExceeded ? (
                <>Exceeded by <AmountText value={progress.spent - budget.amount} decimals={decimals} currency={symbol} /></>
              ) : (
                <><AmountText value={progress.remaining} decimals={decimals} currency={symbol} /> remaining</>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Transactions */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Transactions ({transactions.length})
          </h2>

          {transactions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No transactions in this period.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {transactions
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(t => (
                    <Link
                      key={t.id}
                      to={`/transactions/${t.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-medium truncate">
                          {t.description || <span className="text-muted-foreground italic">No description</span>}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {t.category && (
                            <CategoryPill name={t.category.name} icon={t.category.icon} color={t.category.color} size="sm" />
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-medium text-red-600 shrink-0">
                        −<AmountText value={t.amount} decimals={t.account.currency?.decimals ?? 2} currency={t.account.currency?.symbol} />
                      </span>
                      <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Page>
  )
}
