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
    Moon,
    Sun,
    Wallet,
    Plus,
    ArrowDownLeft,
    ArrowUpRight,
    ArrowLeftRight,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/hooks/use-theme";
import { useAccounts, useTotalBalance } from "@/hooks";
import { useNavigate } from "react-router-dom";
import { ACCOUNT_TYPE_CONFIG } from "@/constants";
import type { AccountType } from "@/types";

export function Header() {
    const { theme, toggleTheme } = useTheme();
    const { data: balance } = useTotalBalance();
    const { data: accounts } = useAccounts({
        active: true,
    });
    const navigate = useNavigate();

    const handleCreateTransaction = (
        type: "income" | "expense" | "transfer",
    ) => {
        navigate(`/transactions/create?type=${type}`);
    };

    return (
        <header className="sticky top-0 z-50 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-full items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <SidebarTrigger />
                    <Separator orientation="vertical" className="h-4" />
                </div>

                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" className="gap-1">
                                <Plus className="size-4" />
                                <span className="hidden sm:inline">
                                    Transaction
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() =>
                                    handleCreateTransaction("income")
                                }
                            >
                                <ArrowDownLeft className="size-4 mr-2 text-green-600" />
                                Income
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    handleCreateTransaction("expense")
                                }
                            >
                                <ArrowUpRight className="size-4 mr-2 text-red-600" />
                                Expense
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    handleCreateTransaction("transfer")
                                }
                            >
                                <ArrowLeftRight className="size-4 mr-2 text-blue-600" />
                                Transfer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {balance && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2 px-2"
                                >
                                    <Wallet className="size-4 text-muted-foreground" />
                                    <span className="font-mono font-medium">
                                        {(balance.total_balance ?? 0).toFixed(
                                            balance.decimals ?? 2,
                                        )}{" "}
                                        {balance.currency}
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    Active accounts
                                </div>
                                <DropdownMenuSeparator />
                                {accounts && accounts.length > 0 ? (
                                    accounts.map((account) => {
                                        const config =
                                            ACCOUNT_TYPE_CONFIG[
                                                account.type as AccountType
                                            ];
                                        const Icon = config?.icon || Wallet;
                                        return (
                                            <DropdownMenuItem
                                                key={account.id}
                                                className="flex items-center justify-between gap-3"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div
                                                        className={`flex size-8 items-center justify-center rounded-md shrink-0 ${
                                                            config?.color ||
                                                            "bg-muted"
                                                        }`}
                                                    >
                                                        <Icon className="size-4" />
                                                    </div>
                                                    <span className="text-sm truncate">
                                                        {account.name}
                                                    </span>
                                                </div>
                                                <div className="text-right flex no-wrap items-center gap-1">
                                                    <p className="text-sm font-mono font-medium">
                                                        {(
                                                            account.currentBalance ??
                                                            0
                                                        ).toFixed(
                                                            account.currency
                                                                ?.decimals ?? 2,
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {account.currency
                                                            ?.symbol ?? ""}
                                                    </p>
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
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? (
                            <Sun className="h-5 w-5" />
                        ) : (
                            <Moon className="h-5 w-5" />
                        )}
                    </Button>
                </div>
            </div>
        </header>
    );
}
