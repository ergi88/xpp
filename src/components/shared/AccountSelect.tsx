import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  BottomSheet,
  type BottomSheetItem,
} from "@/components/ui/bottom-sheet";
import { useAccounts } from "@/hooks";
import { ACCOUNT_TYPE_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";
import { AccountAvatar } from "@/components/shared/AccountAvatar";
import { AmountText } from "@/components/shared";
import type { AccountType } from "@/types";

interface AccountSelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  excludeId?: string | null;
  excludeDebts?: boolean;
  activeOnly?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function AccountSelect({
  value,
  onChange,
  excludeId,
  excludeDebts = true,
  activeOnly = true,
  placeholder = "Select account",
  disabled,
}: AccountSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: accounts } = useAccounts({
    active: activeOnly,
    exclude_debts: excludeDebts,
  });

  const filtered =
    accounts?.filter((a) => !(excludeId && a.id === excludeId)) ?? [];

  const selected = filtered.find((a) => a.id === value);

  const items: BottomSheetItem[] = filtered.map((account) => {
    const config = ACCOUNT_TYPE_CONFIG[account.type as AccountType];
    return {
      id: account.id,
      label: account.name,
      description: config?.label,
      keywords: account.currency?.code,
      iconNode: <AccountAvatar account={account} size="sm" />,
      right: (
        <span>
          <AmountText
            value={account.currentBalance}
            decimals={account.currency?.decimals ?? 2}
            currency={account.currency?.symbol ?? ""}
          />
        </span>
      ),
    };
  });

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5 text-left transition hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50",
        )}
        aria-haspopup="dialog"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {selected ? (
            <AccountAvatar account={selected} size="md" />
          ) : (
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted" />
          )}
          <div className="min-w-0">
            {selected ? (
              <>
                <div className="truncate text-sm font-semibold">
                  {selected.name}
                </div>
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  <AmountText
                    value={selected.currentBalance}
                    decimals={selected.currency?.decimals ?? 2}
                    currency={selected.currency?.symbol ?? ""}
                  />{" "}
                  {selected.currency?.symbol}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">{placeholder}</div>
            )}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={placeholder}
        items={items}
        layout="list"
        searchable={filtered.length > 6}
        selectedId={value ?? null}
        onSelect={onChange}
        emptyMessage="No accounts available"
      />
    </>
  );
}
