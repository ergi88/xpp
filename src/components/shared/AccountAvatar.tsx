import { cn } from "@/lib/utils";
import { AccountIcon, getAccountTint } from "@/lib/account-icon";
import type { Account, AccountType } from "@/types";

const SIZE: Record<
  "sm" | "md" | "lg",
  { box: string; icon: number }
> = {
  sm: { box: "size-7 rounded-lg", icon: 14 },
  md: { box: "size-9 rounded-lg", icon: 16 },
  lg: { box: "size-11 rounded-xl", icon: 20 },
};

interface AccountAvatarProps {
  /** Pass a full account, or the discrete fields below. */
  account?: Pick<Account, "type" | "icon" | "color">;
  type?: AccountType;
  icon?: string | null;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Reusable account avatar: a tinted rounded box containing the account's icon.
 * Use anywhere accounts are rendered (lists, selects, headers) for consistency.
 * Falls back to the per-type default icon/colour when none are set.
 */
export function AccountAvatar({
  account,
  type,
  icon,
  color,
  size = "md",
  className,
}: AccountAvatarProps) {
  const resolvedType = account?.type ?? type ?? "bank";
  const resolvedIcon = account?.icon ?? icon;
  const resolvedColor = account?.color ?? color;

  const tint = getAccountTint(resolvedType, resolvedColor);
  const s = SIZE[size];

  return (
    <div
      className={cn("grid shrink-0 place-items-center", s.box, className)}
      style={tint.style}
    >
      <AccountIcon
        type={resolvedType}
        icon={resolvedIcon}
        color={resolvedColor}
        size={s.icon}
      />
    </div>
  );
}
