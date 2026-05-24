import { useState, useEffect, useCallback, useRef } from "react";
import {
  Home, Receipt, CreditCard, PiggyBank,
  HandCoins, Repeat, BarChart3, Settings as SettingsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSettings } from "@/hooks";
import { settingsApi } from "@/api";

export type NavItemId =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "budgets"
  | "debts"
  | "recurring"
  | "reports"
  | "settings";

export interface NavItemConfig {
  id: NavItemId;
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
}

export const NAV_ITEM_REGISTRY: Record<NavItemId, NavItemConfig> = {
  dashboard:    { id: "dashboard",    label: "Dashboard",    icon: Home,          to: "/",              end: true },
  transactions: { id: "transactions", label: "Transactions", icon: Receipt,       to: "/transactions" },
  accounts:     { id: "accounts",     label: "Accounts",     icon: CreditCard,    to: "/accounts" },
  budgets:      { id: "budgets",      label: "Budgets",      icon: PiggyBank,     to: "/budgets" },
  debts:        { id: "debts",        label: "Debts",        icon: HandCoins,     to: "/debts" },
  recurring:    { id: "recurring",    label: "Recurring",    icon: Repeat,        to: "/recurring" },
  reports:      { id: "reports",      label: "Reports",      icon: BarChart3,     to: "/reports" },
  settings:     { id: "settings",     label: "Settings",     icon: SettingsIcon,  to: "/settings" },
};

export const ALL_NAV_IDS: NavItemId[] = [
  "dashboard", "transactions", "accounts", "budgets",
  "debts", "recurring", "reports", "settings",
];

export const DEFAULT_MAIN_NAV: NavItemId[] = [
  "dashboard", "transactions", "accounts", "budgets",
];

const LS_KEY = "xpp:nav-config";

export function parseNavConfig(raw: string | undefined): NavItemId[] {
  try {
    if (!raw) return DEFAULT_MAIN_NAV;
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length < 1 ||
      parsed.length > 4 ||
      new Set(parsed).size !== parsed.length ||
      !parsed.every((id) => ALL_NAV_IDS.includes(id as NavItemId))
    ) {
      return DEFAULT_MAIN_NAV;
    }
    return parsed as NavItemId[];
  } catch {
    return DEFAULT_MAIN_NAV;
  }
}

export function useNavConfig() {
  const { data: settings } = useSettings();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mainNav, setMainNavState] = useState<NavItemId[]>(() =>
    parseNavConfig(localStorage.getItem(LS_KEY) ?? undefined)
  );

  useEffect(() => {
    if (!settings?.mobile_nav_config) return;
    const serverNav = parseNavConfig(settings.mobile_nav_config);
    setMainNavState((prev) => {
      if (prev.join(",") === serverNav.join(",")) return prev;
      localStorage.setItem(LS_KEY, JSON.stringify(serverNav));
      return serverNav;
    });
  }, [settings?.mobile_nav_config]);

  const setMainNav = useCallback((items: NavItemId[]) => {
    setMainNavState(items);
    localStorage.setItem(LS_KEY, JSON.stringify(items));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      settingsApi.update({ mobile_nav_config: JSON.stringify(items) }).catch(() => {});
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const pool = ALL_NAV_IDS.filter((id) => !mainNav.includes(id));

  return { mainNav, pool, setMainNav };
}
