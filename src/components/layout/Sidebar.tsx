import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  Home,
  CreditCard,
  Settings,
  ChevronDown,
  Receipt,
  PiggyBank,
  BarChart3,
  HandCoins,
  Repeat,
  LucideIcon,
  Download,
} from "lucide-react";
import { SyncStatus } from "@/components/shared/SyncStatus";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { Logo } from "@/components/shared/Logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_VERSION } from "@/version";
interface MenuItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

const mainItems: MenuItem[] = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/transactions", icon: Receipt, label: "Transactions" },
  { to: "/budgets", icon: PiggyBank, label: "Budgets" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
  { to: "/accounts", icon: CreditCard, label: "Accounts" },
];

const transactionItems: MenuItem[] = [
  { to: "/recurring", icon: Repeat, label: "Recurring" },
  { to: "/debts", icon: HandCoins, label: "Debts" },
];

export function AppSidebar() {
  const location = useLocation();
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const { setOpenMobile } = useSidebar();
  const { canInstall, install } = usePWAInstall();

  // Close mobile sidebar when navigating to a new page
  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const isTransactionsSection =
    location.pathname.startsWith("/recurring") ||
    location.pathname.startsWith("/debts");

  useEffect(() => {
    if (isTransactionsSection) {
      setTransactionsOpen(true);
    }
  }, [isTransactionsSection]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo className="size-5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Finix</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Finance Tracker
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(({ to, icon: Icon, label }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(to)}
                    tooltip={label}
                  >
                    <NavLink to={to}>
                      <Icon />
                      <span>{label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Transactions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible
                open={transactionsOpen}
                onOpenChange={setTransactionsOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Transactions">
                      <Receipt />
                      <span>Transactions</span>
                      <ChevronDown
                        className={`ml-auto transition-transform duration-200 ${transactionsOpen ? "" : "-rotate-90"}`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {transactionItems.map(({ to, icon: Icon, label }) => (
                        <SidebarMenuSubItem key={to}>
                          <SidebarMenuSubButton asChild isActive={isActive(to)}>
                            <NavLink to={to}>
                              <Icon />
                              <span>{label}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings")}
                  tooltip="Settings"
                >
                  <NavLink to="/settings">
                    <Settings />
                    <span>Settings</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SyncStatus />

        {canInstall && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={install}
                tooltip="Install app"
                className="text-xs text-muted-foreground"
              >
                <Download />
                <span>Install app</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="sm"
                  className="text-xs text-muted-foreground justify-between"
                >
                  <span>Finix</span>
                  <span className="font-mono">{APP_VERSION}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-64">
                <DropdownMenuLabel>About Finix</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-2 text-sm text-muted-foreground">
                  <p>
                    Self-hosted personal finance tracker. Track expenses, manage
                    budgets, and take control of your money.
                  </p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
