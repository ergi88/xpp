import { useEffect, useRef, useState } from "react";
import type { CategoryTotal } from "@/lib/budget-period";
import { cn } from "@/lib/utils";
import { AmountText } from "./AmountText";

interface SegmentedProgressBarProps {
  categoryTotals: CategoryTotal[];
  budgetAmount: number;
  spent: number;
  isExceeded: boolean;
  selectedCategoryId?: string | null;
  onSegmentClick?: (id: string | null) => void;
  decimals?: number;
  currency?: string;
  className?: string;
}

export function SegmentedProgressBar({
  categoryTotals,
  budgetAmount,
  spent,
  isExceeded,
  selectedCategoryId,
  onSegmentClick,
  decimals = 2,
  currency = "",
  className,
}: SegmentedProgressBarProps) {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setActiveTooltipId(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const getWidth = (amount: number) =>
    isExceeded && spent > 0
      ? (amount / spent) * 100
      : budgetAmount > 0
        ? (amount / budgetAmount) * 100
        : 0;

  const limitLinePct =
    isExceeded && spent > 0 ? (budgetAmount / spent) * 100 : null;

  let cumPct = 0;
  const segments = categoryTotals.map((s) => {
    const w = getWidth(s.amount);
    const centerPct = cumPct + w / 2;
    cumPct += w;
    return { ...s, w, centerPct };
  });

  const active =
    segments.find((s) => s.category.id === activeTooltipId) ?? null;

  function handleSegmentClick(id: string) {
    const next = activeTooltipId === id ? null : id;
    setActiveTooltipId(next);
    onSegmentClick?.(next);
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Bar */}
      <div
        className={cn(
          "relative flex gap-px h-4 w-full overflow-hidden rounded-xs bg-muted",
          categoryTotals.length > 0 && "cursor-pointer",
        )}
      >
        {segments.map((s) => (
          <div
            key={s.category.id}
            style={{ width: `${s.w}%`, backgroundColor: s.category.color }}
            className={cn(
              "h-full transition-opacity duration-200",
              selectedCategoryId && selectedCategoryId !== s.category.id
                ? "opacity-30"
                : "opacity-100",
            )}
            onClick={() => handleSegmentClick(s.category.id)}
          />
        ))}
        {limitLinePct !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10 pointer-events-none"
            style={{ left: `${limitLinePct}%` }}
          />
        )}
      </div>

      {/* Tooltip */}
      {active && (
        <div
          className="absolute top-full mt-1.5 z-30 -translate-x-1/2 bg-popover border border-border rounded-md shadow-md px-3 py-2 text-xs min-w-36 pointer-events-none"
          style={{ left: `${Math.min(Math.max(active.centerPct, 10), 90)}%` }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: active.category.color }}
            />
            <span className="font-medium text-foreground">
              {active.category.name}
            </span>
          </div>
          <div className="space-y-0.5 text-muted-foreground">
            <div className="flex justify-between gap-3">
              <span>Amount</span>
              <span className="font-mono text-foreground">
                <AmountText
                  value={active.amount}
                  decimals={decimals}
                  currency={currency}
                />
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Of budget</span>
              <span className="font-mono text-foreground">
                {budgetAmount > 0
                  ? ((active.amount / budgetAmount) * 100).toFixed(1)
                  : "0.0"}
                %
              </span>
            </div>
            {isExceeded && (
              <div className="flex justify-between gap-3">
                <span>Of total</span>
                <span className="font-mono text-foreground">
                  {spent > 0
                    ? ((active.amount / spent) * 100).toFixed(1)
                    : "0.0"}
                  %
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
