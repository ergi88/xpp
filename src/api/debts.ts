import { v4 as uuidv4 } from 'uuid'
import { adapter } from "./client";
import { toLocalDateString } from "@/lib/date";
import { currenciesApi } from "./currencies";
import { getCurrencyMap } from "@/lib/currency";
import { getBaseCurrencyMeta } from "./accounts";
import { transactionsApi } from "./transactions";
import type {
  Currency,
  Debt,
  DebtSummary,
  DebtsResponse,
  Transaction,
} from "@/types";
import type { DebtFormData, DebtPaymentFormData } from "@/schemas";

function toDebt(
  r: Record<string, unknown>,
  currencyMap?: Map<string, Currency>,
): Debt {
  const targetAmount = Number(r.target_amount ?? r.amount ?? 0);
  const paidAmount = Number(r.paid_amount ?? 0);
  // Migration default: legacy rows have no current_balance column → fall back
  // to paidAmount. Reconcile will reset it to the true running net (which
  // additionally includes the origin TX contribution) on first run.
  const rawCurrentBalance = r.current_balance;
  const currentBalance =
    rawCurrentBalance === undefined ||
    rawCurrentBalance === null ||
    rawCurrentBalance === ""
      ? paidAmount
      : Number(rawCurrentBalance);
  const remainingDebt = Math.max(0, targetAmount - paidAmount);
  return {
    id: r.id as string,
    name: r.name as string,
    type: "debt",
    debtType: r.debt_type as Debt["debtType"],
    debtTypeLabel: r.debt_type as string,
    currencyId: r.currency_id as string,
    targetAmount,
    paidAmount,
    currentBalance,
    remainingDebt,
    paymentProgress: targetAmount > 0 ? (paidAmount / targetAmount) * 100 : 0,
    dueDate: r.due_date as string | undefined,
    counterparty: r.counterparty as string | undefined,
    description: r.description as string | undefined,
    isPaidOff: remainingDebt <= 0,
    isActive: remainingDebt > 0,
    createdAt: r.created_at as string | undefined,
    currency: currencyMap?.get(r.currency_id as string),
    originTransactionId: (r.origin_transaction_id as string) || null,
  };
}

// Origin TX direction: how the origin TX itself contributes to current_balance.
// Mirrors the same rule as debtDeltaSign for non-origin TXs: same-direction
// settles (+1), opposite grows (-1). For the canonical "create-from-form"
// flow, the origin is opposite-direction so it grows the debt:
//   - i_owe + income origin → -amount  (received money you'll owe back)
//   - owed_to_me + expense origin → -amount  (paid someone who'll repay)
export function originDirectionSign(
  txnType: "income" | "expense" | "transfer",
  debtType: "i_owe" | "owed_to_me",
): 1 | -1 {
  const same =
    (txnType === "expense" && debtType === "i_owe") ||
    (txnType === "income" && debtType === "owed_to_me");
  return same ? 1 : -1;
}

async function loadCurrencyMap(): Promise<Map<string, Currency>> {
  return getCurrencyMap(await currenciesApi.getAll());
}

export const debtsApi = {
  getAll: async (params?: { include_completed?: boolean }): Promise<Debt[]> => {
    const [rows, currencyMap] = await Promise.all([
      adapter.getAll("debts"),
      loadCurrencyMap(),
    ]);
    const debts = rows.map((row) => toDebt(row, currencyMap));
    return params?.include_completed ? debts : debts.filter((d) => d.isActive);
  },

  getAllWithSummary: async (params?: {
    include_completed?: boolean;
  }): Promise<DebtsResponse> => {
    const [{ baseCurrency, currency, decimals }, data] = await Promise.all([
      getBaseCurrencyMeta(),
      debtsApi.getAll(params),
    ]);
    const aggregateDebts = data.filter(
      (debt) => !!baseCurrency && debt.currencyId === baseCurrency.id,
    );
    const iOwe = aggregateDebts.filter((d) => d.debtType === "i_owe");
    const owedToMe = aggregateDebts.filter((d) => d.debtType === "owed_to_me");
    const summary: DebtSummary = {
      total_i_owe: iOwe.reduce((s, d) => s + d.remainingDebt, 0),
      total_owed_to_me: owedToMe.reduce((s, d) => s + d.remainingDebt, 0),
      net_debt:
        iOwe.reduce((s, d) => s + d.remainingDebt, 0) -
        owedToMe.reduce((s, d) => s + d.remainingDebt, 0),
      debts_count: aggregateDebts.length,
      currency,
      decimals,
    };
    return { data, summary };
  },

  getById: async (id: string | number): Promise<Debt> => {
    const [r, currencyMap] = await Promise.all([
      adapter.getById("debts", String(id)),
      loadCurrencyMap(),
    ]);
    if (!r) throw new Error("Debt not found");
    return toDebt(r, currencyMap);
  },

  create: async (data: DebtFormData): Promise<Debt> => {
    // Resolve the origin transaction ID:
    // - If origin_transaction_id is provided (debt created FROM an existing
    //   transaction), use it directly.
    // - If origin_account_id is provided (debt created standalone with an
    //   account link), create the transaction now.
    // - Otherwise, no origin transaction.
    let originTransactionId = data.origin_transaction_id ?? '';
    if (!originTransactionId && data.origin_account_id) {
      const txnType = data.debt_type === 'i_owe' ? 'income' : 'expense';
      const originTxn = await transactionsApi.create({
        type: txnType,
        account_id: data.origin_account_id,
        amount: data.amount,
        date: data.origin_date ?? toLocalDateString(new Date()),
        description: data.name,
      } as Parameters<typeof transactionsApi.create>[0]);
      originTransactionId = originTxn.id;
    }

    // Initialize current_balance from the origin TX's signed contribution.
    // For the canonical create-from-form path the origin is always opposite-
    // direction, so this seeds a negative running net (debt grows).
    let initialCurrentBalance = 0;
    if (originTransactionId) {
      try {
        const origin = await transactionsApi.getById(originTransactionId);
        if (origin.type !== "transfer") {
          initialCurrentBalance =
            origin.amount *
            originDirectionSign(origin.type, data.debt_type);
        }
      } catch {
        // Origin lookup failed — leave at 0; reconcile can fix later.
      }
    }

    const [r, currencyMap] = await Promise.all([
      adapter.create("debts", {
        id: uuidv4(),
        name: data.name,
        debt_type: data.debt_type,
        currency_id: data.currency_id,
        target_amount: data.amount,
        paid_amount: 0,
        current_balance: initialCurrentBalance,
        due_date: data.due_date ?? "",
        counterparty: data.counterparty ?? "",
        description: data.description ?? "",
        origin_transaction_id: originTransactionId,
        created_at: new Date().toISOString(),
      }),
      loadCurrencyMap(),
    ]);
    return toDebt(r, currencyMap);
  },

  update: async (
    id: string | number,
    data: Partial<DebtFormData>,
  ): Promise<Debt> => {
    const payload: Record<string, unknown> = {
      ...data,
    };

    if (data.amount !== undefined) {
      payload.target_amount = data.amount;
      delete payload.amount;
    }

    if (data.due_date !== undefined) {
      payload.due_date = data.due_date;
    }

    const [r, currencyMap] = await Promise.all([
      adapter.update("debts", String(id), payload),
      loadCurrencyMap(),
    ]);
    return toDebt(r, currencyMap);
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete("debts", String(id)),

  // Bumps both paid_amount and current_balance by the same signed delta.
  // Called for debt_id-linked TXs (post-origin movements).
  updateBalance: async (id: string | number, delta: number): Promise<void> => {
    const debt = await debtsApi.getById(id);
    await adapter.update("debts", String(id), {
      paid_amount: debt.paidAmount + delta,
      current_balance: debt.currentBalance + delta,
    });
  },

  // Bumps only current_balance — used when an origin TX itself changes.
  // paid_amount is untouched because the origin TX has no debt_id and never
  // contributed to paid_amount in the first place.
  updateOriginContribution: async (
    id: string | number,
    delta: number,
  ): Promise<void> => {
    const debt = await debtsApi.getById(id);
    await adapter.update("debts", String(id), {
      current_balance: debt.currentBalance + delta,
    });
  },

  // Creates an expense transaction (for i_owe debts) linked via debt_id so that
  // applyTransactionEffects automatically advances paid_amount.
  makePayment: async (
    debtId: string | number,
    data: DebtPaymentFormData,
  ): Promise<Transaction> => {
    const debt = await debtsApi.getById(debtId);
    return transactionsApi.create({
      type: "expense",
      account_id: String(data.account_id),
      amount: data.amount,
      date: data.date,
      debt_id: String(debtId),
      description: data.description ?? `Payment for ${debt.name}`,
    } as Parameters<typeof transactionsApi.create>[0]);
  },

  // Creates an income transaction (for owed_to_me debts) linked via debt_id so
  // that applyTransactionEffects automatically advances paid_amount.
  collectPayment: async (
    debtId: string | number,
    data: DebtPaymentFormData,
  ): Promise<Transaction> => {
    const debt = await debtsApi.getById(debtId);
    return transactionsApi.create({
      type: "income",
      account_id: String(data.account_id),
      amount: data.amount,
      date: data.date,
      debt_id: String(debtId),
      description: data.description ?? `Collection for ${debt.name}`,
    } as Parameters<typeof transactionsApi.create>[0]);
  },

  // Returns all transactions associated with a debt:
  // - the origin transaction (if debt.originTransactionId is set)
  // - all payment/collection transactions that have debt_id = debtId
  getTransactionsForDebt: async (debtId: string | number): Promise<{
    origin: Transaction | null;
    payments: Transaction[];
  }> => {
    const debt = await debtsApi.getById(debtId);
    const allTxns = (await transactionsApi.getAll({ per_page: 99999 })).data;

    const payments = allTxns.filter(
      (t) => t.debtId === String(debtId),
    );

    let origin: Transaction | null = null;
    if (debt.originTransactionId) {
      origin = allTxns.find((t) => t.id === debt.originTransactionId) ?? null;
      if (!origin) {
        // Fallback: fetch directly in case it was filtered out
        try {
          origin = await transactionsApi.getById(debt.originTransactionId);
        } catch {
          origin = null;
        }
      }
    }

    return { origin, payments };
  },

  reopen: async (id: string | number): Promise<Debt> => {
    // Reset both running totals. current_balance gets re-seeded from the
    // origin TX (if any) so the debt starts at the same place it would on
    // a fresh create.
    const existing = await debtsApi.getById(id);
    let resetCurrentBalance = 0;
    if (existing.originTransactionId) {
      try {
        const origin = await transactionsApi.getById(existing.originTransactionId);
        if (origin.type !== "transfer") {
          resetCurrentBalance =
            origin.amount *
            originDirectionSign(origin.type, existing.debtType);
        }
      } catch {
        /* leave at 0 */
      }
    }
    const [r, currencyMap] = await Promise.all([
      adapter.update("debts", String(id), {
        paid_amount: 0,
        current_balance: resetCurrentBalance,
      }),
      loadCurrencyMap(),
    ]);
    return toDebt(r, currencyMap);
  },

  merge: async (debtIds: string[]): Promise<Debt> => {
    if (debtIds.length < 2) throw new Error('Need at least 2 debts to merge')
    const [allDebts, currencyMap] = await Promise.all([
      Promise.all(debtIds.map((id) => debtsApi.getById(id))),
      loadCurrencyMap(),
    ])
    // Primary = oldest by created_at
    const sorted = [...allDebts].sort((a, b) =>
      (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
    )
    const primary = sorted[0]
    const others = sorted.slice(1)

    const totalTarget = allDebts.reduce((s, d) => s + d.targetAmount, 0)
    const totalPaid = allDebts.reduce((s, d) => s + d.paidAmount, 0)
    const totalCurrent = allDebts.reduce((s, d) => s + d.currentBalance, 0)

    // Reassign all payment + origin transactions from other debts to primary
    const allTxns = (await transactionsApi.getAll({ per_page: 99999 })).data
    await Promise.all(
      others.flatMap((debt) => {
        const updates: Promise<unknown>[] = allTxns
          .filter((t) => t.debtId === debt.id)
          .map((t) => adapter.update('transactions', t.id, { debt_id: primary.id }))
        // Also link the origin transaction of the inferior debt to primary
        if (debt.originTransactionId) {
          const originTxn = allTxns.find((t) => t.id === debt.originTransactionId)
          if (originTxn) {
            updates.push(adapter.update('transactions', originTxn.id, { debt_id: primary.id }))
          }
        }
        return updates
      }),
    )

    // Update primary with summed amounts
    const [updated] = await Promise.all([
      adapter.update('debts', primary.id, {
        target_amount: totalTarget,
        paid_amount: totalPaid,
        current_balance: totalCurrent,
      }),
      ...others.map((d) => adapter.delete('debts', d.id)),
    ])
    return toDebt(updated, currencyMap)
  },

  getSummary: async (): Promise<DebtSummary> => {
    const res = await debtsApi.getAllWithSummary();
    return res.summary!;
  },
};
