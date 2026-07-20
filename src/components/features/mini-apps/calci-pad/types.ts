export interface Page {
  id: string
  title: string
  content: string
  color: string
  lastModified: string
  /** Title tracks the first line until the user manually renames the page. */
  autoTitle?: boolean
}

export interface Currency {
  id: string
  code: string
  symbol: string
  rate: number
}

export type DraftType = 'income' | 'expense' | 'transfer'

/**
 * A single CalciPad line parsed into a would-be transaction. Maps cleanly onto
 * `TransactionFormValues` once the user confirms it in the review sheet.
 */
export interface ParsedDraft {
  /** Stable id for React lists / row edits (not persisted). */
  id: string
  /** 0-based index of the source line in the page content. */
  lineIndex: number
  /** The raw line text, kept so we can strip it after a successful save. */
  sourceLine: string
  type: DraftType
  /** Always the absolute value; sign only informs `type`. */
  amount: number
  accountId: string | null
  /** Transfer destination; null for income/expense. */
  toAccountId: string | null
  categoryId: string | null
  tagIds: string[]
  description: string
  /** True when the source line already carries the "created" mark (a
   *  transaction was made from it before). Such rows start inactive in the
   *  review but can be re-added. */
  created: boolean
  /**
   * Tokens the parser could not resolve to a real entity, surfaced as hints in
   * the review sheet so the user knows what got defaulted.
   */
  unresolved: {
    category?: string
    account?: string
    tags?: string[]
  }
}

export const DEFAULT_CURRENCIES: Currency[] = [
  { id: 'usd', code: 'USD', symbol: '$', rate: 1.0 },
  { id: 'eur', code: 'EUR', symbol: '€', rate: 0.95 },
  { id: 'gbp', code: 'GBP', symbol: '£', rate: 0.82 },
  { id: 'all', code: 'ALL', symbol: 'L', rate: 95.0 },
]
