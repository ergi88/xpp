import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Page } from '@/components/shared'
import { BudgetCard } from '@/components/features/budgets'
import { useBudgetsWithProgress, useDeleteBudget } from '@/hooks'

export default function BudgetsPage() {
  const [search, setSearch] = useState('')
  const { data: budgets, isLoading } = useBudgetsWithProgress()
  const deleteBudget = useDeleteBudget()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return budgets ?? []
    return (budgets ?? []).filter(b => (b.name ?? '').toLowerCase().includes(q))
  }, [search, budgets])

  return (
    <Page title="Budgets">
      <div className="p-4 space-y-4">
        {/* Toolbar */}
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search budgets…"
            className="max-w-xs"
          />
          <Button asChild className="ml-auto">
            <Link to="/budgets/create">
              <Plus className="size-4 mr-2" />
              New Budget
            </Link>
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Wallet className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {search ? 'No budgets match your search.' : 'No budgets yet.'}
            </p>
            {!search && (
              <Button asChild variant="outline" size="sm">
                <Link to="/budgets/create">Create your first budget</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(b => (
              <BudgetCard
                key={b.id}
                budget={b}
                onDelete={id => deleteBudget.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </Page>
  )
}
