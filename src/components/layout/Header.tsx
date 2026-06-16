import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePageTitle } from "@/lib/page-title-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Eye,
  EyeOff,
  Lock,
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  RefreshCw,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AmountText, ReconcileAllDialog } from "@/components/shared";
import {
  useAccounts,
  useHideAmounts,
  useNotifications,
  useSettings,
  useTotalBalance,
  useUpdateSettings,
} from "@/hooks";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { AccountAvatar } from "@/components/shared/AccountAvatar";
import { useIsMobile } from "@/hooks/use-mobile";

export function Header() {
  const pageTitle = usePageTitle();
  const { lock, hasAuth } = useAuth();
  const isMobile = useIsMobile();
  const hideAmounts = useHideAmounts();
  const updateSettings = useUpdateSettings();
  const { data: settings } = useSettings();
  const { data: balance } = useTotalBalance();
  const { data: accounts } = useAccounts({
    active: true,
  });
  const { unreadCount } = useNotifications();
  const [reconcileOpen, setReconcileOpen] = useState(false);

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
        <div className="flex items-center gap-2 min-w-0">
          <SidebarTrigger className="shrink-0" />
          <Separator orientation="vertical" className="h-4 shrink-0" />
          {pageTitle && (
            <span className="font-semibold truncate text-[clamp(0.8rem,1.5vw,1.05rem)] leading-none">
              {pageTitle}
            </span>
          )}
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
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    Active accounts
                  </span>
                  <button
                    type="button"
                    onClick={() => setReconcileOpen(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RefreshCw className="size-3" />
                    Reconcile
                  </button>
                </div>
                <DropdownMenuSeparator />
                {accounts && accounts.length > 0 ? (
                  accounts
                    .filter((a) => a?.isActive && a?.currentBalance > 0)
                    .map((account) => {
                      return (
                        <DropdownMenuItem
                          key={account.id}
                          asChild
                          className="flex items-center justify-between gap-6"
                        >
                          <Link to={`/accounts/${account.id}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <AccountAvatar account={account} size="md" />
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
                          </Link>
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
            onClick={() => navigate("/notifications")}
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>

          {hasAuth && (settings?.lock_enabled ?? true) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={lock}
              aria-label="Lock app"
            >
              <Lock className="h-5 w-5" />
            </Button>
          )}

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

      <ReconcileAllDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
      />
    </header>
  );
}
