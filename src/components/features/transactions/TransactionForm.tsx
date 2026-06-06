import { useForm, useWatch } from "react-hook-form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  ChevronRight,
  Clock,
  EyeOff,
  HandCoins,
  LayoutGrid,
  Plus,
  Tag as TagIcon,
  Tags,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { safeZodResolver } from "@/lib/zod-resolver";
import { cn } from "@/lib/utils";
import {
  transactionSchema,
  TransactionFormValues,
} from "@/schemas/transactions";
import { useAccounts, useCategories, useTags, useDebts } from "@/hooks";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AccountSelect } from "@/components/shared/AccountSelect";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { TemplateShortcuts } from "@/components/features/transactions/TemplateShortcuts";
import type { TransactionTemplate } from "@/types";
import { FormWrapper } from "@/components/shared/FormWrapper";
import { AmountText } from "@/components/shared/AmountText";
import { StickyFooterActions } from "@/components/shared/StickyFooterActions";
import {
  BottomSheet,
  type BottomSheetItem,
} from "@/components/ui/bottom-sheet";

export interface PendingDebt {
  name: string;
  debtType: "i_owe" | "owed_to_me";
}

type TxType = TransactionFormValues["type"];

const TYPE_META: Record<
  TxType,
  { label: string; icon: typeof ArrowDownLeft; tint: TypeTint; sign: string }
> = {
  income: { label: "Income", icon: ArrowDownLeft, tint: "emerald", sign: "+" },
  expense: { label: "Expense", icon: ArrowUpRight, tint: "rose", sign: "−" },
  transfer: { label: "Transfer", icon: ArrowLeftRight, tint: "sky", sign: "" },
};

type TypeTint = "emerald" | "rose" | "sky";

const TINT_CLASSES: Record<
  TypeTint,
  {
    text: string;
    bg: string;
    border: string;
    solid: string;
    shadow: string;
  }
> = {
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    solid: "bg-emerald-500 hover:bg-emerald-500/90",
    shadow: "shadow-emerald-500/30",
  },
  rose: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    solid: "bg-rose-500 hover:bg-rose-500/90",
    shadow: "shadow-rose-500/30",
  },
  sky: {
    text: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    solid: "bg-sky-500 hover:bg-sky-500/90",
    shadow: "shadow-sky-500/30",
  },
};

function todayIso() {
  return new Date().toISOString().split("T")[0];
}
function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function GlassField({
  label,
  icon: Icon,
  iconClassName,
  children,
  accessory,
}: {
  label: string;
  icon?: typeof ArrowDownLeft;
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
      {children}
    </div>
  );
}

function OptionTile({
  label,
  sub,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  sub?: string;
  icon: typeof ArrowDownLeft;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-2xl border p-3 text-left backdrop-blur-xl transition disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-border bg-card/40 hover:border-muted-foreground/30",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <Icon
          className={cn(
            "size-4",
            active ? "text-emerald-500" : "text-muted-foreground",
          )}
        />
        <div
          className={cn(
            "flex size-4 items-center justify-center rounded-full border-2 transition",
            active
              ? "border-emerald-500 bg-emerald-500"
              : "border-muted-foreground/40",
          )}
        >
          {active && (
            <svg viewBox="0 0 10 10" className="size-2.5">
              <path
                d="M2 5l2 2 4-4"
                fill="none"
                stroke="white"
                strokeWidth="2"
              />
            </svg>
          )}
        </div>
      </div>
      <div className="text-xs font-semibold leading-tight">{label}</div>
      {sub && (
        <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          {sub}
        </div>
      )}
    </button>
  );
}

interface TransactionFormProps {
  defaultValues?: Partial<TransactionFormValues>;
  onSubmit: (
    data: TransactionFormValues,
    pendingDebt?: PendingDebt | null,
  ) => void;
  onTypeChange?: (type: TxType) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function TransactionForm({
  defaultValues,
  onSubmit,
  onTypeChange,
  isSubmitting,
  submitLabel = "Save",
}: TransactionFormProps) {
  const { data: accounts } = useAccounts({
    active: true,
    exclude_debts: true,
  });
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data: debts } = useDebts();

  const [pickerMode, setPickerMode] = useState<"category" | "debt">(
    defaultValues?.debt_id ? "debt" : "category",
  );
  const [createDebtOpen, setCreateDebtOpen] = useState(false);
  const [newDebtName, setNewDebtName] = useState("");
  const [pendingDebt, setPendingDebt] = useState<PendingDebt | null>(null);

  const [debtSheetOpen, setDebtSheetOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
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

  const formDefaults = useMemo(() => {
    return {
      type: defaultValues?.type ?? ("expense" as const),
      account_id: defaultValues?.account_id ?? "",
      to_account_id: defaultValues?.to_account_id ?? null,
      category_id: defaultValues?.category_id ?? null,
      amount: defaultValues?.amount ?? undefined,
      to_amount: defaultValues?.to_amount ?? undefined,
      description: defaultValues?.description ?? "",
      date: defaultValues?.date || todayIso(),
      tag_ids: defaultValues?.tag_ids ?? [],
      is_excluded: defaultValues?.is_excluded ?? false,
      is_one_time: defaultValues?.is_one_time ?? false,
      debt_id: defaultValues?.debt_id ?? null,
    };
  }, [defaultValues]);

  const form = useForm<TransactionFormValues>({
    resolver: safeZodResolver<TransactionFormValues>(transactionSchema),
    defaultValues: formDefaults,
  });

  // Reset only when defaultValues meaningfully change (e.g. edit data loaded).
  // `type` is excluded from the signature: the form owns it after mount.
  const externalDefaultsKey = useMemo(() => {
    if (!defaultValues) return "";
    const { type: _omit, ...rest } = defaultValues;
    return JSON.stringify(rest);
  }, [defaultValues]);

  useEffect(() => {
    form.reset(formDefaults);
    setRawAmount(
      formDefaults.amount != null ? String(formDefaults.amount) : "",
    );
    setPickerMode(formDefaults.debt_id ? "debt" : "category");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalDefaultsKey]);

  const transactionType = useWatch({ control: form.control, name: "type" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const categoryId = useWatch({ control: form.control, name: "category_id" });
  const debtId = useWatch({ control: form.control, name: "debt_id" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const toAccountId = useWatch({
    control: form.control,
    name: "to_account_id",
  });
  const toAmount = useWatch({ control: form.control, name: "to_amount" });
  const dateValue = useWatch({ control: form.control, name: "date" });
  const selectedTagIds =
    useWatch({ control: form.control, name: "tag_ids" }) ?? [];

  const filteredCategories = useMemo(() => {
    return (categories?.filter((c) => c.type === transactionType) ?? []).sort(
      (a, b) => (b.transactionsCount ?? 0) - (a.transactionsCount ?? 0),
    );
  }, [categories, transactionType]);

  useEffect(() => {
    if (!accountId && accounts && accounts.length > 0) {
      form.setValue("account_id", accounts[0].id);
    }
  }, [accountId, accounts, form]);

  useEffect(() => {
    if (
      !categoryId &&
      transactionType !== "transfer" &&
      pickerMode === "category" &&
      filteredCategories.length > 0
    ) {
      form.setValue("category_id", filteredCategories[0].id);
    }
  }, [categoryId, transactionType, filteredCategories, pickerMode, form]);

  const selectedAccount = accounts?.find((a) => a.id === accountId);
  const selectedToAccount = accounts?.find((a) => a.id === toAccountId);

  const balancePreview = useMemo(() => {
    if (!selectedAccount) return null;
    const currentBalance = selectedAccount.currentBalance;
    const txAmount = Number(amount) || 0;
    let newBalance = currentBalance;
    if (transactionType === "income") newBalance = currentBalance + txAmount;
    else if (transactionType === "expense" || transactionType === "transfer")
      newBalance = currentBalance - txAmount;
    const insufficientFunds =
      (transactionType === "expense" || transactionType === "transfer") &&
      newBalance < 0;
    return {
      currentBalance,
      newBalance,
      insufficientFunds,
      currency: selectedAccount.currency?.symbol ?? "",
      decimals: selectedAccount.currency?.decimals ?? 2,
    };
  }, [selectedAccount, amount, transactionType]);

  const toBalancePreview = useMemo(() => {
    if (!selectedToAccount || transactionType !== "transfer") return null;
    const currentBalance = selectedToAccount.currentBalance;
    const txAmount = Number(toAmount) || Number(amount) || 0;
    return {
      currentBalance,
      newBalance: currentBalance + txAmount,
      currency: selectedToAccount.currency?.symbol ?? "",
      decimals: selectedToAccount.currency?.decimals ?? 2,
    };
  }, [selectedToAccount, toAmount, amount, transactionType]);

  // Infer debt type from transaction type:
  // income → i_owe (received money → owe it back)
  // expense → owed_to_me (paid for someone → they owe me)
  const inferredDebtType: PendingDebt["debtType"] =
    transactionType === "income" ? "i_owe" : "owed_to_me";

  const compatibleDebts = useMemo(() => {
    return (debts ?? []).filter((d) => {
      if (!selectedAccount?.currency?.id) return true;
      return d.currencyId === selectedAccount.currency.id;
    });
  }, [debts, selectedAccount]);

  const selectedDebt = compatibleDebts.find((d) => d.id === debtId);

  const handleConfirmNewDebt = () => {
    if (!newDebtName.trim()) return;
    const debt: PendingDebt = {
      name: newDebtName.trim(),
      debtType: inferredDebtType,
    };
    setPendingDebt(debt);
    // Sentinel value — truthy so it passes "must have category or debt" check,
    // but stripped before the actual API call.
    form.setValue("debt_id", "__new_debt__");
    form.setValue("description", debt.name);
    setCreateDebtOpen(false);
    setNewDebtName("");
  };

  const clearPendingDebt = () => {
    setPendingDebt(null);
    form.setValue("debt_id", null);
  };

  const applyTemplate = useCallback(
    (t: TransactionTemplate) => {
      const current = form.getValues();

      // Validation guardrail: only apply fields whose referenced entity still
      // exists, so a deleted account/category/tag never lands in the form.
      const accountExists = accounts?.some((a) => a.id === t.accountId);
      const toAccountExists =
        t.toAccountId && accounts?.some((a) => a.id === t.toAccountId);
      const categoryValid =
        t.categoryId &&
        categories?.some((c) => c.id === t.categoryId && c.type === t.type);
      const validTagIds = (t.tagIds ?? []).filter((id) =>
        tags?.some((tag) => tag.id === id),
      );

      const nextAmount = t.amount != null ? t.amount : current.amount;

      form.reset({
        type: t.type,
        account_id: accountExists ? t.accountId : current.account_id,
        to_account_id:
          t.type === "transfer" && toAccountExists ? t.toAccountId! : null,
        category_id:
          t.type !== "transfer" && categoryValid ? t.categoryId! : null,
        amount: nextAmount,
        to_amount: null,
        exchange_rate: null,
        description: t.description ?? current.description,
        date: current.date,
        tag_ids: validTagIds,
        is_excluded: current.is_excluded,
        is_one_time: current.is_one_time,
        debt_id: null,
      });

      setRawAmount(nextAmount != null ? String(nextAmount) : "");
      setPickerMode("category");
      setPendingDebt(null);
      onTypeChange?.(t.type);
      toast.success(`Applied "${t.name}"`);
    },
    [accounts, categories, tags, form, onTypeChange],
  );

  const handleFormSubmit = (data: TransactionFormValues) => {
    const submitData =
      pickerMode === "debt" ? { ...data, category_id: null } : data;
    if (pendingDebt) {
      onSubmit({ ...submitData, debt_id: null }, pendingDebt);
    } else {
      onSubmit(submitData, null);
    }
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

  const meta = TYPE_META[transactionType];
  const tint = TINT_CLASSES[meta.tint];
  const sign = meta.sign;

  // Date chips
  const isToday = dateValue === todayIso();
  const isYesterday = dateValue === yesterdayIso();

  // Debt sheet items
  const debtItems: BottomSheetItem[] = compatibleDebts.map((d) => ({
    id: d.id,
    label: d.name,
    description: d.debtTypeLabel,
    iconNode:
      d.debtType === "i_owe" ? (
        <Banknote className="size-4 text-rose-500" />
      ) : (
        <HandCoins className="size-4 text-emerald-500" />
      ),
    right: (
      <AmountText
        value={d.remainingDebt}
        decimals={d.currency?.decimals ?? 2}
        currency={d.currency?.symbol}
      />
    ),
  }));

  // Tag sheet items
  const tagItems: BottomSheetItem[] = (tags ?? []).map((t) => ({
    id: t.id,
    label: t.name,
    iconNode: <TagIcon className="size-4 text-muted-foreground" />,
  }));

  const isValid = (Number(amount) || 0) > 0;

  return (
    <FormWrapper>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit, handleInvalid)}
          className="space-y-3 pb-28"
        >
          {/* Type tabs */}
          <div className="sticky -top-4 z-10 -mx-2 px-2 pt-2">
            <div className="relative flex gap-1 rounded-2xl border border-border bg-card/80 p-1 backdrop-blur-xl">
              {(Object.entries(TYPE_META) as [TxType, typeof meta][]).map(
                ([key, m]) => {
                  const Icon = m.icon;
                  const tc = TINT_CLASSES[m.tint];
                  const active = transactionType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const current = form.getValues();
                        form.reset({
                          type: key,
                          account_id: current.account_id,
                          amount: current.amount,
                          description: current.description,
                          date: current.date,
                          tag_ids: current.tag_ids,
                          is_excluded: current.is_excluded,
                          is_one_time: current.is_one_time,
                          to_account_id: null,
                          category_id: null,
                          to_amount: null,
                          exchange_rate: null,
                          debt_id: null,
                        });
                        setPickerMode("category");
                        setPendingDebt(null);
                        onTypeChange?.(key);
                      }}
                      className={cn(
                        "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="type-tab-bg"
                          className={cn(
                            "absolute inset-0 rounded-xl border",
                            tc.bg,
                            tc.border,
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
                          active && tc.text,
                        )}
                      />
                      <span className="relative z-10">{m.label}</span>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Template shortcuts */}
          <TemplateShortcuts type={transactionType} onPick={applyTemplate} />

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
                        {meta.label.toUpperCase()} AMOUNT
                      </span>
                    </div>
                    {transactionType === "transfer" &&
                      selectedAccount &&
                      selectedToAccount && (
                        <div className="truncate text-[10px] text-muted-foreground">
                          {selectedAccount.name} → {selectedToAccount.name}
                        </div>
                      )}
                  </div>

                  <div className="flex items-baseline justify-center gap-1.5">
                    {sign && (
                      <motion.span
                        key={sign}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn("text-6xl font-light", tint.text)}
                      >
                        {sign}
                      </motion.span>
                    )}
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
                        tint.text,
                      )}
                    >
                      {selectedAccount?.currency?.symbol ?? ""}
                    </span>
                  </div>

                  {balancePreview && (
                    <div className="mt-5 border-t border-border/60 pt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {transactionType === "transfer"
                            ? "From balance"
                            : "Balance after"}
                        </span>
                        <div className="flex items-center gap-1.5 font-medium tabular-nums">
                          {transactionType === "transfer" && (
                            <>
                              <span className="text-muted-foreground">
                                {balancePreview.currentBalance.toFixed(
                                  balancePreview.decimals,
                                )}
                              </span>
                              <ArrowRight className="size-3 text-muted-foreground" />
                            </>
                          )}
                          <span
                            className={cn(
                              balancePreview.insufficientFunds
                                ? "text-destructive"
                                : (Number(amount) || 0) > 0
                                  ? tint.text
                                  : "text-foreground",
                            )}
                          >
                            {balancePreview.newBalance.toFixed(
                              balancePreview.decimals,
                            )}{" "}
                            {balancePreview.currency}
                          </span>
                        </div>
                      </div>
                      {toBalancePreview && (
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            To balance
                          </span>
                          <div className="flex items-center gap-1.5 font-medium tabular-nums">
                            <span className="text-muted-foreground">
                              {toBalancePreview.currentBalance.toFixed(
                                toBalancePreview.decimals,
                              )}
                            </span>
                            <ArrowRight className="size-3 text-muted-foreground" />
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {toBalancePreview.newBalance.toFixed(
                                toBalancePreview.decimals,
                              )}{" "}
                              {toBalancePreview.currency}
                            </span>
                          </div>
                        </div>
                      )}
                      {balancePreview.insufficientFunds && (
                        <div className="mt-2 text-right text-[11px] font-medium text-destructive">
                          Insufficient funds
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Accounts */}
          {transactionType === "transfer" ? (
            <>
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <GlassField
                      label="From account"
                      icon={Wallet}
                      iconClassName="text-emerald-500"
                    >
                      <AccountSelect
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </GlassField>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
              <FormField
                key="to_account_id"
                control={form.control}
                name="to_account_id"
                render={({ field }) => (
                  <FormItem>
                    <GlassField
                      label="To account"
                      icon={Wallet}
                      iconClassName="text-sky-500"
                    >
                      <AccountSelect
                        value={field.value}
                        onChange={field.onChange}
                        excludeId={accountId}
                      />
                    </GlassField>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
              <FormField
                key="to_amount"
                control={form.control}
                name="to_amount"
                render={({ field }) => (
                  <FormItem>
                    <GlassField
                      label="Receive amount"
                      icon={ArrowDownLeft}
                      iconClassName="text-emerald-500"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-light text-emerald-500">
                          +
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder={amount ? String(amount) : "0.00"}
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                          className="h-auto flex-1 border-0 bg-transparent p-0 text-2xl font-light tabular-nums shadow-none focus-visible:ring-0"
                        />
                        <span className="text-base text-muted-foreground">
                          {selectedToAccount?.currency?.symbol ?? ""}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Leave empty to auto-fill from send amount
                      </p>
                    </GlassField>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <GlassField
                    label="Account"
                    icon={Wallet}
                    iconClassName="text-emerald-500"
                  >
                    <AccountSelect
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </GlassField>
                  <FormMessage className="mt-2" />
                </FormItem>
              )}
            />
          )}

          {/* Category / Debt switcher */}
          {transactionType !== "transfer" && (
            <GlassField
              label={pickerMode === "category" ? "Category" : "Debt"}
              icon={pickerMode === "category" ? Tags : HandCoins}
              iconClassName={
                pickerMode === "category"
                  ? "text-violet-500"
                  : "text-emerald-500"
              }
            >
              <div className="relative mb-3 flex gap-1 rounded-xl border border-border bg-background/40 p-1">
                {[
                  { id: "category", label: "Category", icon: LayoutGrid },
                  { id: "debt", label: "Debt", icon: HandCoins },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = pickerMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const next = opt.id as "category" | "debt";
                        setPickerMode(next);
                        if (next === "category") {
                          form.setValue("debt_id", null);
                          setPendingDebt(null);
                        } else {
                          form.setValue("category_id", null);
                        }
                      }}
                      className={cn(
                        "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="cat-mode-bg"
                          className="absolute inset-0 rounded-lg border border-border bg-accent"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                      <Icon className="relative z-10 size-3" />
                      <span className="relative z-10">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {pickerMode === "category" ? (
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <CategorySelect
                        value={field.value}
                        onChange={field.onChange}
                        type={transactionType as "income" | "expense"}
                      />
                      <FormMessage className="mt-2" />
                    </FormItem>
                  )}
                />
              ) : pendingDebt ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10">
                      {pendingDebt.debtType === "i_owe" ? (
                        <Banknote className="size-4 text-rose-500" />
                      ) : (
                        <HandCoins className="size-4 text-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        New: {pendingDebt.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {pendingDebt.debtType === "i_owe"
                          ? "I owe"
                          : "Owed to me"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearPendingDebt}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Clear pending debt"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="debt_id"
                  render={() => (
                    <FormItem>
                      <button
                        type="button"
                        onClick={() => setDebtSheetOpen(true)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5 text-left transition hover:bg-accent/40"
                      >
                        {selectedDebt ? (
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10">
                              {selectedDebt.debtType === "i_owe" ? (
                                <Banknote className="size-4 text-rose-500" />
                              ) : (
                                <HandCoins className="size-4 text-emerald-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">
                                {selectedDebt.name}
                              </div>
                              <div className="text-[11px] tabular-nums text-muted-foreground">
                                <AmountText
                                  value={selectedDebt.remainingDebt}
                                  decimals={
                                    selectedDebt.currency?.decimals ?? 2
                                  }
                                  currency={selectedDebt.currency?.symbol}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Pick a debt or create new
                          </span>
                        )}
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                      <FormMessage className="mt-2" />
                    </FormItem>
                  )}
                />
              )}
            </GlassField>
          )}

          {/* Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label="Date"
                  icon={Calendar}
                  iconClassName="text-sky-500"
                  accessory={
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => field.onChange(todayIso())}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                          isToday
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange(yesterdayIso())}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                          isYesterday
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Yesterday
                      </button>
                    </div>
                  }
                >
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value || ""}
                      className="h-9 border-0 w-full bg-transparent text-sm font-semibold shadow-none focus-visible:ring-0"
                    />
                  </FormControl>
                  <FormMessage className="mt-2" />
                </GlassField>
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
                      placeholder="What was this for?"
                      {...field}
                      rows={4}
                      className="resize-none border-0 text-sm shadow-none focus-visible:ring-0"
                    />
                  </FormControl>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Tags */}
          {tags && tags.length > 0 && (
            <FormField
              control={form.control}
              name="tag_ids"
              render={({ field }) => {
                const ids = field.value ?? [];
                return (
                  <FormItem>
                    <GlassField
                      label={`Tags${ids.length > 0 ? ` · ${ids.length}` : ""}`}
                      icon={TagIcon}
                      iconClassName="text-violet-500"
                    >
                      {ids.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => setTagSheetOpen(true)}
                          className="flex w-full items-center justify-between gap-2 text-left text-sm text-muted-foreground transition hover:text-foreground"
                        >
                          <span>Add tags…</span>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </button>
                      ) : (
                        <div>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {ids.map((id) => {
                              const tag = tags.find((t) => t.id === id);
                              if (!tag) return null;
                              return (
                                <motion.span
                                  key={tag.id}
                                  layout
                                  initial={{ scale: 0.9, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-600 dark:text-violet-400"
                                >
                                  #{tag.name}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      field.onChange(
                                        ids.filter((x) => x !== tag.id),
                                      )
                                    }
                                    className="hover:text-foreground"
                                    aria-label={`Remove ${tag.name}`}
                                  >
                                    <X className="size-3" />
                                  </button>
                                </motion.span>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => setTagSheetOpen(true)}
                            className="flex w-full h-5 justify-center border border-muted-foreground/30 rounded-md p-3  items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
                          >
                            <Plus className="size-3" />
                            Add more
                          </button>
                        </div>
                      )}
                    </GlassField>
                    <FormMessage className="mt-2" />
                  </FormItem>
                );
              }}
            />
          )}

          {/* Flags */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <FormField
              control={form.control}
              name="is_excluded"
              render={({ field }) => {
                const isOneTime = form.watch("is_one_time");
                return (
                  <OptionTile
                    label="Exclude from reports"
                    sub="Hidden from aggregates"
                    icon={EyeOff}
                    active={!!field.value}
                    disabled={!!isOneTime}
                    onClick={() => field.onChange(!field.value)}
                  />
                );
              }}
            />
            <FormField
              control={form.control}
              name="is_one_time"
              render={({ field }) => {
                const isExcluded = form.watch("is_excluded");
                return (
                  <OptionTile
                    label="One-time"
                    sub="Skipped from averages"
                    icon={Clock}
                    active={!!field.value}
                    disabled={!!isExcluded}
                    onClick={() => field.onChange(!field.value)}
                  />
                );
              }}
            />
          </div>

          {/* Sticky submit (hero color) */}
          <StickyFooterActions className="bg-unset">
            <Button
              type="submit"
              disabled={
                isSubmitting || balancePreview?.insufficientFunds || !isValid
              }
              className={cn(
                "h-10 w-full rounded-xl font-semibold shadow-lg transition",
                isValid && !balancePreview?.insufficientFunds
                  ? cn(tint.solid, tint.shadow, "text-white")
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Plus className="size-5" />
              {isSubmitting ? "Saving…" : submitLabel}
              {isValid && !balancePreview?.insufficientFunds && (
                <span className="ml-1 text-sm font-normal tabular-nums opacity-80">
                  · {sign}
                  {amount} {selectedAccount?.currency?.symbol ?? ""}
                </span>
              )}
            </Button>
          </StickyFooterActions>
        </form>
      </Form>

      {/* Debt picker sheet */}
      <BottomSheet
        open={debtSheetOpen}
        onClose={() => setDebtSheetOpen(false)}
        title="Choose debt"
        items={debtItems}
        layout="list"
        selectedId={debtId}
        onSelect={(id) => {
          form.setValue("debt_id", id);
          const sel = compatibleDebts.find((d) => d.id === id);
          if (sel) form.setValue("description", sel.name);
        }}
        onCreate={() => setCreateDebtOpen(true)}
        createLabel="Create new debt"
        emptyMessage="No compatible debts"
      />

      {/* Tag picker sheet */}
      <BottomSheet
        open={tagSheetOpen}
        onClose={() => setTagSheetOpen(false)}
        title="Choose tags"
        items={tagItems}
        layout="grid"
        searchable={tagItems.length > 6}
        multi
        selectedIds={selectedTagIds}
        onSelectMulti={(ids) => form.setValue("tag_ids", ids)}
        emptyMessage="No tags yet"
      />

      {/* Create new debt dialog */}
      <Dialog open={createDebtOpen} onOpenChange={setCreateDebtOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new debt</DialogTitle>
            <DialogDescription>
              {transactionType === "income"
                ? "Income → 'I owe' debt. This transaction will be the origin (money you received that you'll pay back)."
                : "Expense → 'Owed to me' debt. This transaction will be the origin (money you paid that someone will repay)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="new-debt-name">Debt name</Label>
            <Input
              id="new-debt-name"
              value={newDebtName}
              onChange={(e) => setNewDebtName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmNewDebt()}
              placeholder="e.g. Loan from John"
              autoFocus
            />
            <p className="pt-1 text-xs text-muted-foreground">
              Amount and currency will be taken from this transaction.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreateDebtOpen(false);
                setNewDebtName("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!newDebtName.trim()}
              onClick={handleConfirmNewDebt}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormWrapper>
  );
}
