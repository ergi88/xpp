import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sheet, type SheetRef } from "react-modal-sheet";
import { clamp, motion, useTransform } from "motion/react";
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
import { Button } from "@/components/ui/button";
import {
  Sheet as ShadSheet,
  SheetContent,
  SheetDescription,
  SheetHeader as ShadSheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/hooks";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import {
  useNavConfig,
  NAV_ITEM_REGISTRY,
  type NavItemId,
} from "@/hooks/use-nav-config";
import { useSafeAreaInsets } from "@/hooks/use-safe-area-insets";
import { cn } from "@/lib/utils";

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
  { id: "budget", label: "New budget", to: "/budgets/create", icon: PiggyBank },
  {
    id: "account",
    label: "New account",
    to: "/accounts/create",
    icon: CreditCard,
  },
  { id: "debt", label: "New debt", to: "/debts/create", icon: HandCoins },
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
    const handleResize = () =>
      setVisible(window.innerHeight - viewport.height > 120);
    handleResize();
    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, []);
  return visible;
}

function SyncRow() {
  const { isOnline, isSyncing, lastSyncTime, sync } = useSyncStatus();
  const { canInstall, install } = usePWAInstall();

  const syncLabel = !isOnline
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
            return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
          })()}`
        : "Never synced";

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <div className="flex items-center gap-1 min-w-0">
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
        <button
          onClick={sync}
          disabled={isSyncing || !isOnline}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors shrink-0"
          aria-label="Sync now"
        >
          <RefreshCw className={cn("size-3.5", isSyncing && "animate-spin")} />
        </button>
        {canInstall && (
          <button
            onClick={install}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Install app"
          >
            <Download className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function NavLinkItem({
  id,
  showLabels,
}: {
  id: NavItemId;
  showLabels: boolean;
}) {
  const item = NAV_ITEM_REGISTRY[id];
  const Icon = item.icon;
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <button
      type="button"
      onClick={() => navigate(item.to)}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-xs transition-colors",
        isActive ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      {showLabels && <span className="text-[11px]">{item.label}</span>}
    </button>
  );
}

function PoolItem({ id }: { id: NavItemId }) {
  const item = NAV_ITEM_REGISTRY[id];
  const Icon = item.icon;
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = item.end
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <button
      type="button"
      onClick={() => navigate(item.to)}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs text-muted-foreground transition-colors",
        isActive && "text-primary bg-primary/5",
      )}
    >
      <Icon className="size-5" />
      <span className="text-[11px]">{item.label}</span>
    </button>
  );
}

/**
 * Footer pinned to the bottom of the viewport that slides up as the sheet
 * is dragged up — mirrors the SheetFooter pattern in the react-modal-sheet
 * "Scrollable + snap points" example.
 */
function NavFooter({
  sheetRef,
  navHeight,
  children,
}: {
  sheetRef: SheetRef;
  navHeight: number;
  children: React.ReactNode;
}) {
  const footerY = useTransform(() => {
    const y = sheetRef.yInverted.get();
    return clamp(0, navHeight, navHeight - y);
  });

  return (
    <motion.div
      // style={{ y: footerY, height: navHeight }}
      className="absolute bottom-0 left-0 right-0 z-3 flex items-center justify-center bg-background pointer-events-auto pb-4"
    >
      {children}
    </motion.div>
  );
}

export function MobileFooterNavSimple() {
  const isMobile = useIsMobile();
  const keyboardVisible = useKeyboardVisible();
  const location = useLocation();
  const { data: settings } = useSettings();
  const enabled = settings?.mobile_footer_enabled ?? true;
  const showLabels = settings?.mobile_footer_labels ?? true;
  const { mainNav, pool } = useNavConfig();
  console.log("🚀 ~ MobileFooterNavSimple ~ pool:", { pool });

  const insets = useSafeAreaInsets();
  const navHeight = 90 + insets.bottom;

  // Snap points: smallest (just the nav row) → fully open (full viewport).
  // initialSnap = 0 → start at nav-only height.
  const snapPoints = useMemo(() => [0, navHeight, 1], [navHeight]);
  const initialSnap = 1;
  const lastSnap = snapPoints.length - 1;

  const [sheetRef, setSheetRef] = useState<SheetRef | null>(null);
  const handleSheetRef = useCallback(
    (ref: SheetRef | null) => {
      if (!sheetRef && ref) setSheetRef(ref);
    },
    [sheetRef],
  );

  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  // Long-press the center "+" to expand the sheet to full; short tap opens quick actions.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  function handleCenterPointerDown() {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      sheetRef?.snapTo(lastSnap);
    }, 300);
  }

  function handleCenterPointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  const preferredAction = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/budgets")) return "budget";
    if (path.startsWith("/accounts")) return "account";
    return "expense";
  }, [location.pathname]);

  const orderedActions = useMemo(
    () =>
      [...ACTIONS].sort((a, b) =>
        a.id === preferredAction ? -1 : b.id === preferredAction ? 1 : 0,
      ),
    [preferredAction],
  );

  // Collapse back to nav-only on route change
  useEffect(() => {
    sheetRef?.snapTo(1);
  }, [location.pathname, sheetRef]);

  if (!isMobile || !enabled || keyboardVisible) return null;

  return (
    <Sheet
      ref={handleSheetRef}
      isOpen={true}
      onClose={() => sheetRef?.snapTo(1)}
      snapPoints={snapPoints}
      initialSnap={initialSnap}
      detent="content"
      disableDismiss
      // disableScrollLocking
      style={{ zIndex: 40 }}
    >
      <Sheet.Container
        style={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
        className="bg-background! border-t"
      >
        <Sheet.Header>
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
        </Sheet.Header>

        <Sheet.Content
          // Allow scroll only at the upmost snap point (full open)
          disableScroll={(state) => state.currentSnap !== lastSnap}
          // Reserve room at the bottom so content isn't hidden behind the nav row
          scrollStyle={{ paddingBottom: navHeight }}
        >
          <SyncRow />
          {pool.length > 0 && (
            <div className="px-4">
              <div className="grid grid-cols-4 gap-1">
                {pool.map((id) => (
                  <PoolItem key={id} id={id} />
                ))}
              </div>
            </div>
          )}
        </Sheet.Content>
      </Sheet.Container>

      {/* Nav row — always visible, slides with the sheet */}
      {!!sheetRef && (
        <NavFooter sheetRef={sheetRef} navHeight={navHeight}>
          <div
            className="grid w-full grid-cols-5 items-center gap-1 px-2 pt-1"
            style={{ paddingBottom: insets.bottom }}
          >
            {mainNav.slice(0, 2).map((id) => (
              <NavLinkItem key={id} id={id} showLabels={showLabels} />
            ))}

            <Button
              size="icon"
              className="mx-auto size-12 rounded-full shadow-lg"
              aria-label="Quick actions"
              onPointerDown={handleCenterPointerDown}
              onPointerUp={handleCenterPointerUp}
              onPointerCancel={handleCenterPointerUp}
              onClick={() => {
                if (!isLongPress.current) setQuickActionsOpen(true);
              }}
            >
              <Plus className="size-5" />
            </Button>

            {mainNav.slice(2, 4).map((id) => (
              <NavLinkItem key={id} id={id} showLabels={showLabels} />
            ))}
          </div>

          <ShadSheet open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
            <SheetContent
              side="bottom"
              className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            >
              <ShadSheetHeader>
                <SheetTitle>Quick actions</SheetTitle>
                <SheetDescription>
                  Start a new transaction or add supporting data.
                </SheetDescription>
              </ShadSheetHeader>
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
        </NavFooter>
      )}
    </Sheet>
  );
}
