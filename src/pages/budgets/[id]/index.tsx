import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { Page } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AmountText } from '@/components/shared/AmountText'
import { CategoryPill } from '@/components/shared/CategoryPill'
import { useBudgetWithProgress } from '@/hooks'
import { computeCategoryTotals, periodLabel } from '@/lib/budget-period'
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const { data, isLoading } = useBudgetWithProgress(id!, offset)

  useEffect(() => {
    setSelectedCategoryId(null)
  }, [offset])

  const categoryTotals = useMemo(
    () => computeCategoryTotals(data?.transactions ?? [], data?.budget.amount ?? 0),
    [data],
  )

  const visibleTransactions = useMemo(() => {
    if (!data) return []
    if (!selectedCategoryId) return data.transactions
    return data.transactions.filter(t =>
      selectedCategoryId === '__none__' ? !t.category : t.category?.id === selectedCategoryId,
    )
  }, [data, selectedCategoryId])

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

  const { budget, progress } = data
  const symbol = budget.currency?.symbol ?? ''
  const decimals = budget.currency?.decimals ?? 2
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
            <Button variant="ghost" size="sm" onClick={() => setOffset(o => o + 1)} className="gap-1.5">
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

            {/* Amounts header */}
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

            {/* Segmented bar (Apple storage style) */}
            <div className={cn('flex h-4 w-full overflow-hidden rounded-full bg-muted', isExceeded && 'ring-1 ring-red-500')}>
              {categoryTotals.map(s => (
                <div
                  key={s.category.id}
                  style={{ width: `${s.segPct}%`, backgroundColor: s.category.color }}
                  className={cn(
                    'h-full transition-opacity duration-200',
                    selectedCategoryId && selectedCategoryId !== s.category.id ? 'opacity-30' : 'opacity-100',
                  )}
                />
              ))}
            </div>

            {/* Category breakdown rows */}
            <div className="space-y-1.5">
              {categoryTotals.map(entry => {
                const pct = budget.amount > 0 ? (entry.amount / budget.amount) * 100 : 0
                return (
                  <div key={entry.category.id} className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: entry.category.color }}
                    />
                    <span className="text-sm flex-1 truncate">{entry.category.name}</span>
                    <span className="font-mono text-sm">
                      <AmountText value={entry.amount} decimals={decimals} currency={symbol} />
                    </span>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                )
              })}

              {/* Remaining / exceeded summary row */}
              <div className="flex items-center gap-2 pt-1.5 border-t border-border">
                <span className="size-2.5 shrink-0" />
                <span className={cn('text-sm flex-1', isExceeded ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                  {isExceeded ? 'Exceeded by' : 'Remaining'}
                </span>
                <span className={cn('font-mono text-sm', isExceeded ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                  <AmountText
                    value={isExceeded ? progress.spent - budget.amount : progress.remaining}
                    decimals={decimals}
                    currency={symbol}
                  />
                </span>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {!isExceeded && `${Math.max(0, 100 - Math.min(progress.percent, 100)).toFixed(0)}%`}
                </span>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Transactions */}
        <div className="space-y-2">

          {/* Category filter chips — only when >1 category */}
          {categoryTotals.length > 1 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  selectedCategoryId === null
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                All
              </button>
              {categoryTotals.map(entry => (
                <button
                  key={entry.category.id}
                  onClick={() =>
                    setSelectedCategoryId(
                      selectedCategoryId === entry.category.id ? null : entry.category.id,
                    )
                  }
                  style={
                    selectedCategoryId === entry.category.id
                      ? { backgroundColor: entry.category.color }
                      : undefined
                  }
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    selectedCategoryId === entry.category.id
                      ? 'text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {entry.category.name}
                </button>
              ))}
            </div>
          )}

          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Transactions ({visibleTransactions.length})
          </h2>

          {visibleTransactions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {selectedCategoryId ? 'No transactions for this category.' : 'No transactions in this period.'}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {visibleTransactions
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
