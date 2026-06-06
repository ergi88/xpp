import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { motion, AnimatePresence } from "motion/react";
import {
  Banknote,
  Calendar,
  ChevronRight,
  Globe,
  HandCoins,
  Link2,
  Plus,
  Tag as TagIcon,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { safeZodResolver } from "@/lib/zod-resolver";
import { cn } from "@/lib/utils";
import { toLocalDateString } from "@/lib/date";
import { debtSchema, DebtFormData } from "@/schemas";
import { useCurrencies, useAccounts } from "@/hooks";
import type { DebtType } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { AccountSelect } from "@/components/shared/AccountSelect";
import { FormWrapper } from "@/components/shared/FormWrapper";
import { StickyFooterActions } from "@/components/shared/StickyFooterActions";
import {
  BottomSheet,
  type BottomSheetItem,
} from "@/components/ui/bottom-sheet";

interface DebtFormProps {
  defaultValues?: Partial<DebtFormData>;
  onSubmit: (data: DebtFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  showOriginTransaction?: boolean;
}

const TYPE_META: Record<
  DebtType,
  {
    label: string;
    icon: typeof Banknote;
    text: string;
    bg: string;
    border: string;
    solid: string;
    shadow: string;
  }
> = {
  i_owe: {
    label: "I Owe",
    icon: Banknote,
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    solid: "bg-rose-500 hover:bg-rose-500/90",
    shadow: "shadow-rose-500/30",
  },
  owed_to_me: {
    label: "Owed to Me",
    icon: HandCoins,
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    solid: "bg-emerald-500 hover:bg-emerald-500/90",
    shadow: "shadow-emerald-500/30",
  },
};

function GlassField({
  label,
  sub,
  icon: Icon,
  iconClassName,
  children,
  accessory,
}: {
  label: string;
  sub?: string;
  icon?: typeof Wallet;
  iconClassName?: string;
  children: React.ReactNode;
  accessory?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          {Icon && <Icon className={cn("size-3", iconClassName)} />}
          {label.toUpperCase()}
        </div>
        {accessory}
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

export function DebtForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
  showOriginTransaction = false,
}: DebtFormProps) {
  const { data: currencies } = useCurrencies();
  useAccounts({ active: true, exclude_debts: true });

  const [curSheetOpen, setCurSheetOpen] = useState(false);
  const [createOriginTx, setCreateOriginTx] = useState(false);
  const [rawAmount, setRawAmount] = useState<string>(
    defaultValues?.amount != null ? String(defaultValues.amount) : "",
  );

  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const focusAmount = () => {
    const el = amountInputRef.current;
    if (!el) return;
    el.focus();
    try {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    } catch {
      /* noop */
    }
  };

  const form = useForm<DebtFormData>({
    resolver: safeZodResolver<DebtFormData>(debtSchema),
    defaultValues: {
      name: "",
      debt_type: "i_owe",
      currency_id: "",
      amount: undefined,
      due_date: "",
      counterparty: "",
      description: "",
      origin_account_id: undefined,
      origin_date: toLocalDateString(new Date()),
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

  const debtType = useWatch({ control: form.control, name: "debt_type" });
  const currencyId = useWatch({ control: form.control, name: "currency_id" });
  const amount = useWatch({ control: form.control, name: "amount" });

  const meta = TYPE_META[debtType];
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

  const handleOriginToggle = () => {
    setCreateOriginTx((prev) => {
      const next = !prev;
      if (!next) form.setValue("origin_account_id", undefined);
      return next;
    });
  };

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

  const amountNum = Number(amount) || 0;
  const isValid =
    form.watch("name").trim().length >= 1 && amountNum > 0 && !!currencyId;

  const originLabel =
    debtType === "i_owe"
      ? "Account that received the funds"
      : "Account that paid";
  const originSub =
    debtType === "i_owe"
      ? "Records an income transaction — money you received that created this debt"
      : "Records an expense transaction — money you paid that created this debt";

  return (
    <FormWrapper>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
          className="space-y-3 pb-28"
        >
          {/* Type tabs */}
          <FormField
            control={form.control}
            name="debt_type"
            render={({ field }) => (
              <FormItem>
                <div className="relative flex gap-1 rounded-2xl border border-border bg-card/80 p-1 backdrop-blur-xl">
                  {(Object.keys(TYPE_META) as DebtType[]).map((key) => {
                    const m = TYPE_META[key];
                    const Icon = m.icon;
                    const active = field.value === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => field.onChange(key)}
                        className={cn(
                          "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition",
                          active
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId="debt-type-tab-bg"
                            className={cn(
                              "absolute inset-0 rounded-xl border",
                              m.bg,
                              m.border,
                            )}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 30,
                            }}
                          />
                        )}
                        <Icon
                          className={cn(
                            "relative z-10 size-3.5",
                            active && m.text,
                          )}
                        />
                        <span className="relative z-10">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Hero amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <div
                  onClick={focusAmount}
                  className={cn(
                    "relative cursor-text overflow-hidden rounded-3xl border p-6 transition",
                    meta.bg,
                    meta.border,
                  )}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-full flex border border-border bg-background/40 px-2.5 py-1 backdrop-blur">
                      <span
                        className={cn(
                          "text-[10px] font-semibold tracking-wider",
                          meta.text,
                        )}
                      >
                        DEBT AMOUNT
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {meta.label}
                    </div>
                  </div>

                  <div className="flex items-baseline justify-center gap-1.5">
                    <input
                      ref={amountInputRef}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={rawAmount}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        const parts = v.split(".");
                        if (parts.length > 2) return;
                        if (parts[1] && parts[1].length > 2) return;
                        setRawAmount(v);
                        field.onChange(v === "" ? undefined : Number(v));
                      }}
                      className="bg-transparent text-center text-6xl font-light tabular-nums outline-none placeholder:text-muted-foreground/30"
                      style={{
                        width: `${Math.max(1, (rawAmount || "0").length + 0.5)}ch`,
                      }}
                    />
                    <span
                      className={cn(
                        "text-2xl font-light opacity-70",
                        meta.text,
                      )}
                    >
                      {currencySymbol}
                    </span>
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
                      placeholder="e.g. Car loan"
                      {...field}
                      className="h-9 border-0 bg-transparent p-0 text-base font-medium shadow-none focus-visible:ring-0"
                    />
                  </FormControl>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

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

          {/* Counterparty */}
          <FormField
            control={form.control}
            name="counterparty"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label="Counterparty"
                  sub="Who you owe to or who owes you"
                  icon={User}
                  iconClassName="text-amber-500"
                >
                  <FormControl>
                    <Input
                      placeholder="John Doe / Bank name"
                      {...field}
                      className="h-9 border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0"
                    />
                  </FormControl>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Due date */}
          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label="Due date"
                  sub="Optional deadline for the debt"
                  icon={Calendar}
                  iconClassName="text-sky-500"
                >
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value || ""}
                      className="h-9 w-full border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                    />
                  </FormControl>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <GlassField label="Description">
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this debt…"
                      {...field}
                      rows={3}
                      className="resize-none border-0 text-sm shadow-none focus-visible:ring-0"
                    />
                  </FormControl>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Origin transaction */}
          {showOriginTransaction && (
            <GlassField
              label="Origin transaction"
              sub={
                debtType === "i_owe"
                  ? "Record the income that created this debt"
                  : "Record the expense that created this debt"
              }
              icon={Link2}
              iconClassName="text-violet-500"
              accessory={
                <button
                  type="button"
                  onClick={handleOriginToggle}
                  className={cn(
                    "relative h-6 w-10 shrink-0 rounded-full transition",
                    createOriginTx ? meta.solid : "bg-muted",
                  )}
                  aria-pressed={createOriginTx}
                >
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 700, damping: 30 }}
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow",
                      createOriginTx ? "right-0.5" : "left-0.5",
                    )}
                  />
                </button>
              }
            >
              <AnimatePresence initial={false}>
                {createOriginTx && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <FormField
                      control={form.control}
                      name="origin_account_id"
                      render={({ field }) => (
                        <FormItem>
                          <div className="mb-1.5 text-[11px] text-muted-foreground">
                            {originLabel} — {originSub}
                          </div>
                          <AccountSelect
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select account"
                          />
                          <FormMessage className="mt-2" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="origin_date"
                      render={({ field }) => (
                        <FormItem>
                          <div className="mb-1.5 text-[11px] text-muted-foreground">
                            Transaction date
                          </div>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value || ""}
                              className="h-9 rounded-xl border border-border bg-card/40 text-sm font-semibold"
                            />
                          </FormControl>
                          <FormMessage className="mt-2" />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassField>
          )}

          {/* Sticky submit */}
          <StickyFooterActions className="bg-unset">
            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              className={cn(
                "h-10 w-full rounded-xl font-semibold shadow-lg transition",
                isValid
                  ? cn(meta.solid, meta.shadow, "text-white")
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Plus className="size-5" />
              {isSubmitting ? "Saving…" : submitLabel}
              {isValid && (
                <span className="ml-1 text-sm font-normal tabular-nums opacity-80">
                  · {amountNum} {currencySymbol}
                </span>
              )}
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
