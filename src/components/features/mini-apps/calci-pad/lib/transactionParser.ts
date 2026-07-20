import type { Account } from '@/types/accounts'
import type { Category } from '@/types/categories'
import type { Tag } from '@/types/tags'
import type { Currency, DraftType, ParsedDraft } from '../types'
import { stripComments, preprocessExpression, safeEval } from './evaluator'

export interface ParseContext {
  accounts: Account[]
  categories: Category[]
  tags: Tag[]
  currencies: Currency[]
}

/**
 * Glyph appended to a line once a transaction has been created from it. Always
 * placed inside the comment region (after `//`) so the calculator still
 * evaluates the amount and shows a result.
 */
export const CREATED_MARK = '✓'

export function isLineCreated(line: string): boolean {
  return line.trimEnd().endsWith(CREATED_MARK)
}

/** Append the created mark to a line (idempotent). Adds a `//` comment first if
 *  the line has none, so the mark never breaks amount evaluation. */
export function markLine(line: string): string {
  if (!line.trim() || isLineCreated(line)) return line
  const hasComment = line.includes('//') || line.includes('#')
  const base = line.trimEnd()
  return hasComment ? `${base} ${CREATED_MARK}` : `${base} //${CREATED_MARK}`
}

interface CommentTokens {
  /** Bare words before the first prefixed token → category name. */
  categoryText: string
  /** `#word` tokens. */
  tagWords: string[]
  /** `@word` → source account. */
  accountWord: string | null
  /** `> word` (or `>word`) → transfer destination. */
  transferWord: string | null
  /** Trailing bare words after a prefixed token → description. */
  description: string
}

/**
 * Evaluate the numeric part of a line (the bit before `//` or `#`). Returns the
 * signed value, or null when the line has no computable number (headers, empty
 * lines, prose). Reuses the calculator's own preprocess + eval so `2k`, `%`,
 * parentheses etc. behave exactly like the results column.
 */
export function parseAmount(line: string): number | null {
  const expr = stripComments(line)
  if (!expr) return null
  const value = safeEval(preprocessExpression(expr))
  if (value === null || !isFinite(value)) return null
  return value
}

/**
 * Split the comment (everything after `//`) into typed buckets. Grammar:
 *   bare word(s)   → category (accumulated until the first prefixed token)
 *   #word          → tag
 *   @word          → source account
 *   > word / >word → transfer destination
 *   leftover words → description
 */
export function tokenizeComment(comment: string): CommentTokens {
  const tokens: CommentTokens = {
    categoryText: '',
    tagWords: [],
    accountWord: null,
    transferWord: null,
    description: '',
  }

  // Normalise `>foo` to `> foo` so a glued transfer token still splits out.
  const words = comment
    .replace(/>/g, ' > ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const categoryParts: string[] = []
  const descriptionParts: string[] = []
  // Bare words go to the category until we've seen a prefixed token; after that
  // they read as free description.
  let seenPrefixed = false

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w === '>') {
      seenPrefixed = true
      const next = words[i + 1]
      if (next && !isPrefixed(next)) {
        tokens.transferWord = next
        i++
      }
      continue
    }
    if (w.startsWith('#') && w.length > 1) {
      seenPrefixed = true
      tokens.tagWords.push(w.slice(1))
      continue
    }
    if (w.startsWith('@') && w.length > 1) {
      seenPrefixed = true
      tokens.accountWord = w.slice(1)
      continue
    }
    // Bare word.
    if (seenPrefixed) descriptionParts.push(w)
    else categoryParts.push(w)
  }

  tokens.categoryText = categoryParts.join(' ').trim()
  tokens.description = descriptionParts.join(' ').trim()
  return tokens
}

function isPrefixed(word: string): boolean {
  return word === '>' || word.startsWith('#') || word.startsWith('@')
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** Exact (case-insensitive) match first, then a contains match. */
function findByName<T extends { name: string }>(
  items: T[],
  query: string,
): T | undefined {
  const q = norm(query)
  if (!q) return undefined
  return (
    items.find((i) => norm(i.name) === q) ??
    items.find((i) => norm(i.name).includes(q) || q.includes(norm(i.name)))
  )
}

/** First active, non-debt account carrying a positive balance. */
export function defaultAccount(accounts: Account[]): Account | undefined {
  return accounts.find(
    (a) => a.isActive && a.type !== 'debt' && a.currentBalance > 0,
  )
}

/**
 * Parse every line of the page into drafts. Lines with no computable amount are
 * skipped, so headers / prose / blank lines drop out silently.
 */
export function buildDrafts(text: string, ctx: ParseContext): ParsedDraft[] {
  const lines = text.split('\n')
  const drafts: ParsedDraft[] = []
  const fallbackAccount = defaultAccount(ctx.accounts) ?? ctx.accounts[0]

  lines.forEach((line, lineIndex) => {
    const amount = parseAmount(line)
    if (amount === null) return

    // Everything after `//` (or `#`) is the comment. `#` also starts a comment
    // per the calculator, so mirror that: prefer `//`, fall back to `#`.
    const slashIdx = line.indexOf('//')
    const hashIdx = line.indexOf('#')
    let comment = ''
    if (slashIdx >= 0) comment = line.slice(slashIdx + 2)
    else if (hashIdx >= 0) comment = line.slice(hashIdx + 1)

    // Drop a trailing created-mark so it never leaks into the description/tags.
    const created = isLineCreated(line)
    comment = comment.replace(/\s*✓\s*$/, '')

    const tokens = tokenizeComment(comment)
    const unresolved: ParsedDraft['unresolved'] = {}

    const type: DraftType = tokens.transferWord ? 'transfer' : amount < 0 ? 'expense' : 'income'

    // Source account: @token, else default.
    let account: Account | undefined = fallbackAccount
    if (tokens.accountWord) {
      const match = findByName(ctx.accounts, tokens.accountWord)
      if (match) account = match
      else unresolved.account = tokens.accountWord
    }

    // Transfer destination.
    let toAccount: Account | undefined
    if (tokens.transferWord) {
      const match = findByName(ctx.accounts, tokens.transferWord)
      if (match) toAccount = match
      else unresolved.account = tokens.transferWord
    }

    // Category (income/expense only), matched within the derived type; fall back
    // to the most-used category of that type.
    let categoryId: string | null = null
    if (type !== 'transfer') {
      const ofType = ctx.categories.filter((c) => c.type === type)
      if (tokens.categoryText) {
        const match = findByName(ofType, tokens.categoryText)
        if (match) categoryId = match.id
        else {
          unresolved.category = tokens.categoryText
          categoryId = mostUsed(ofType)?.id ?? null
        }
      } else {
        categoryId = mostUsed(ofType)?.id ?? null
      }
    }

    // Tags: resolve existing only; collect misses.
    const tagIds: string[] = []
    const missedTags: string[] = []
    for (const w of tokens.tagWords) {
      const match = findByName(ctx.tags, w)
      if (match) tagIds.push(match.id)
      else missedTags.push(w)
    }
    if (missedTags.length) unresolved.tags = missedTags

    drafts.push({
      id: `${lineIndex}-${crypto.randomUUID()}`,
      lineIndex,
      sourceLine: line,
      type,
      amount: Math.abs(amount),
      accountId: account?.id ?? null,
      toAccountId: toAccount?.id ?? null,
      categoryId,
      tagIds,
      description: tokens.description,
      created,
      unresolved,
    })
  })

  return drafts
}

function mostUsed(categories: Category[]): Category | undefined {
  return [...categories].sort(
    (a, b) => (b.transactionsCount ?? 0) - (a.transactionsCount ?? 0),
  )[0]
}

// ── Editor autocomplete ──────────────────────────────────────────────────────

export type TokenKind = 'category' | 'tag' | 'account'

export interface ActiveToken {
  kind: TokenKind
  /** The partial text after any prefix, to filter suggestions by. */
  query: string
  /** Absolute offset where a chosen replacement should begin. */
  start: number
  /** Absolute offset where the replacement ends (the caret). */
  end: number
}

/**
 * Inspect the caret position and return the token currently being typed inside
 * a `//` comment, or null. `#word` → tag, `@word` → account, a bare word after
 * `>` → account (transfer destination), any other bare word → category.
 */
export function getActiveToken(text: string, caret: number): ActiveToken | null {
  if (caret < 0 || caret > text.length) return null

  const lineStart = text.lastIndexOf('\n', caret - 1) + 1
  const lineUpToCaret = text.slice(lineStart, caret)
  const slashIdx = lineUpToCaret.indexOf('//')
  if (slashIdx < 0) return null // caret not inside a comment
  const commentStart = lineStart + slashIdx + 2
  if (caret < commentStart) return null

  // Current word = run of non-space chars ending at the caret.
  let wordStart = caret
  while (wordStart > commentStart && !/\s/.test(text[wordStart - 1])) wordStart--
  const word = text.slice(wordStart, caret)

  const precededByTransfer = (offset: number): boolean => {
    // Walk back over whitespace, then check the previous token is exactly '>'.
    let j = offset
    while (j > commentStart && /\s/.test(text[j - 1])) j--
    return text[j - 1] === '>'
  }

  if (word === '') {
    // Just after `> ` → offer accounts with an empty query.
    if (precededByTransfer(caret)) {
      return { kind: 'account', query: '', start: caret, end: caret }
    }
    return null
  }

  if (word === '>') return null // the marker itself; wait for the next word

  if (word.startsWith('#')) {
    return { kind: 'tag', query: word.slice(1), start: wordStart + 1, end: caret }
  }
  if (word.startsWith('@')) {
    return { kind: 'account', query: word.slice(1), start: wordStart + 1, end: caret }
  }

  // Bare word.
  if (precededByTransfer(wordStart)) {
    return { kind: 'account', query: word, start: wordStart, end: caret }
  }
  return { kind: 'category', query: word, start: wordStart, end: caret }
}

/** Case-insensitive prefix-then-contains filter over named entities. */
export function filterByQuery<T extends { name: string }>(
  items: T[],
  query: string,
  limit = 6,
): T[] {
  const q = norm(query)
  if (!q) return items.slice(0, limit)
  const starts = items.filter((i) => norm(i.name).startsWith(q))
  const contains = items.filter(
    (i) => !norm(i.name).startsWith(q) && norm(i.name).includes(q),
  )
  return [...starts, ...contains].slice(0, limit)
}
