import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  EyeOff,
  Lock,
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AmountText } from "@/components/shared";
import {
  useAccounts,
  useHideAmounts,
  useTotalBalance,
  useUpdateSettings,
} from "@/hooks";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ACCOUNT_TYPE_CONFIG } from "@/constants";
import type { AccountType } from "@/types";
import { useIsMobile } from "@/hooks/use-mobile";

export function Header() {
  const { lock } = useAuth();
  const isMobile = useIsMobile();
  const hideAmounts = useHideAmounts();
  const updateSettings = useUpdateSettings();
  const { data: balance } = useTotalBalance();
  const { data: accounts } = useAccounts({
    active: true,
  });

  const navigate = useNavigate();

  const handleCreateTransaction = (type: "income" | "expense" | "transfer") => {
    navigate(`/transactions/create?type=${type}`);
  };

  const handleHideAmountsToggle = () => {
    updateSettings.mutate({ hide_amounts: !hideAmounts });
  };

  return (
    <header className="sticky top-0 z-50 h-14 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
        </div>

        <div className="flex items-center gap-3">
          {!isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Transaction</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleCreateTransaction("income")}
                >
                  <ArrowDownLeft className="size-4 mr-2 text-green-600" />
                  Income
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleCreateTransaction("expense")}
                >
                  <ArrowUpRight className="size-4 mr-2 text-red-600" />
                  Expense
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleCreateTransaction("transfer")}
                >
                  <ArrowLeftRight className="size-4 mr-2 text-blue-600" />
                  Transfer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {balance && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 px-2">
                  <Wallet className="size-4 text-muted-foreground" />
                  <AmountText
                    value={balance.total_balance ?? 0}
                    decimals={balance.decimals ?? 2}
                    currency={balance.currency}
                    className="font-mono font-medium flex-nowrap"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Active accounts
                </div>
                <DropdownMenuSeparator />
                {accounts && accounts.length > 0 ? (
                  accounts.map((account) => {
                    const config =
                      ACCOUNT_TYPE_CONFIG[account.type as AccountType];
                    const Icon = config?.icon || Wallet;
                    return (
                      <DropdownMenuItem
                        key={account.id}
                        className="flex items-center justify-between gap-6"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`flex size-8 items-center justify-center rounded-md shrink-0 ${
                              config?.color || "bg-muted"
                            }`}
                          >
                            <Icon className="size-4" />
                          </div>
                          <span className="text-sm truncate">
                            {account.name}
                          </span>
                        </div>
                        <div className="text-right flex flex-nowrap items-center gap-1">
                          <AmountText
                            value={account.currentBalance ?? 0}
                            decimals={account.currency?.decimals ?? 2}
                            currency={account.currency?.symbol ?? ""}
                            className="text-sm font-mono font-medium flex-nowrap"
                          />
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                ) : (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    No active accounts
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={lock}
            aria-label="Lock app"
          >
            <Lock className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleHideAmountsToggle}
            aria-label={hideAmounts ? "Show amounts" : "Hide amounts"}
            disabled={updateSettings.isPending}
          >
            {hideAmounts ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
