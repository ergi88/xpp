import { useState, useRef, useMemo, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Download,
  HandCoins,
  PiggyBank,
  Plus,
  RefreshCw,
  Repeat,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Sheet, type SheetRef } from "react-modal-sheet";
import { Button } from "@/components/ui/button";
import {
  Sheet as ShadSheet,
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
import { useNavConfig, NAV_ITEM_REGISTRY } from "@/hooks/use-nav-config";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { id: "expense",   label: "New expense",   to: "/transactions/create?type=expense",  icon: ArrowUpRight },
  { id: "income",    label: "New income",    to: "/transactions/create?type=income",   icon: ArrowDownLeft },
  { id: "transfer",  label: "Transfer",      to: "/transactions/create?type=transfer", icon: ArrowLeftRight },
  { id: "budget",    label: "New budget",    to: "/budgets/create",                    icon: PiggyBank },
  { id: "account",   label: "New account",   to: "/accounts/create",                   icon: CreditCard },
  { id: "debt",      label: "New debt",      to: "/debts/create",                      icon: HandCoins },
  { id: "recurring", label: "New recurring", to: "/recurring/create",                  icon: Repeat },
];

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!window.visualViewport) return;
    const viewport = window.visualViewport;
    const handleResize = () => setVisible(window.innerHeight - viewport.height > 120);
    handleResize();
    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, []);
  return visible;
}

function SyncFooter() {
  const { isOnline, isSyncing, lastSyncTime, sync } = useSyncStatus();
  const { canInstall, install } = usePWAInstall();

  const syncLabel = !isOnline
    ? "Offline"
    : isSyncing
    ? "Syncing…"
    : lastSyncTime
    ? `Synced ${(() => {
        const mins = Math.floor((Date.now() - lastSyncTime.getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const h = Math.floor(mins / 60);
        return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
      })()}`
    : "Never synced";

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 border-t">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
        {!isOnline ? (
          <WifiOff className="size-3 shrink-0" />
        ) : isSyncing ? (
          <RefreshCw className="size-3 shrink-0 animate-spin" />
        ) : (
          <Wifi className="size-3 shrink-0" />
        )}
        <span className="truncate">{syncLabel}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={sync}
          disabled={isSyncing || !isOnline}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          aria-label="Sync now"
        >
          <RefreshCw className={cn("size-3.5", isSyncing && "animate-spin")} />
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
  );
}

export function MobileFooterNav() {
  const isMobile = useIsMobile();
  const keyboardVisible = useKeyboardVisible();
  const location = useLocation();
  const { data: settings } = useSettings();
  const enabled = settings?.mobile_footer_enabled ?? true;
  const showLabels = settings?.mobile_footer_labels ?? true;
  const { mainNav, pool } = useNavConfig();

  const sheetRef = useRef<SheetRef | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [snapIndex, setSnapIndex] = useState(1);
  const isExpanded = snapIndex === 0;

  const COLLAPSED_HEIGHT = 76;
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const EXPANDED_HEIGHT = Math.round(windowHeight * 0.58);

  const preferredAction = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/budgets")) return "budget";
    if (path.startsWith("/accounts")) return "account";
    return "expense";
  }, [location.pathname]);

  const orderedActions = useMemo(
    () => [...ACTIONS].sort((a, b) => (a.id === preferredAction ? -1 : b.id === preferredAction ? 1 : 0)),
    [preferredAction]
  );

  useEffect(() => {
    sheetRef.current?.snapTo(1);
  }, [location.pathname]);

  if (!isMobile || !enabled || keyboardVisible) return null;

  return (
    <Sheet
      ref={sheetRef}
      isOpen={true}
      onClose={() => sheetRef.current?.snapTo(1)}
      snapPoints={[EXPANDED_HEIGHT, COLLAPSED_HEIGHT]}
      initialSnap={1}
      onSnap={setSnapIndex}
      style={{ zIndex: 40 }}
    >
      <Sheet.Container
        style={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
        className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-t"
      >
        <Sheet.Header disableDrag={false} />
        <Sheet.Content disableDrag={false} scrollRef={scrollRef} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {/* Main nav row — always visible */}
          <div className="grid grid-cols-5 items-center gap-1 px-2 pt-1 pb-2">
            {/* Left 2 nav items */}
            {mainNav.slice(0, 2).map((id) => {
              const item = NAV_ITEM_REGISTRY[id];
              const Icon = item.icon;
              return (
                <NavLink
                  key={id}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors",
                      isActive && "text-primary"
                    )
                  }
                  aria-label={item.label}
                >
                  <Icon className="size-5" />
                  {showLabels && <span className="text-[11px]">{item.label}</span>}
                </NavLink>
              );
            })}

            {/* Plus — always center col 3 */}
            <ShadSheet>
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
            </ShadSheet>

            {/* Right 2 nav items */}
            {mainNav.slice(2, 4).map((id) => {
              const item = NAV_ITEM_REGISTRY[id];
              const Icon = item.icon;
              return (
                <NavLink
                  key={id}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors",
                      isActive && "text-primary"
                    )
                  }
                  aria-label={item.label}
                >
                  <Icon className="size-5" />
                  {showLabels && <span className="text-[11px]">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div ref={scrollRef} className="flex flex-col overflow-y-auto">
              {pool.length > 0 && (
                <div className="px-4 pb-2">
                  <div className="grid grid-cols-4 gap-1">
                    {pool.map((id) => {
                      const item = NAV_ITEM_REGISTRY[id];
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={id}
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            cn(
                              "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs text-muted-foreground transition-colors",
                              isActive && "text-primary bg-primary/5"
                            )
                          }
                          aria-label={item.label}
                        >
                          <Icon className="size-5" />
                          <span className="text-[11px]">{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              )}
              <SyncFooter />
            </div>
          )}
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop
        onTap={() => sheetRef.current?.snapTo(1)}
        style={{ background: "transparent" }}
      />
    </Sheet>
  );
}
