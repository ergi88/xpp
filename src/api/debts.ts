import { v4 as uuidv4 } from 'uuid'
import { adapter } from "./client";
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
  const remainingDebt = Math.max(0, targetAmount - paidAmount);
  return {
    id: r.id as string,
    name: r.name as string,
    type: "debt",
    debtType: r.debt_type as Debt["debtType"],
    debtTypeLabel: r.debt_type as string,
    currencyId: r.currency_id as string,
    targetAmount,
    currentBalance: paidAmount,
    remainingDebt,
    paymentProgress: targetAmount > 0 ? (paidAmount / targetAmount) * 100 : 0,
    dueDate: r.due_date as string | undefined,
    counterparty: r.counterparty as string | undefined,
    description: r.description as string | undefined,
    isPaidOff: remainingDebt <= 0,
    isActive: remainingDebt > 0,
    createdAt: r.created_at as string | undefined,
    currency: currencyMap?.get(r.currency_id as string),
  };
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
    const [r, currencyMap] = await Promise.all([
      adapter.create("debts", {
        id: uuidv4(),
        name: data.name,
        debt_type: data.debt_type,
        currency_id: data.currency_id,
        target_amount: data.amount,
        paid_amount: 0,
        due_date: data.due_date ?? "",
        counterparty: data.counterparty ?? "",
        description: data.description ?? "",
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

  makePayment: async (
    debtId: string | number,
    data: DebtPaymentFormData,
  ): Promise<Transaction> => {
    const debt = await debtsApi.getById(debtId);
    const newPaid = debt.currentBalance + data.amount;
    await adapter.update("debts", String(debtId), { paid_amount: newPaid });
    return transactionsApi.create({
      type: "expense",
      account_id: String(data.account_id),
      amount: data.amount,
      date: data.date,
      description: data.description ?? `Payment for ${debt.name}`,
    });
  },

  collectPayment: async (
    debtId: string | number,
    data: DebtPaymentFormData,
  ): Promise<Transaction> => {
    const debt = await debtsApi.getById(debtId);
    const newPaid = debt.currentBalance + data.amount;
    await adapter.update("debts", String(debtId), { paid_amount: newPaid });
    return transactionsApi.create({
      type: "income",
      account_id: String(data.account_id),
      amount: data.amount,
      date: data.date,
      description: data.description ?? `Collection for ${debt.name}`,
    });
  },

  reopen: async (id: string | number): Promise<Debt> => {
    const [r, currencyMap] = await Promise.all([
      adapter.update("debts", String(id), { paid_amount: 0 }),
      loadCurrencyMap(),
    ]);
    return toDebt(r, currencyMap);
  },

  getSummary: async (): Promise<DebtSummary> => {
    const res = await debtsApi.getAllWithSummary();
    return res.summary!;
  },
};
