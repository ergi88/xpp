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

// Replace each parent (a row whose .children is non-empty) with its children.
// Rows whose own id appears as another row's parent_id are dropped to prevent
// double-counting. Rows with no .children pass through.
export function expandSplitChildrenForCategoryView(
  txns: Transaction[],
): Transaction[] {
  const parentIdsWithChildren = new Set<string>()
  for (const t of txns) {
    if (t.children && t.children.length > 0) parentIdsWithChildren.add(t.id)
  }
  const result: Transaction[] = []
  for (const t of txns) {
    // Skip child rows of a parent we will expand below.
    if (t.parentId && parentIdsWithChildren.has(t.parentId)) continue
    if (t.children && t.children.length > 0) {
      result.push(...t.children)
    } else {
      result.push(t)
    }
  }
  return result
}
