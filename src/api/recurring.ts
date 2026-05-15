// Phase 2 NOTE: when a recurring-detection feature is added (Phase 5 engine),
// it must filter out is_excluded, is_one_time, and split children before
// matching candidates. See spec §4.1 matrix row 'Recurring detection'.
import { v4 as uuidv4 } from 'uuid'
import { adapter } from './client'
import type { RecurringTransaction } from '@/types'
import type { RecurringFormData } from '@/schemas'
import { accountsApi } from './accounts'
import { categoriesApi } from './categories'
import { tagsApi } from './tags'
import { transactionsApi } from './transactions'
import { advanceNextRunDate } from '@/lib/recurring-schedule'

function toRecurring(
  r: Record<string, unknown>,
  accountMap: Map<string, unknown>,
  categoryMap: Map<string, unknown>,
  tagMap: Map<string, unknown>,
): RecurringTransaction {
  const tagIds = r.tag_ids ? String(r.tag_ids).split(',').filter(Boolean) : []
  return {
    id: r.id as string,
    type: r.type as RecurringTransaction['type'],
    accountId: r.account_id as string,
    toAccountId: r.to_account_id as string | undefined,
    categoryId: r.category_id as string | undefined,
    amount: Number(r.amount),
    toAmount: r.to_amount ? Number(r.to_amount) : undefined,
    description: r.description as string | undefined,
    frequency: r.frequency as RecurringTransaction['frequency'],
    frequencyLabel: r.frequency as string,
    interval: Number(r.interval ?? 1),
    dayOfWeek: r.day_of_week !== undefined && r.day_of_week !== '' ? Number(r.day_of_week) : undefined,
    dayOfMonth: r.day_of_month !== undefined && r.day_of_month !== '' ? Number(r.day_of_month) : undefined,
    startDate: r.start_date as string,
    endDate: r.end_date as string | undefined,
    nextRunDate: r.next_run_date as string,
    lastRunDate: r.last_run_date as string | undefined,
    isActive: r.is_active === 'true' || r.is_active === true,
    account: accountMap.get(r.account_id as string) as RecurringTransaction['account'],
    toAccount: r.to_account_id ? accountMap.get(r.to_account_id as string) as RecurringTransaction['toAccount'] : undefined,
    category: r.category_id ? categoryMap.get(r.category_id as string) as RecurringTransaction['category'] : undefined,
    tags: tagIds.map(tid => tagMap.get(tid)).filter(Boolean) as RecurringTransaction['tags'],
    createdAt: r.created_at as string | undefined,
    createdFromTransactionId: r.created_from_transaction_id ? String(r.created_from_transaction_id) : undefined,
  }
}

const VALID_TYPES = ['income', 'expense', 'transfer'] as const
type ValidTxnType = (typeof VALID_TYPES)[number]

// LocalStorage lock prevents the engine from re-firing while the GAS write
// for a generated transaction is still queued in the offline mutation queue
// (transactionsApi.getAll won't see the queued create, and the recurring's
// next_run_date update is also queued, so without a local lock the engine
// would treat the same period as "still due" on every reload).
function lockKey(recurringId: string, date: string): string {
  return `xpp_recurring_lock_${recurringId}_${date}`
}

async function runOne(r: RecurringTransaction): Promise<{ skipped: boolean }> {
  // Fix 2: validate type strictly — if sheet's type column has garbage
  // (uuid, empty, anything else), surface a real error instead of writing
  // a malformed transaction that breaks applyTransactionEffects.
  if (!VALID_TYPES.includes(r.type as ValidTxnType)) {
    throw new Error(
      `Recurring ${r.id} has invalid type "${r.type}". Expected one of income/expense/transfer. Check the recurring sheet row.`,
    )
  }

  // Decide whether to create. Two dedup paths:
  //   - LocalStorage lock keyed by (id + nextRunDate): catches the case
  //     where backend hasn't yet reflected our previous create (offline
  //     queue, GAS cache lag, PWA service-worker cached GET).
  //   - Server-side check via getAll: catches cross-device dedup once
  //     queues drain.
  const key = lockKey(r.id, r.nextRunDate)
  const hasLocalLock =
    typeof localStorage !== 'undefined' && !!localStorage.getItem(key)

  let alreadyRanOnServer = false
  if (!hasLocalLock) {
    const existing = await transactionsApi.getAll({
      per_page: 9999,
      include_excluded: true,
      include_split_children: true,
    })
    alreadyRanOnServer = existing.data.some(
      t => t.recurringId === r.id && t.date === r.nextRunDate,
    )
  }

  const shouldCreate = !hasLocalLock && !alreadyRanOnServer

  if (shouldCreate) {
    // Set the lock BEFORE firing the create. If the create gets queued
    // and the page reloads, the lock blocks a re-fire.
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, new Date().toISOString())
    }
    await transactionsApi.create({
      type: r.type as ValidTxnType,
      account_id: r.accountId,
      to_account_id: r.toAccountId ?? null,
      category_id: r.categoryId ?? null,
      amount: r.amount,
      to_amount: r.toAmount ?? null,
      description: r.description ?? '',
      date: r.nextRunDate,
      tag_ids: r.tags.map(t => t.id),
      recurring_id: r.id,
      // Phase 5 fix: engine-generated → needs user approval.
      is_approved: false,
    })
  } else if (alreadyRanOnServer && typeof localStorage !== 'undefined') {
    // Server confirms the run happened — clear any stale lock so
    // localStorage doesn't grow unbounded.
    localStorage.removeItem(key)
  }

  // CRITICAL: advance the schedule on EVERY pass, even when we skipped
  // the create. Otherwise the while-loop in runDueRecurring would re-read
  // the same nextRunDate (because the recurring row's date hasn't moved),
  // the lock would short-circuit again, and the iteration could spin or
  // duplicate-fire across refreshes if the local lock cleared.
  const next = advanceNextRunDate(
    r.nextRunDate,
    r.frequency,
    r.interval,
    r.dayOfWeek,
    r.dayOfMonth,
  )
  const shouldDeactivate = r.endDate ? next > r.endDate : false
  await adapter.update('recurring', r.id, {
    next_run_date: next,
    last_run_date: r.nextRunDate,
    is_active: shouldDeactivate ? 'false' : 'true',
  })

  return { skipped: !shouldCreate }
}

export const recurringApi = {
  getAll: async (): Promise<RecurringTransaction[]> => {
    const [rows, accounts, categories, tags] = await Promise.all([
      adapter.getAll('recurring'),
      accountsApi.getAll(),
      categoriesApi.getAll(),
      tagsApi.getAll(),
    ])
    const accountMap = new Map(accounts.map(a => [a.id, a]))
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const tagMap = new Map(tags.map(t => [t.id, t]))
    return rows.map(r => toRecurring(r, accountMap, categoryMap, tagMap))
  },

  getById: async (id: string | number): Promise<RecurringTransaction> => {
    const [r, accounts, categories, tags] = await Promise.all([
      adapter.getById('recurring', String(id)),
      accountsApi.getAll(),
      categoriesApi.getAll(),
      tagsApi.getAll(),
    ])
    if (!r) throw new Error('Recurring not found')
    const accountMap = new Map(accounts.map(a => [a.id, a]))
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const tagMap = new Map(tags.map(t => [t.id, t]))
    return toRecurring(r, accountMap, categoryMap, tagMap)
  },

  create: async (data: RecurringFormData): Promise<RecurringTransaction> => {
    await adapter.create('recurring', {
      id: uuidv4(),
      type: data.type,
      account_id: data.account_id,
      to_account_id: data.to_account_id ?? '',
      category_id: data.category_id ?? '',
      amount: data.amount,
      to_amount: data.to_amount ?? '',
      description: data.description ?? '',
      frequency: data.frequency,
      interval: data.interval,
      day_of_week: data.day_of_week ?? '',
      day_of_month: data.day_of_month ?? '',
      start_date: data.start_date,
      end_date: data.end_date ?? '',
      next_run_date: data.start_date,
      is_active: String(data.is_active),
      tag_ids: (data.tag_ids ?? []).join(','),
      created_from_transaction_id: (data as RecurringFormData & { created_from_transaction_id?: string }).created_from_transaction_id ?? '',
      last_run_date: '',
      created_at: new Date().toISOString(),
    })
    return recurringApi.getAll().then(all => all.find(r => r.accountId === String(data.account_id))!)
  },

  update: async (id: string | number, data: Partial<RecurringFormData>): Promise<RecurringTransaction> => {
    await adapter.update('recurring', String(id), {
      ...data,
      tag_ids: data.tag_ids ? data.tag_ids.join(',') : undefined,
    } as Record<string, unknown>)
    return recurringApi.getById(id)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('recurring', String(id)),

  skip: async (id: string | number): Promise<RecurringTransaction> =>
    recurringApi.getById(id),

  getUpcoming: async (): Promise<RecurringTransaction[]> => {
    const all = await recurringApi.getAll()
    const today = new Date().toISOString().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    return all.filter(r => r.isActive && r.nextRunDate >= today && r.nextRunDate <= in30)
      .sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate))
  },

  runDueRecurring: async (): Promise<number> => {
    // Skip entirely when offline — engine writes would queue in the
    // mutation queue, but next_run_date wouldn't advance server-side and
    // getAll wouldn't see the queued creates, so on every reload while
    // offline the engine would re-fire the same period. The local lock
    // (in runOne) is a belt; this skip is suspenders.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 0
    }
    const all = await recurringApi.getAll()
    const today = new Date().toISOString().slice(0, 10)
    const due = all.filter(r => r.isActive && r.nextRunDate <= today)
    let count = 0
    for (const r of due) {
      // Loop in case template missed multiple periods.
      let current = r
      while (current.isActive && current.nextRunDate <= today) {
        const result = await runOne(current)
        if (!result.skipped) count++
        // Re-fetch to get the freshly advanced row.
        current = await recurringApi.getById(current.id)
      }
    }
    return count
  },

  runNow: async (id: string | number): Promise<RecurringTransaction> => {
    const r = await recurringApi.getById(id)
    await runOne(r)
    return recurringApi.getById(id)
  },
}
