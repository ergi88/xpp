import { adapter } from "./client";
import { currenciesApi } from "./currencies";
import { getCurrencyMap } from "@/lib/currency";
import { toBool, toIdOrNull } from "@/lib/coerce";
import type { Currency } from "@/types";

const EPSILON = 0.01;

export type ReconcileEntryKind = "account" | "debt";

export interface ReconcileDriftEntry {
  id: string;
  name: string;
  kind: ReconcileEntryKind;
  currentBalance: number;
  expectedBalance: number;
  drift: number;
  currencySymbol?: string;
  currencyCode?: string;
  decimals: number;
  // Debt-only: paid_amount also gets rewritten on apply (kept in lockstep
  // with current_balance so the legacy split stays internally consistent).
  expectedPaidAmount?: number;
}

export interface ReconcileReport {
  entries: ReconcileDriftEntry[];
  checkedAccounts: number;
  checkedDebts: number;
  generatedAt: string;
}

interface RawTxn {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  toAmount: number | null;
  accountId: string;
  toAccountId: string | null;
  debtId: string | null;
  parentId: string | null;
}

function rowToRawTxn(r: Record<string, unknown>): RawTxn {
  return {
    id: String(r.id),
    type: r.type as RawTxn["type"],
    amount: Number(r.amount ?? 0),
    toAmount:
      r.to_amount === "" || r.to_amount == null ? null : Number(r.to_amount),
    accountId: String(r.account_id ?? ""),
    toAccountId: toIdOrNull(r.to_account_id),
    debtId: toIdOrNull(r.debt_id),
    parentId: toIdOrNull(r.parent_id),
  };
}

interface RawAccount {
  id: string;
  name: string;
  type: string;
  currencyId: string;
  initialBalance: number;
  balance: number;
  isActive: boolean;
}

function rowToRawAccount(r: Record<string, unknown>): RawAccount {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    type: String(r.type ?? ""),
    currencyId: String(r.currency_id ?? ""),
    initialBalance: Number(r.initial_balance ?? 0),
    balance: Number(r.balance ?? 0),
    isActive: toBool(r.is_active),
  };
}

interface RawDebt {
  id: string;
  name: string;
  debtType: "i_owe" | "owed_to_me";
  currencyId: string;
  paidAmount: number;
  currentBalance: number;
  hasCurrentBalanceColumn: boolean;
  originTransactionId: string | null;
}

function rowToRawDebt(r: Record<string, unknown>): RawDebt {
  const rawCurrent = r.current_balance;
  const hasColumn =
    rawCurrent !== undefined && rawCurrent !== null && rawCurrent !== "";
  const paidAmount = Number(r.paid_amount ?? 0);
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    debtType: r.debt_type as RawDebt["debtType"],
    currencyId: String(r.currency_id ?? ""),
    paidAmount,
    // Same migration default as toDebt — fall back to paidAmount so a fresh
    // run on un-migrated data still flags only real drift, not the missing
    // origin contribution that will be backfilled on apply.
    currentBalance: hasColumn ? Number(rawCurrent) : paidAmount,
    hasCurrentBalanceColumn: hasColumn,
    originTransactionId: toIdOrNull(r.origin_transaction_id),
  };
}

function debtDirectionSign(
  txnType: RawTxn["type"],
  debtType: RawDebt["debtType"],
): 1 | -1 {
  const same =
    (txnType === "expense" && debtType === "i_owe") ||
    (txnType === "income" && debtType === "owed_to_me");
  return same ? 1 : -1;
}

function computeExpectedAccountBalance(
  account: RawAccount,
  txns: RawTxn[],
): number {
  let total = account.initialBalance;
  for (const t of txns) {
    if (t.parentId) continue;
    if (t.type === "income" && t.accountId === account.id) {
      total += t.amount;
    } else if (t.type === "expense" && t.accountId === account.id) {
      total -= t.amount;
    } else if (t.type === "transfer") {
      if (t.accountId === account.id) total -= t.amount;
      if (t.toAccountId === account.id) total += t.toAmount ?? t.amount;
    }
  }
  return total;
}

// paid_amount = signed sum of debt_id-linked, non-origin TX deltas.
function computeExpectedDebtPaid(debt: RawDebt, txns: RawTxn[]): number {
  let paid = 0;
  for (const t of txns) {
    if (t.debtId !== debt.id) continue;
    if (t.id === debt.originTransactionId) continue;
    if (t.type === "transfer") continue;
    paid += t.amount * debtDirectionSign(t.type, debt.debtType);
  }
  return paid;
}

// current_balance = paid_amount + origin TX contribution (signed by direction).
function computeExpectedDebtCurrent(
  debt: RawDebt,
  txns: RawTxn[],
  expectedPaid: number,
): number {
  let originContribution = 0;
  if (debt.originTransactionId) {
    const origin = txns.find((t) => t.id === debt.originTransactionId);
    if (origin && origin.type !== "transfer") {
      originContribution =
        origin.amount * debtDirectionSign(origin.type, debt.debtType);
    }
  }
  return expectedPaid + originContribution;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function loadCurrencyContext(): Promise<Map<string, Currency>> {
  return getCurrencyMap(await currenciesApi.getAll());
}

export const reconcileApi = {
  computeReport: async (): Promise<ReconcileReport> => {
    const [txnRows, accountRows, debtRows, currencyMap] = await Promise.all([
      adapter.getAll("transactions"),
      adapter.getAll("accounts"),
      adapter.getAll("debts"),
      loadCurrencyContext(),
    ]);

    const txns = txnRows.map(rowToRawTxn);
    const accounts = accountRows.map(rowToRawAccount);
    const debts = debtRows.map(rowToRawDebt);

    const entries: ReconcileDriftEntry[] = [];

    for (const account of accounts) {
      const expected = round2(computeExpectedAccountBalance(account, txns));
      const current = round2(account.balance);
      const drift = round2(expected - current);
      if (Math.abs(drift) > EPSILON) {
        const currency = currencyMap.get(account.currencyId);
        entries.push({
          id: account.id,
          name: account.name,
          kind: "account",
          currentBalance: current,
          expectedBalance: expected,
          drift,
          currencySymbol: currency?.symbol,
          currencyCode: currency?.code,
          decimals: currency?.decimals ?? 2,
        });
      }
    }

    for (const debt of debts) {
      const expectedPaid = round2(computeExpectedDebtPaid(debt, txns));
      const expectedCurrent = round2(
        computeExpectedDebtCurrent(debt, txns, expectedPaid),
      );
      const currentStored = round2(debt.currentBalance);
      // Migration case: column never written. Show drift only if the
      // expected running net actually differs from the legacy paidAmount
      // fallback — otherwise applying just writes the new column with the
      // value it already implicitly held.
      const drift = round2(expectedCurrent - currentStored);
      const paidDrift = round2(expectedPaid - debt.paidAmount);
      const needsMigration =
        !debt.hasCurrentBalanceColumn &&
        Math.abs(expectedCurrent - debt.paidAmount) > EPSILON;
      if (
        Math.abs(drift) > EPSILON ||
        Math.abs(paidDrift) > EPSILON ||
        needsMigration
      ) {
        const currency = currencyMap.get(debt.currencyId);
        entries.push({
          id: debt.id,
          name: debt.name,
          kind: "debt",
          currentBalance: currentStored,
          expectedBalance: expectedCurrent,
          drift,
          currencySymbol: currency?.symbol,
          currencyCode: currency?.code,
          decimals: currency?.decimals ?? 2,
          expectedPaidAmount: expectedPaid,
        });
      }
    }

    return {
      entries,
      checkedAccounts: accounts.length,
      checkedDebts: debts.length,
      generatedAt: new Date().toISOString(),
    };
  },

  applyReport: async (report: ReconcileReport): Promise<number> => {
    let fixed = 0;
    for (const entry of report.entries) {
      if (entry.kind === "account") {
        await adapter.update("accounts", entry.id, {
          balance: entry.expectedBalance,
        });
      } else {
        await adapter.update("debts", entry.id, {
          current_balance: entry.expectedBalance,
          paid_amount: entry.expectedPaidAmount ?? entry.expectedBalance,
        });
      }
      fixed += 1;
    }
    return fixed;
  },
};
