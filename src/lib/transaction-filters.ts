import type { Transaction } from '@/types'

export function excludeExcluded(txns: Transaction[]): Transaction[] {
  return txns.filter(t => !t.isExcluded)
}

export function excludeOneTime(txns: Transaction[]): Transaction[] {
  return txns.filter(t => !t.isOneTime)
}

export function excludeSplitChildren(txns: Transaction[]): Transaction[] {
  return txns.filter(t => !t.parentId)
}

export function collapseLinkedPairs(txns: Transaction[]): Transaction[] {
  const dropped = new Set<string>()
  const result: Transaction[] = []
  for (const t of txns) {
    if (dropped.has(t.id)) continue
    result.push(t)
    if (t.linkedTransactionId) dropped.add(t.linkedTransactionId)
  }
  return result
}

// Pass-through until Phase 3 lands split children. When children exist,
// this will replace each parent (whose id appears as another row's parentId)
// with its children, so category-attribution surfaces see per-category amounts.
// Today there are no split children so the input is returned unchanged.
export function expandSplitChildrenForCategoryView(
  txns: Transaction[],
): Transaction[] {
  return txns
}
