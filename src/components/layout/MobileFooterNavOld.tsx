import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Download,
  HandCoins,
  Home,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/hooks";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { cn } from "@/lib/utils";

const FOOTER_ITEMS = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/accounts", label: "Accounts", icon: CreditCard },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
];

const ACTIONS = [
  {
    id: "expense",
    label: "New expense",
    to: "/transactions/create?type=expense",
    icon: ArrowUpRight,
  },
  {
    id: "income",
    label: "New income",
    to: "/transactions/create?type=income",
    icon: ArrowDownLeft,
  },
  {
    id: "transfer",
    label: "Transfer",
    to: "/transactions/create?type=transfer",
    icon: ArrowLeftRight,
  },
  {
    id: "budget",
    label: "New budget",
    to: "/budgets/create",
    icon: PiggyBank,
  },
  {
    id: "account",
    label: "New account",
    to: "/accounts/create",
    icon: CreditCard,
  },
  {
    id: "debt",
    label: "New debt",
    to: "/debts/create",
    icon: HandCoins,
  },
  {
    id: "recurring",
    label: "New recurring",
    to: "/recurring/create",
    icon: Repeat,
  },
];

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.visualViewport) return;

    const viewport = window.visualViewport;
    const handleResize = () => {
      const heightDiff = window.innerHeight - viewport.height;
      setVisible(heightDiff > 120);
    };

    handleResize();
    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, []);

  return visible;
}

function FooterNavItem({
  to,
  label,
  icon: Icon,
  end,
  showLabel,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
  showLabel: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors",
          isActive && "text-primary",
        )
      }
      aria-label={label}
    >
      <Icon className="size-5" />
      {showLabel && <span className="text-[11px]">{label}</span>}
    </NavLink>
  );
}

const FOLDER_LINKS = [
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/debts", label: "Debts", icon: HandCoins },
  { to: "/recurring", label: "Recurring", icon: Repeat },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

interface FolderNavItemProps {
  showLabel?: boolean;
}

function FolderNavItem(fniProps: FolderNavItemProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isOnline, isSyncing, lastSyncTime, sync } = useSyncStatus();
  const { canInstall, install } = usePWAInstall();

  const isActive =
    FOLDER_LINKS.some((l) => location.pathname.startsWith(l.to)) ||
    location.pathname.startsWith("/settings");

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition-colors",
          isActive ? "text-primary" : "text-muted-foreground",
        )}
        aria-label="Finance folder"
        aria-expanded={open}
      >
        <div
          className={cn(
            "size-12 rounded-[5px] grid grid-cols-2 place-items-center gap-px p-1",
            "ring-1 ring-border/60",
            isActive && "ring-primary/40",
          )}
        >
          <PiggyBank className="size-3" />
          <HandCoins className="size-3" />
          <Repeat className="size-3" />
          <Settings className="size-3" />
        </div>
        {fniProps?.showLabel && <span className="text-[11px]">Finance</span>}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 8 }}
              transition={{
                type: "spring",
                damping: 22,
                stiffness: 380,
                mass: 0.8,
              }}
              style={{ transformOrigin: "100% 100%" }}
              className="absolute bottom-full right-0 z-50 mb-3 w-52 overflow-hidden rounded-2xl border bg-background/90 shadow-2xl backdrop-blur-xl"
            >
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Finance
                </p>
              </div>
              <div className="p-1.5 flex flex-col gap-0.5">
                {FOLDER_LINKS.map((link, i) => {
                  const Icon = link.icon;
                  const active = location.pathname.startsWith(link.to);
                  return (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.045, duration: 0.18 }}
                    >
                      <Link
                        to={link.to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.18, duration: 0.15 }}
                  className="my-1 mx-2 h-px bg-border"
                />
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.18 }}
                >
                  <Link
                    to="/settings"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      location.pathname.startsWith("/settings")
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Settings className="size-4 shrink-0" />
                    Settings
                  </Link>
                </motion.div>
              </div>

              <div className="mx-3 mb-2.5 mt-1 border-t pt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                  {!isOnline ? (
                    <WifiOff className="size-3 shrink-0" />
                  ) : isSyncing ? (
                    <RefreshCw className="size-3 shrink-0 animate-spin" />
                  ) : (
                    <Wifi className="size-3 shrink-0" />
                  )}
                  <span className="truncate">
                    {!isOnline
                      ? "Offline"
                      : isSyncing
                        ? "Syncing…"
                        : lastSyncTime
                          ? `Synced ${(() => {
                              const mins = Math.floor(
                                (Date.now() - lastSyncTime.getTime()) / 60000,
                              );
                              if (mins < 1) return "just now";
                              if (mins < 60) return `${mins}m ago`;
                              const h = Math.floor(mins / 60);
                              return h < 24
                                ? `${h}h ago`
                                : `${Math.floor(h / 24)}d ago`;
                            })()}`
                          : "Never synced"}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={sync}
                    disabled={isSyncing || !isOnline}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                    aria-label="Sync now"
                  >
                    <RefreshCw
                      className={cn("size-3.5", isSyncing && "animate-spin")}
                    />
                  </button>
                  {canInstall && (
                    <button
                      onClick={install}
                      className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="Install app"
                    >
                      <Download className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MobileFooterNavOld() {
  const isMobile = useIsMobile();
  const keyboardVisible = useKeyboardVisible();
  const location = useLocation();
  const { data: settings } = useSettings();
  const enabled = settings?.mobile_footer_enabled ?? true;
  const showLabels = settings?.mobile_footer_labels ?? true;

  const preferredAction = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/budgets")) return "budget";
    if (path.startsWith("/accounts")) return "account";
    if (
      path.startsWith("/transactions") ||
      path.startsWith("/recurring") ||
      path.startsWith("/debts")
    ) {
      return "expense";
    }
    return "expense";
  }, [location.pathname]);

  const orderedActions = useMemo(() => {
    return [...ACTIONS].sort((a, b) => {
      if (a.id === preferredAction) return -1;
      if (b.id === preferredAction) return 1;
      return 0;
    });
  }, [preferredAction]);

  if (!isMobile || !enabled || keyboardVisible) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 pb-4 z-40 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="grid grid-cols-5 items-center gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        <FooterNavItem {...FOOTER_ITEMS[0]} showLabel={showLabels} />
        <FooterNavItem {...FOOTER_ITEMS[1]} showLabel={showLabels} />

        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="mx-auto size-12 rounded-full shadow-lg"
              aria-label="Quick actions"
            >
              <Plus className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            <SheetHeader>
              <SheetTitle>Quick actions</SheetTitle>
              <SheetDescription>
                Start a new transaction or add supporting data.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-2 px-4 pb-4">
              {orderedActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <SheetClose key={action.id} asChild>
                    <Button
                      asChild
                      variant="ghost"
                      className="justify-center gap-3 border border-muted"
                    >
                      <Link to={action.to}>
                        <ActionIcon className="size-4" />
                        {action.label}
                      </Link>
                    </Button>
                  </SheetClose>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>

        <FooterNavItem {...FOOTER_ITEMS[2]} showLabel={showLabels} />
        <FolderNavItem />
      </div>
    </nav>
  );
}
