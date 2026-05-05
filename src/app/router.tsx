import React, { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

const DashboardPage = lazy(() => import('@/pages/dashboard'))
const TransactionsPage = lazy(() => import('@/pages/transactions'))
const TransactionCreatePage = lazy(() => import('@/pages/transactions/create'))
const TransactionEditPage = lazy(() => import('@/pages/transactions/[id]/edit'))
const AccountsPage = lazy(() => import('@/pages/accounts'))
const AccountCreatePage = lazy(() => import('@/pages/accounts/create'))
const AccountEditPage = lazy(() => import('@/pages/accounts/[id]/edit'))
const CategoriesPage = lazy(() => import('@/pages/categories'))
const CategoryCreatePage = lazy(() => import('@/pages/categories/create'))
const CategoryEditPage = lazy(() => import('@/pages/categories/[id]/edit'))
const CurrenciesPage = lazy(() => import('@/pages/currencies'))
const CurrencyCreatePage = lazy(() => import('@/pages/currencies/create'))
const CurrencyEditPage = lazy(() => import('@/pages/currencies/[id]/edit'))
const BudgetsPage = lazy(() => import('@/pages/budgets'))
const BudgetCreatePage = lazy(() => import('@/pages/budgets/create'))
const BudgetEditPage = lazy(() => import('@/pages/budgets/[id]/edit'))
const TagsPage = lazy(() => import('@/pages/tags'))
const TagCreatePage = lazy(() => import('@/pages/tags/create'))
const TagEditPage = lazy(() => import('@/pages/tags/[id]/edit'))
const DebtsPage = lazy(() => import('@/pages/debts'))
const DebtCreatePage = lazy(() => import('@/pages/debts/create'))
const DebtEditPage = lazy(() => import('@/pages/debts/[id]/edit'))
const RecurringPage = lazy(() => import('@/pages/recurring'))
const RecurringCreatePage = lazy(() => import('@/pages/recurring/create'))
const RecurringEditPage = lazy(() => import('@/pages/recurring/[id]/edit'))
const ReportsPage = lazy(() => import('@/pages/reports'))
const SystemSettingsPage = lazy(() => import('@/pages/settings/system'))
const ImportSettingsPage = lazy(() => import('@/pages/settings/import'))
const NotFoundPage = lazy(() => import('@/pages/not-found'))

const withSuspense = (Component: React.LazyExoticComponent<() => React.ReactElement>) => (
  <ErrorBoundary>
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <Component />
    </Suspense>
  </ErrorBoundary>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: withSuspense(DashboardPage) },
      { path: 'transactions', element: withSuspense(TransactionsPage) },
      { path: 'transactions/create', element: withSuspense(TransactionCreatePage) },
      { path: 'transactions/:id/edit', element: withSuspense(TransactionEditPage) },
      { path: 'accounts', element: withSuspense(AccountsPage) },
      { path: 'accounts/create', element: withSuspense(AccountCreatePage) },
      { path: 'accounts/:id/edit', element: withSuspense(AccountEditPage) },
      { path: 'categories', element: withSuspense(CategoriesPage) },
      { path: 'categories/create', element: withSuspense(CategoryCreatePage) },
      { path: 'categories/:id/edit', element: withSuspense(CategoryEditPage) },
      { path: 'currencies', element: withSuspense(CurrenciesPage) },
      { path: 'currencies/create', element: withSuspense(CurrencyCreatePage) },
      { path: 'currencies/:id/edit', element: withSuspense(CurrencyEditPage) },
      { path: 'budgets', element: withSuspense(BudgetsPage) },
      { path: 'budgets/create', element: withSuspense(BudgetCreatePage) },
      { path: 'budgets/:id/edit', element: withSuspense(BudgetEditPage) },
      { path: 'tags', element: withSuspense(TagsPage) },
      { path: 'tags/create', element: withSuspense(TagCreatePage) },
      { path: 'tags/:id/edit', element: withSuspense(TagEditPage) },
      { path: 'debts', element: withSuspense(DebtsPage) },
      { path: 'debts/create', element: withSuspense(DebtCreatePage) },
      { path: 'debts/:id/edit', element: withSuspense(DebtEditPage) },
      { path: 'recurring', element: withSuspense(RecurringPage) },
      { path: 'recurring/create', element: withSuspense(RecurringCreatePage) },
      { path: 'recurring/:id/edit', element: withSuspense(RecurringEditPage) },
      { path: 'reports', element: withSuspense(ReportsPage) },
      { path: 'settings/system', element: withSuspense(SystemSettingsPage) },
      { path: 'settings/import', element: withSuspense(ImportSettingsPage) },
    ],
  },
  { path: '*', element: withSuspense(NotFoundPage) },
])
