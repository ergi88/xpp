import * as LucideIcons from "lucide-react";
import {
  Bitcoin,
  CreditCard,
  HandCoins,
  Landmark,
  LucideIcon,
  Wallet,
} from "lucide-react";
import type { AccountType } from "@/types";
import { ACCOUNT_TYPE_CONFIG } from "@/constants";

// Default lucide icon per account type, used when an account has no custom icon.
const DEFAULT_TYPE_ICON: Record<AccountType, LucideIcon> = {
  bank: Landmark,
  cash: Wallet,
  crypto: Bitcoin,
  credit: CreditCard,
  debt: HandCoins,
};

export function getAccountIconComponent(
  type: AccountType,
  icon?: string | null,
): LucideIcon {
  if (icon && icon in LucideIcons) {
    return (LucideIcons as Record<string, unknown>)[icon] as LucideIcon;
  }
  return DEFAULT_TYPE_ICON[type] ?? Wallet;
}

interface AccountIconProps {
  type: AccountType;
  icon?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}

/**
 * Renders an account's icon. Falls back to the per-type default icon when no
 * custom icon is set, and to the type's tint colour when no custom colour is set.
 */
export function AccountIcon({
  type,
  icon,
  color,
  size = 16,
  className,
}: AccountIconProps) {
  const Icon = getAccountIconComponent(type, icon);
  return (
    <Icon size={size} className={className} color={getAccountColor(type, color)} />
  );
}

/**
 * Resolves an account's tint colour: the custom colour if set, otherwise the
 * per-type default colour. Always returns a hex string.
 */
export function getAccountColor(type: AccountType, color?: string | null): string {
  return color || ACCOUNT_TYPE_CONFIG[type]?.defaultColor || "#60a5fa";
}

/**
 * Inline styles to tint an account avatar (soft background + coloured icon),
 * using the custom colour when set or the per-type default otherwise.
 */
export function getAccountTint(type: AccountType, color?: string | null) {
  const resolved = getAccountColor(type, color);
  return {
    color: resolved,
    style: { backgroundColor: `${resolved}1a`, color: resolved },
  };
}
