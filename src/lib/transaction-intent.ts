// Deep-link "intent" parsing for the transaction form.
//
// Lets an iOS Shortcut, an Android intent, a home-screen bookmark or any other
// automation open the form with fields already filled — addressing categories,
// accounts and tags by their human-readable NAME, since automations have no way
// to know our internal ids:
//
//   /transactions/new?amount=222&description=Store&date=02/05/2026&category=food
//
// Ids still work (`category_id=...`), and `submit=1` saves without showing the
// form. Anything that cannot be resolved is reported in `problems` and blocks
// auto-submit, so a typo in a Shortcut never silently writes a wrong row.

import { toLocalDateString } from '@/lib/date'

export type IntentType = 'income' | 'expense' | 'transfer'

export interface NamedEntity {
  id: string
  name: string
}

export interface TypedEntity extends NamedEntity {
  type: 'income' | 'expense'
}

export type IntentParams = Record<string, string | null | undefined>

export interface IntentValues {
  type: IntentType
  amount?: number
  description?: string
  date?: string
  account_id?: string
  to_account_id?: string
  category_id?: string
  tag_ids?: string[]
}

export interface ParsedIntent {
  /** true when the URL carried at least one prefill param */
  hasIntent: boolean
  values: IntentValues
  /** human-readable reasons a param could not be applied */
  problems: string[]
  /** submit was requested */
  submitRequested: boolean
  /** submit was requested AND everything resolved cleanly */
  autoSubmit: boolean
}

export interface IntentContext {
  accounts: NamedEntity[]
  categories: TypedEntity[]
  tags: NamedEntity[]
  /** injectable clock, for tests */
  now?: Date
}

const TYPE_ALIASES: Record<string, IntentType> = {
  income: 'income',
  in: 'income',
  credit: 'income',
  deposit: 'income',
  earn: 'income',
  expense: 'expense',
  out: 'expense',
  debit: 'expense',
  spend: 'expense',
  cost: 'expense',
  transfer: 'transfer',
  move: 'transfer',
}

const RELATIVE_DAYS: Record<string, number> = {
  today: 0,
  now: 0,
  yesterday: -1,
  tomorrow: 1,
}

/** Every param that counts as "this URL wants to prefill the form". */
export const INTENT_PARAM_KEYS = [
  'type',
  'amount',
  'description',
  'note',
  'date',
  'account',
  'account_id',
  'to_account',
  'to_account_id',
  'category',
  'category_id',
  'tag',
  'tags',
  'tag_ids',
] as const

// ---------------------------------------------------------------- name lookup

/** Lowercase, de-accent and drop everything that is not alphanumeric. */
export function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export type ResolveOutcome<T> =
  | { status: 'ok'; item: T }
  | { status: 'not_found' }
  | { status: 'ambiguous'; matches: T[] }

/**
 * Resolve a URL value to an entity: exact id first, then exact name, then a
 * unique prefix, then a unique substring. Several hits at the same level are
 * reported as ambiguous rather than guessed at.
 */
export function resolveEntity<T extends NamedEntity>(raw: string, list: T[]): ResolveOutcome<T> {
  const value = raw.trim()
  if (!value) return { status: 'not_found' }

  const byId = list.find(e => e.id === value)
  if (byId) return { status: 'ok', item: byId }

  const key = normalizeName(value)
  if (!key) return { status: 'not_found' }

  const tiers = [
    list.filter(e => normalizeName(e.name) === key),
    list.filter(e => normalizeName(e.name).startsWith(key)),
    list.filter(e => normalizeName(e.name).includes(key)),
  ]
  for (const matches of tiers) {
    if (matches.length === 1) return { status: 'ok', item: matches[0] }
    if (matches.length > 1) return { status: 'ambiguous', matches }
  }
  return { status: 'not_found' }
}

// -------------------------------------------------------------------- amounts

/**
 * Parse an amount the way an automation is likely to send it: "222", "12.50",
 * "€1.234,56", "1,234.56", "-40". A dot is always a decimal point; a comma is
 * one only when it is the sole comma with 1-2 digits behind it. The sign is
 * preserved — callers use it as a type hint.
 */
export function parseIntentAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, '')
  if (!cleaned) return null
  const negative = cleaned.trimStart().startsWith('-')
  const body = cleaned.replace(/-/g, '')
  if (!body) return null

  const lastComma = body.lastIndexOf(',')
  const lastDot = body.lastIndexOf('.')
  let decimalSep = ''
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? ',' : '.'
  } else if (lastComma >= 0) {
    const decimals = body.length - lastComma - 1
    const onlyComma = body.indexOf(',') === lastComma
    if (onlyComma && decimals >= 1 && decimals <= 2) decimalSep = ','
  } else if (lastDot >= 0) {
    decimalSep = '.'
  }

  let normalized = body
  if (decimalSep) {
    const head = body.slice(0, body.lastIndexOf(decimalSep)).replace(/[.,]/g, '')
    const tail = body.slice(body.lastIndexOf(decimalSep) + 1)
    normalized = `${head}.${tail}`
  } else {
    normalized = body.replace(/[.,]/g, '')
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return negative ? -value : value
}

// ---------------------------------------------------------------------- dates

function isoFrom(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day > daysInMonth) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function shiftDays(from: Date, days: number): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
  return toLocalDateString(d)
}

function expandYear(year: number): number {
  return year < 100 ? 2000 + year : year
}

export interface ParseDateOptions {
  /** How to read an ambiguous d/m vs m/d slash date. Defaults to day-first. */
  order?: 'dmy' | 'mdy'
  now?: Date
}

/**
 * Accepts what automations actually produce: ISO dates and timestamps,
 * "02/05/2026" (day-first by default — same as the app's own display format),
 * "2.5.26", "today"/"yesterday", "-3d", and finally anything Date can parse.
 * Returns a plain YYYY-MM-DD, or null when the value makes no sense.
 */
export function parseIntentDate(raw: string, options: ParseDateOptions = {}): string | null {
  const value = raw.trim()
  if (!value) return null
  const now = options.now ?? new Date()

  const key = value.toLowerCase()
  if (key in RELATIVE_DAYS) return shiftDays(now, RELATIVE_DAYS[key])

  const relative = /^([+-]\d{1,4})\s*(?:d|days?)$/.exec(key)
  if (relative) return shiftDays(now, Number(relative[1]))

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return isoFrom(y, m, d)
  }

  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(value)) {
    return toLocalDateString(value) || null
  }

  const parts = /^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(value)
  if (parts) {
    const [, first, second, third] = parts
    // A four-digit leading group can only be a year: 2026/05/02
    if (first.length === 4) return isoFrom(Number(first), Number(second), Number(third))

    const dayFirst = options.order !== 'mdy'
    let day = Number(dayFirst ? first : second)
    let month = Number(dayFirst ? second : first)
    // A value above 12 can only be the day, whichever order was requested.
    if (month > 12 && day <= 12) {
      const swap = day
      day = month
      month = swap
    }
    return isoFrom(expandYear(Number(third)), month, day)
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return toLocalDateString(parsed)
  return null
}

// --------------------------------------------------------------------- intent

function readParam(params: IntentParams, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = params[key]
    if (value === null || value === undefined) continue
    const trimmed = String(value).trim()
    if (trimmed) return trimmed
  }
  return null
}

function isTruthy(value: string | null): boolean {
  if (!value) return false
  const norm = value.toLowerCase()
  return norm === '1' || norm === 'true' || norm === 'yes' || norm === 'on'
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
}

function describeAmbiguity(kind: string, raw: string, matches: NamedEntity[]): string {
  const names = matches
    .slice(0, 3)
    .map(m => m.name)
    .join(', ')
  return `${kind} "${raw}" matches several entries (${names}${matches.length > 3 ? ', …' : ''})`
}

/**
 * Turn URL params into form defaults. Never throws: anything unusable lands in
 * `problems`, which the caller shows to the user and which blocks auto-submit.
 */
export function parseTransactionIntent(params: IntentParams, ctx: IntentContext): ParsedIntent {
  const problems: string[] = []
  const hasIntent = INTENT_PARAM_KEYS.some(key => readParam(params, key) !== null)

  // ---- amount (sign doubles as a type hint) -------------------------------
  const amountRaw = readParam(params, 'amount')
  const signedAmount = amountRaw !== null ? parseIntentAmount(amountRaw) : null
  if (amountRaw !== null && signedAmount === null) {
    problems.push(`Could not read amount "${amountRaw}"`)
  }
  if (signedAmount === 0) {
    problems.push('Amount must be greater than zero')
  }
  const amount = signedAmount !== null && signedAmount !== 0 ? Math.abs(signedAmount) : undefined

  // ---- type ---------------------------------------------------------------
  const typeRaw = readParam(params, 'type')
  let typeExplicit = false
  let type: IntentType = 'expense'
  if (typeRaw !== null) {
    const mapped = TYPE_ALIASES[typeRaw.toLowerCase()]
    if (mapped) {
      type = mapped
      typeExplicit = true
    } else {
      problems.push(`Unknown type "${typeRaw}" — expected income, expense or transfer`)
    }
  } else if (signedAmount !== null && signedAmount > 0 && readParam(params, 'to_account', 'to_account_id')) {
    type = 'transfer'
  }

  const values: IntentValues = { type }

  if (amount !== undefined) values.amount = amount

  // ---- description --------------------------------------------------------
  const description = readParam(params, 'description', 'note')
  if (description) values.description = description.slice(0, 500)

  // ---- date ---------------------------------------------------------------
  const dateRaw = readParam(params, 'date')
  if (dateRaw !== null) {
    const orderRaw = readParam(params, 'date_format', 'date_order')
    const order = orderRaw?.toLowerCase() === 'mdy' ? 'mdy' : 'dmy'
    const date = parseIntentDate(dateRaw, { order, now: ctx.now })
    if (date) values.date = date
    else problems.push(`Could not read date "${dateRaw}" — try YYYY-MM-DD`)
  }

  // ---- accounts -----------------------------------------------------------
  const accountRaw = readParam(params, 'account_id', 'account')
  if (accountRaw !== null) {
    const found = resolveEntity(accountRaw, ctx.accounts)
    if (found.status === 'ok') values.account_id = found.item.id
    else if (found.status === 'ambiguous') problems.push(describeAmbiguity('Account', accountRaw, found.matches))
    else problems.push(`No account named "${accountRaw}"`)
  } else if (ctx.accounts.length === 1 && hasIntent) {
    values.account_id = ctx.accounts[0].id
  }

  const toAccountRaw = readParam(params, 'to_account_id', 'to_account')
  if (toAccountRaw !== null) {
    const found = resolveEntity(toAccountRaw, ctx.accounts)
    if (found.status === 'ok') values.to_account_id = found.item.id
    else if (found.status === 'ambiguous') problems.push(describeAmbiguity('Account', toAccountRaw, found.matches))
    else problems.push(`No account named "${toAccountRaw}"`)
  }

  // ---- category -----------------------------------------------------------
  const categoryRaw = readParam(params, 'category_id', 'category')
  if (categoryRaw !== null) {
    if (values.type === 'transfer') {
      problems.push('Transfers cannot have a category')
    } else {
      const sameType = ctx.categories.filter(c => c.type === values.type)
      let found = resolveEntity(categoryRaw, sameType)
      if (found.status !== 'ok' && !typeExplicit) {
        // "category=salary" with no explicit type: adopt the category's own type
        const anyType = resolveEntity(categoryRaw, ctx.categories)
        if (anyType.status === 'ok') {
          values.type = anyType.item.type
          found = anyType
        }
      }
      if (found.status === 'ok') values.category_id = found.item.id
      else if (found.status === 'ambiguous') problems.push(describeAmbiguity('Category', categoryRaw, found.matches))
      else problems.push(`No ${values.type} category named "${categoryRaw}"`)
    }
  }

  // ---- tags ---------------------------------------------------------------
  const tagsRaw = readParam(params, 'tags', 'tag', 'tag_ids')
  if (tagsRaw !== null) {
    const ids: string[] = []
    for (const entry of splitList(tagsRaw)) {
      const found = resolveEntity(entry, ctx.tags)
      if (found.status === 'ok') ids.push(found.item.id)
      else if (found.status === 'ambiguous') problems.push(describeAmbiguity('Tag', entry, found.matches))
      else problems.push(`No tag named "${entry}"`)
    }
    if (ids.length > 0) values.tag_ids = Array.from(new Set(ids))
  }

  // ---- submit -------------------------------------------------------------
  const submitRequested = isTruthy(readParam(params, 'submit', 'save'))
  if (submitRequested) {
    if (values.amount === undefined) problems.push('Amount is required to save from a link')
    if (!values.account_id) problems.push('Account is required to save from a link')
    if (values.type === 'transfer' && !values.to_account_id) {
      problems.push('Destination account is required to save a transfer')
    }
    if (values.type !== 'transfer' && !values.category_id) {
      problems.push('Category is required to save from a link')
    }
  }

  return {
    hasIntent,
    values,
    problems,
    submitRequested,
    autoSubmit: submitRequested && problems.length === 0,
  }
}
