import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  Globe,
  Hash,
  Palette,
  Power,
  Sparkles,
  Tag as TagIcon,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { safeZodResolver } from "@/lib/zod-resolver";
import { cn } from "@/lib/utils";
import { accountSchema, AccountFormData } from "@/schemas";
import { useCurrencies } from "@/hooks";
import {
  ACCOUNT_ICON_OPTIONS,
  CATEGORY_COLORS,
  REGULAR_ACCOUNT_TYPE_CONFIG,
  REGULAR_ACCOUNT_TYPES,
} from "@/constants";
import type { RegularAccountType } from "@/types";
import { useFABActions } from "@/lib/fab-context";
import { getAccountColor, getAccountIconComponent } from "@/lib/account-icon";
import { AccountAvatar } from "@/components/shared/AccountAvatar";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { FormWrapper } from "@/components/shared/FormWrapper";
import { StickyFooterActions } from "@/components/shared";
import {
  BottomSheet,
  type BottomSheetItem,
} from "@/components/ui/bottom-sheet";

interface AccountFormProps {
  defaultValues?: Partial<AccountFormData>;
  onSubmit: (data: AccountFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const TYPE_TINT: Record<
  RegularAccountType,
  { text: string; bg: string; border: string; solid: string; shadow: string }
> = {
  bank: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    solid: "bg-blue-500 hover:bg-blue-500/90",
    shadow: "shadow-blue-500/30",
  },
  cash: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    solid: "bg-emerald-500 hover:bg-emerald-500/90",
    shadow: "shadow-emerald-500/30",
  },
  crypto: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    solid: "bg-amber-500 hover:bg-amber-500/90",
    shadow: "shadow-amber-500/30",
  },
  credit: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    solid: "bg-rose-500 hover:bg-rose-500/90",
    shadow: "shadow-rose-500/30",
  },
};

function GlassField({
  label,
  sub,
  icon: Icon,
  iconClassName,
  children,
}: {
  label: string;
  sub?: string;
  icon?: typeof Wallet;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
        {Icon && <Icon className={cn("size-3", iconClassName)} />}
        {label.toUpperCase()}
      </div>
      {sub && (
        <p className="-mt-1 mb-2 text-[11px] leading-snug text-muted-foreground">
          {sub}
        </p>
      )}
      {children}
    </div>
  );
}

export function AccountForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: AccountFormProps) {
  const { data: currencies } = useCurrencies();
  const navigate = useNavigate();

  useFABActions(
    [
      {
        id: "back",
        label: "Go back",
        icon: ArrowLeft,
        onClick: () => navigate(-1),
      },
    ],
    [],
  );

  const [curSheetOpen, setCurSheetOpen] = useState(false);
  const [rawBalance, setRawBalance] = useState<string>(
    defaultValues?.initial_balance != null
      ? String(defaultValues.initial_balance)
      : "",
  );

  const balanceInputRef = useRef<HTMLInputElement | null>(null);
  const focusBalance = () => {
    const el = balanceInputRef.current;
    if (!el) return;
    el.focus();
    try {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    } catch {
      /* noop */
    }
  };

  const form = useForm<AccountFormData>({
    resolver: safeZodResolver<AccountFormData>(accountSchema),
    defaultValues: {
      name: "",
      type: "bank",
      currency_id: "",
      initial_balance: 0,
      is_active: true,
      card_last_digits: null,
      card_expiry: null,
      credit_limit: null,
      icon: null,
      color: null,
      ...defaultValues,
    },
  });

  const explicitCurrencyId = defaultValues?.currency_id ?? "";

  useEffect(() => {
    if (explicitCurrencyId) return;
    const base = currencies?.find((c) => c.isBase);
    if (base && !form.getValues("currency_id")) {
      form.setValue("currency_id", base.id);
    }
  }, [currencies, explicitCurrencyId, form]);

  const accountType = useWatch({ control: form.control, name: "type" });
  const currencyId = useWatch({ control: form.control, name: "currency_id" });
  const name = useWatch({ control: form.control, name: "name" });
  const icon = useWatch({ control: form.control, name: "icon" });
  const color = useWatch({ control: form.control, name: "color" });
  const previewColor = getAccountColor(
    accountType as RegularAccountType,
    color,
  );

  const showCardFields = accountType === "bank" || accountType === "credit";
  const isCredit = accountType === "credit";

  const tint = TYPE_TINT[accountType as RegularAccountType] ?? TYPE_TINT.bank;
  const selectedCurrency = currencies?.find((c) => c.id === currencyId);
  const currencySymbol = selectedCurrency?.symbol ?? "";

  const currencyItems: BottomSheetItem[] = useMemo(
    () =>
      (currencies ?? []).map((c) => ({
        id: c.id,
        label: `${c.code} (${c.symbol})${c.isBase ? " · Base" : ""}`,
        description: c.name,
        keywords: c.name,
        iconNode: (
          <span className="text-sm font-semibold text-muted-foreground">
            {c.symbol}
          </span>
        ),
      })),
    [currencies],
  );

  const handleInvalid = (errors: Record<string, { message?: string }>) => {
    const messages = Object.entries(errors)
      .map(([field, err]) => err?.message ?? `${field} is invalid`)
      .filter(Boolean);
    if (messages.length > 0) {
      toast.error(messages[0], {
        description:
          messages.length > 1
            ? `+${messages.length - 1} more issue(s)`
            : undefined,
      });
    }
  };

  const isValid = (name ?? "").trim().length >= 1 && !!currencyId;

  return (
    <FormWrapper>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
          className="space-y-3 pb-28"
        >
          {/* Type segmented selector */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <div className="grid grid-cols-4 gap-2">
                  {REGULAR_ACCOUNT_TYPES.map((type) => {
                    const config =
                      REGULAR_ACCOUNT_TYPE_CONFIG[type as RegularAccountType];
                    const Icon = config.icon;
                    const tc = TYPE_TINT[type as RegularAccountType];
                    const active = field.value === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => field.onChange(type)}
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3 transition",
                          active
                            ? cn(tc.bg, tc.border)
                            : "border-border bg-card/40 hover:border-muted-foreground/30",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            active ? tc.text : "text-muted-foreground",
                          )}
                        />
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            active ? tc.text : "text-muted-foreground",
                          )}
                        >
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Hero balance */}
          <FormField
            control={form.control}
            name="initial_balance"
            render={({ field }) => (
              <FormItem>
                <div
                  onClick={focusBalance}
                  className={cn(
                    "relative cursor-text overflow-hidden rounded-3xl border p-6 transition",
                    tint.bg,
                    tint.border,
                  )}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-full flex border border-border bg-background/40 px-2.5 py-1 backdrop-blur">
                      <span
                        className={cn(
                          "text-[10px] font-semibold tracking-wider",
                          tint.text,
                        )}
                      >
                        {isCredit ? "BALANCE OWED" : "INITIAL BALANCE"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-center gap-1.5">
                    <input
                      ref={balanceInputRef}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={rawBalance}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        const parts = v.split(".");
                        if (parts.length > 2) return;
                        if (parts[1] && parts[1].length > 2) return;
                        setRawBalance(v);
                        field.onChange(v === "" ? 0 : Number(v));
                      }}
                      className="bg-transparent text-center text-6xl font-light tabular-nums outline-none placeholder:text-muted-foreground/30"
                      style={{
                        width: `${Math.max(1, (rawBalance || "0").length + 0.5)}ch`,
                      }}
                    />
                    <span
                      className={cn(
                        "text-2xl font-light opacity-70",
                        tint.text,
                      )}
                    >
                      {currencySymbol}
                    </span>
                  </div>

                  <div className="mt-5 border-t border-border/60 pt-4 text-center text-[11px] text-muted-foreground">
                    {isCredit
                      ? "Amount already owed on this card (0 if starting fresh)"
                      : "Starting balance for this account"}
                  </div>
                </div>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label="Name"
                  icon={TagIcon}
                  iconClassName="text-violet-500"
                >
                  <FormControl>
                    <Input
                      placeholder="e.g. My checking account"
                      {...field}
                      className="h-9 border-0 bg-transparent p-0 text-base font-medium shadow-none focus-visible:ring-0"
                    />
                  </FormControl>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Appearance: icon + colour (optional, falls back to type defaults) */}
          <GlassField
            label="Appearance"
            sub="Pick an icon and colour, or leave on Auto to use the default for this type"
            icon={Palette}
            iconClassName="text-fuchsia-500"
          >
            {/* Live preview */}
            <div className="mb-3 flex items-center gap-3">
              <AccountAvatar
                type={accountType as RegularAccountType}
                icon={icon}
                color={color}
                size="lg"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {name || "Account name"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {icon
                    ? icon
                    : `Auto · default ${
                        REGULAR_ACCOUNT_TYPE_CONFIG[
                          accountType as RegularAccountType
                        ]?.label ?? ""
                      } icon`}
                </div>
              </div>
            </div>

            {/* Icon choices */}
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => field.onChange(null)}
                      title="Auto (default for type)"
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition",
                        !field.value
                          ? cn(tint.bg, tint.border, tint.text)
                          : "border-border text-muted-foreground hover:border-muted-foreground/40",
                      )}
                    >
                      <Sparkles className="size-3.5" />
                      Auto
                    </button>
                    {ACCOUNT_ICON_OPTIONS.map((iconName) => {
                      const Icon = getAccountIconComponent(
                        accountType as RegularAccountType,
                        iconName,
                      );
                      const selected = field.value === iconName;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          title={iconName}
                          onClick={() => field.onChange(iconName)}
                          className={cn(
                            "grid size-8 place-items-center rounded-md border transition",
                            selected
                              ? "border-2"
                              : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/50",
                          )}
                          style={
                            selected
                              ? {
                                  borderColor: previewColor,
                                  backgroundColor: `${previewColor}1a`,
                                  color: previewColor,
                                }
                              : undefined
                          }
                        >
                          <Icon className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                </FormItem>
              )}
            />

            {/* Colour choices */}
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => field.onChange(null)}
                      title="Auto (default for type)"
                      className={cn(
                        "grid size-7 place-items-center rounded-full border text-muted-foreground transition",
                        !field.value
                          ? "border-foreground"
                          : "border-border hover:border-muted-foreground/40",
                      )}
                    >
                      <Sparkles className="size-3.5" />
                    </button>
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => field.onChange(c)}
                        aria-label={`Select color ${c}`}
                        className={cn(
                          "size-7 rounded-full border-2 transition-transform",
                          field.value === c
                            ? "border-foreground scale-110"
                            : "border-transparent",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <FormMessage className="mt-2" />
                </FormItem>
              )}
            />
          </GlassField>

          {/* Currency */}
          <FormField
            control={form.control}
            name="currency_id"
            render={() => (
              <FormItem>
                <GlassField
                  label="Currency"
                  icon={Globe}
                  iconClassName="text-sky-500"
                >
                  <button
                    type="button"
                    onClick={() => setCurSheetOpen(true)}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <span className="text-sm font-semibold">
                      {selectedCurrency
                        ? `${selectedCurrency.code} (${selectedCurrency.symbol})`
                        : "Select currency"}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Credit limit */}
          {isCredit && (
            <FormField
              control={form.control}
              name="credit_limit"
              render={({ field }) => (
                <FormItem>
                  <GlassField
                    label="Credit limit"
                    sub="Maximum credit available on this card"
                    icon={CreditCard}
                    iconClassName="text-rose-500"
                  >
                    <div className="flex items-baseline gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                        className="h-9 flex-1 border-0 bg-transparent p-0 text-2xl font-light tabular-nums shadow-none focus-visible:ring-0"
                      />
                      <span className="text-base text-muted-foreground">
                        {currencySymbol}
                      </span>
                    </div>
                  </GlassField>
                  <FormMessage className="mt-2" />
                </FormItem>
              )}
            />
          )}

          {/* Card details */}
          {showCardFields && (
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="card_last_digits"
                render={({ field }) => (
                  <FormItem>
                    <GlassField
                      label="Last 4 digits"
                      icon={Hash}
                      iconClassName="text-muted-foreground"
                    >
                      <FormControl>
                        <Input
                          placeholder="1234"
                          maxLength={4}
                          inputMode="numeric"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "");
                            field.onChange(v || null);
                          }}
                          className="h-9 border-0 bg-transparent p-0 text-lg font-semibold tabular-nums shadow-none focus-visible:ring-0"
                        />
                      </FormControl>
                    </GlassField>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="card_expiry"
                render={({ field }) => (
                  <FormItem>
                    <GlassField
                      label="Expiry"
                      icon={CreditCard}
                      iconClassName="text-muted-foreground"
                    >
                      <FormControl>
                        <Input
                          placeholder="MM/YY"
                          maxLength={5}
                          inputMode="numeric"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            let v = e.target.value.replace(/\D/g, "");
                            if (v.length >= 3)
                              v = v.slice(0, 2) + "/" + v.slice(2, 4);
                            field.onChange(v || null);
                          }}
                          className="h-9 border-0 bg-transparent p-0 text-lg font-semibold tabular-nums shadow-none focus-visible:ring-0"
                        />
                      </FormControl>
                    </GlassField>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Active toggle */}
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left backdrop-blur-xl transition",
                  field.value
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-border bg-card/40 hover:border-muted-foreground/30",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
                      field.value ? "bg-emerald-500/10" : "bg-muted",
                    )}
                  >
                    <Power
                      className={cn(
                        "size-4",
                        field.value
                          ? "text-emerald-500"
                          : "text-muted-foreground",
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Active</div>
                    <div className="text-[11px] leading-snug text-muted-foreground">
                      {field.value
                        ? "Visible in lists and totals"
                        : "Hidden from lists"}
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "relative h-6 w-10 shrink-0 rounded-full transition",
                    field.value ? "bg-emerald-500" : "bg-muted",
                  )}
                >
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 700, damping: 30 }}
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow",
                      field.value ? "right-0.5" : "left-0.5",
                    )}
                  />
                </div>
              </button>
            )}
          />

          {/* Sticky submit */}
          <StickyFooterActions className="bg-unset">
            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              className={cn(
                "h-10 w-full rounded-xl font-semibold shadow-lg transition",
                isValid
                  ? cn(tint.solid, tint.shadow, "text-white")
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isSubmitting ? "Saving…" : submitLabel}
            </Button>
          </StickyFooterActions>
        </form>
      </Form>

      {/* Currency picker sheet */}
      <BottomSheet
        open={curSheetOpen}
        onClose={() => setCurSheetOpen(false)}
        title="Select currency"
        items={currencyItems}
        layout="list"
        searchable={currencyItems.length > 6}
        selectedId={currencyId || null}
        onSelect={(id) => form.setValue("currency_id", id)}
        emptyMessage="No currencies available"
      />
    </FormWrapper>
  );
}
