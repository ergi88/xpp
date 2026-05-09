import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Home,
  PiggyBank,
  Plus,
  Receipt,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

const FOOTER_ITEMS = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/accounts", label: "Accounts", icon: CreditCard },
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

export function MobileFooterNav() {
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
                      className="justify-start gap-3"
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
        <FooterNavItem {...FOOTER_ITEMS[3]} showLabel={showLabels} />
      </div>
    </nav>
  );
}
