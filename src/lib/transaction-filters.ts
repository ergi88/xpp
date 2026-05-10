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
