import { describe, it, expect } from 'vitest'
import { matchRoutes } from 'react-router-dom'
import { router } from '@/app/router'

function matchedPath(pathname: string): string | undefined {
  const matches = matchRoutes(router.routes, pathname)
  return matches?.[matches.length - 1]?.route.path
}

// Deep links from iOS Shortcuts land on these paths; a regression that let
// /transactions/new fall through to :id would dead-end on "Transaction not found".
describe('transaction routes', () => {
  it('routes /transactions/new to the create form, not the detail view', () => {
    expect(matchedPath('/transactions/new')).toBe('transactions/new')
  })

  it('routes /transactions/create to the create form', () => {
    expect(matchedPath('/transactions/create')).toBe('transactions/create')
  })

  it('still routes a real id to the detail view', () => {
    expect(matchedPath('/transactions/8f14e45f-ceea-467a-9575-1c1a1c1a1c1a')).toBe(
      'transactions/:id',
    )
  })

  it('keeps bulk-create ahead of :id', () => {
    expect(matchedPath('/transactions/bulk-create')).toBe('transactions/bulk-create')
  })
})
