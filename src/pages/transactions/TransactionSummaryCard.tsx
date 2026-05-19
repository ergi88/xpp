import React from "react";
import {
  FaArrowUp,
  FaArrowDown,
  FaArrowTrendUp,
  FaArrowTrendDown,
} from "react-icons/fa6";
import { AmountText } from "@/components/shared/AmountText";
import { cn } from "@/lib/utils";

export interface SummaryCardData {
  label: string;
  comparisonLabel: string;
  income: number;
  expense: number;
  prevIncome: number;
  prevExpense: number;
  currency: string;
  decimals: number;
}

function pctLabel(current: number, previous: number): string | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return current > 0 ? "+∞%" : "-∞%";
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

export const TransactionSummaryCard: React.FC<SummaryCardData> = ({
  label,
  comparisonLabel,
  income,
  expense,
  prevIncome,
  prevExpense,
  currency,
  decimals,
}) => {
  const net = income - expense;
  const prevNet = prevIncome - prevExpense;
  const deltaNet = net - prevNet;
  const hasPrev =
    comparisonLabel !== "" && (prevIncome !== 0 || prevExpense !== 0);

  const netPositive = net >= 0;
  const deltaPositive = deltaNet >= 0;

  const netPct = pctLabel(net, prevNet);
  const incomePct = pctLabel(income, prevIncome);
  const expensePct = pctLabel(expense, prevExpense);

  return (
    <div className="flex flex-col gap-2 p-3 h-full w-full">
      {/* Row 1 — net overview */}
      <div className="flex flex-1 flex-col justify-between rounded-xl bg-stone-100 px-4 py-3 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-widest text-stone-400 uppercase dark:text-stone-500">
            {label}
          </span>
          {comparisonLabel && (
            <span className="text-[10px] text-muted-foreground">
              {comparisonLabel}
            </span>
          )}
        </div>

        <div>
          <AmountText
            value={net}
            currency={currency}
            decimals={decimals}
            signDisplay="auto"
            className={cn(
              "text-[26px] leading-none font-bold block",
              netPositive
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-rose-500 dark:text-rose-400",
            )}
          />

          {hasPrev && (
            <div
              className={cn(
                "mt-1.5 flex items-center gap-1 text-[11px] font-semibold",
                deltaPositive ? "text-emerald-500" : "text-rose-400",
              )}
            >
              {deltaPositive ? (
                <FaArrowTrendUp className="text-[9px] shrink-0" />
              ) : (
                <FaArrowTrendDown className="text-[9px] shrink-0" />
              )}
              <AmountText
                value={deltaNet}
                currency={currency}
                decimals={decimals}
                signDisplay="always"
                className={cn(
                  "text-[11px] font-semibold",
                  deltaPositive ? "text-emerald-500" : "text-rose-400",
                )}
              />
              {netPct && <span className="opacity-70">({netPct})</span>}
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — income + expense */}
      <div className="flex gap-2">
        {/* Income */}
        <div className="flex flex-1 flex-col gap-1 rounded-lg bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/40">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <FaArrowUp className="text-[8px] shrink-0" />
            <span className="text-[9px] font-bold tracking-widest uppercase flex-1">
              Income
            </span>
            {incomePct && (
              <span
                className={cn(
                  "text-[9px] font-semibold",
                  income >= prevIncome ? "text-emerald-500" : "text-rose-400",
                )}
              >
                {incomePct}
              </span>
            )}
          </div>
          <AmountText
            value={income}
            currency={currency}
            decimals={decimals}
            className="text-[15px] font-bold leading-none text-emerald-700 dark:text-emerald-300"
          />
        </div>

        {/* Expense */}
        <div className="flex flex-1 flex-col gap-1 rounded-lg bg-rose-50 px-3 py-2.5 dark:bg-rose-950/40">
          <div className="flex items-center gap-1 text-rose-500 dark:text-rose-400">
            <FaArrowDown className="text-[8px] shrink-0" />
            <span className="text-[9px] font-bold tracking-widest uppercase flex-1">
              Expense
            </span>
            {expensePct && (
              <span
                className={cn(
                  "text-[9px] font-semibold",
                  expense <= prevExpense ? "text-emerald-500" : "text-rose-400",
                )}
              >
                {expensePct}
              </span>
            )}
          </div>
          <AmountText
            value={expense}
            currency={currency}
            decimals={decimals}
            className="text-[15px] font-bold leading-none text-rose-600 dark:text-rose-400"
          />
        </div>
      </div>
    </div>
  );
};
