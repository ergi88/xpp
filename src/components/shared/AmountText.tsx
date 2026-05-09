import type { HTMLAttributes } from "react";

import { useHideAmounts } from "@/hooks";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  type AmountSignDisplay,
  type CurrencyPosition,
} from "@/lib/money";

interface AmountTextProps extends HTMLAttributes<HTMLSpanElement> {
  value: number;
  decimals?: number;
  currency?: string;
  currencyPosition?: CurrencyPosition;
  signDisplay?: AmountSignDisplay;
  absolute?: boolean;
  hideable?: boolean;
}

export function AmountText({
  value,
  decimals = 2,
  currency = "",
  currencyPosition = "suffix",
  signDisplay = "auto",
  absolute = false,
  hideable = true,
  className,
  ...props
}: AmountTextProps) {
  const hideAmounts = useHideAmounts();
  const formatted = formatMoney({
    value,
    decimals,
    currency,
    currencyPosition,
    absolute,
    signDisplay,
  });

  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap tabular-nums transition-[filter,opacity]",
        hideable && hideAmounts && "blur-sm select-none",
        className,
      )}
      aria-label={hideable && hideAmounts ? "Hidden amount" : formatted}
      {...props}
    >
      {formatted}
    </span>
  );
}
