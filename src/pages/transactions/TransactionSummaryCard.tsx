import React from "react";
import {
  FaArrowUp,
  FaArrowDown,
  FaArrowTrendUp,
  FaArrowTrendDown,
} from "react-icons/fa6";

export interface SummaryCardData {
  label: string;
  net: string;
  netPositive: boolean;
  change: string;
  changePositive: boolean;
  income: string;
  incomeChange: string;
  expense: string;
  expenseChange: string;
}

export const TransactionSummaryCard: React.FC<SummaryCardData> = ({
  label,
  net,
  netPositive,
  change,
  changePositive,
  income,
  incomeChange,
  expense,
  expenseChange,
}) => {
  return (
    <div className="flex h-full w-full flex-col p-3 gap-3">
      {/* Row 1 — overview */}
      <div className="flex flex-1 flex-col justify-between rounded-[28px] bg-stone-100 px-5 py-4 dark:bg-zinc-800">
        <span className="text-xs font-semibold tracking-widest text-stone-400 uppercase dark:text-stone-500">
          {label}
        </span>
        <div>
          <p
            className={`text-[38px] leading-none font-bold ${
              netPositive
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-rose-500 dark:text-rose-400"
            }`}
          >
            {net}
          </p>
          <div
            className={`mt-1.5 flex items-center gap-1 text-sm font-semibold ${
              changePositive ? "text-emerald-500" : "text-rose-400"
            }`}
          >
            {changePositive ? (
              <FaArrowTrendUp className="text-xs" />
            ) : (
              <FaArrowTrendDown className="text-xs" />
            )}
            {change} vs prev
          </div>
        </div>
      </div>

      {/* Row 2 — income + expense */}
      <div className="flex gap-3" style={{ height: "120px" }}>
        {/* Income */}
        <div className="flex flex-1 flex-col justify-between rounded-[24px] bg-emerald-50 px-4 py-3.5 dark:bg-emerald-950/40">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <FaArrowUp className="text-[10px]" />
            <span className="text-[10px] font-bold tracking-widest uppercase">
              Income
            </span>
          </div>
          <div>
            <p className="text-[18px] font-bold leading-none text-emerald-700 dark:text-emerald-300">
              {income}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-emerald-500/80">
              {incomeChange}
            </p>
          </div>
        </div>

        {/* Expense */}
        <div className="flex flex-1 flex-col justify-between rounded-[24px] bg-rose-50 px-4 py-3.5 dark:bg-rose-950/40">
          <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
            <FaArrowDown className="text-[10px]" />
            <span className="text-[10px] font-bold tracking-widest uppercase">
              Expense
            </span>
          </div>
          <div>
            <p className="text-[18px] font-bold leading-none text-rose-600 dark:text-rose-400">
              {expense}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-rose-400/80">
              {expenseChange}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
