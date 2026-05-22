import { useDebtSummary } from "@/hooks";
import { AmountText } from "@/components/shared/AmountText";
import { cn } from "@/lib/utils";
import { FaArrowTrendDown, FaArrowTrendUp, FaScaleBalanced } from "react-icons/fa6";

export function DebtWidgets() {
  const { data: summary } = useDebtSummary();

  if (!summary) return null;

  const { currency, decimals, total_i_owe, total_owed_to_me, net_debt } = summary;
  const netPositive = net_debt >= 0;

  return (
    <div className="rounded-2xl border border-[#E0DEDA] bg-[#FBFCF9] shadow-md dark:border-white/10 dark:bg-zinc-900 w-full overflow-hidden">
      <div className="flex flex-col gap-2 p-3">
        {/* Net — main row */}
        <div className="flex flex-col justify-between rounded-xl bg-stone-100 px-4 py-3 dark:bg-zinc-800">
          <span className="text-[10px] font-bold tracking-widest text-stone-400 uppercase dark:text-stone-500">
            Net Position
          </span>
          <div className="flex items-end gap-2 mt-1">
            <AmountText
              value={Math.abs(net_debt)}
              currency={currency}
              decimals={decimals}
              className={cn(
                "text-[26px] leading-none font-bold block",
                netPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
              )}
            />
            <span className="text-[11px] text-muted-foreground mb-0.5">
              {netPositive ? "in your favor" : "you owe"}
            </span>
          </div>
        </div>

        {/* I Owe + Owed to Me */}
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1 rounded-lg bg-rose-50 px-3 py-2.5 dark:bg-rose-950/40">
            <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <FaArrowTrendDown className="text-[8px] shrink-0" />
              <span className="text-[9px] font-bold tracking-widest uppercase flex-1">I Owe</span>
            </div>
            <AmountText
              value={total_i_owe}
              currency={currency}
              decimals={decimals}
              className="text-[15px] font-bold leading-none text-rose-600 dark:text-rose-400"
            />
          </div>

          <div className="flex flex-1 flex-col gap-1 rounded-lg bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/40">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <FaArrowTrendUp className="text-[8px] shrink-0" />
              <span className="text-[9px] font-bold tracking-widest uppercase flex-1">Owed to Me</span>
            </div>
            <AmountText
              value={total_owed_to_me}
              currency={currency}
              decimals={decimals}
              className="text-[15px] font-bold leading-none text-emerald-700 dark:text-emerald-300"
            />
          </div>

          <div className="flex flex-1 flex-col gap-1 rounded-lg bg-stone-100 px-3 py-2.5 dark:bg-zinc-800">
            <div className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
              <FaScaleBalanced className="text-[8px] shrink-0" />
              <span className="text-[9px] font-bold tracking-widest uppercase flex-1">Balance</span>
            </div>
            <AmountText
              value={Math.abs(net_debt)}
              currency={currency}
              decimals={decimals}
              className={cn(
                "text-[15px] font-bold leading-none",
                netPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
