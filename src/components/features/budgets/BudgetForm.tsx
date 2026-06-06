import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Bell,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  Globe,
  Layers,
  Plus,
  Power,
  Tag as TagIcon,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { safeZodResolver } from "@/lib/zod-resolver";
import { cn } from "@/lib/utils";
import { budgetSchema, BudgetFormData } from "@/schemas";
import { useAccounts, useCategories, useCurrencies, useTags } from "@/hooks";
import { CategoryIcon } from "@/lib/category-icon";
import { useFABActions } from "@/lib/fab-context";
import { AccountAvatar } from "@/components/shared/AccountAvatar";
import { getAccountColor } from "@/lib/account-icon";

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
import { StickyFooterActions } from "@/components/shared/StickyFooterActions";
import {
  BottomSheet,
  type BottomSheetItem,
} from "@/components/ui/bottom-sheet";

type BudgetPeriod = BudgetFormData["period"];

interface BudgetFormProps {
  defaultValues?: Partial<BudgetFormData>;
  onSubmit: (data: BudgetFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const PERIOD_META: {
  id: BudgetPeriod;
  label: string;
  icon: typeof CalendarDays;
}[] = [
  { id: "weekly", label: "Weekly", icon: CalendarDays },
  { id: "monthly", label: "Monthly", icon: CalendarRange },
  { id: "yearly", label: "Yearly", icon: Calendar },
  { id: "one_time", label: "One-time", icon: CalendarClock },
];

const NOTIFY_PRESETS = [50, 75, 80, 90];

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

function ToggleRow({
  label,
  description,
  icon: Icon,
  active,
  activeTint,
  onClick,
}: {
  label: string;
  description: string;
  icon: typeof Globe;
  active: boolean;
  activeTint: "violet" | "emerald";
  onClick: () => void;
}) {
  const tint =
    activeTint === "violet"
      ? {
          bg: "bg-violet-500/10",
          border: "border-violet-500/30",
          text: "text-violet-500",
          solid: "bg-violet-500",
        }
      : {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/30",
          text: "text-emerald-500",
          solid: "bg-emerald-500",
        };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left backdrop-blur-xl transition",
        active
          ? cn(tint.bg, tint.border)
          : "border-border bg-card/40 hover:border-muted-foreground/30",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            active ? tint.bg : "bg-muted",
          )}
        >
          <Icon
            className={cn(
              "size-4",
              active ? tint.text : "text-muted-foreground",
            )}
          />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-[11px] leading-snug text-muted-foreground">
            {description}
          </div>
        </div>
      </div>
      <div
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition",
          active ? tint.solid : "bg-muted",
        )}
      >
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 700, damping: 30 }}
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow",
            active ? "right-0.5" : "left-0.5",
          )}
        />
      </div>
    </button>
  );
}

export function BudgetForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: BudgetFormProps) {
  const { data: categories } = useCategories("expense");
  const { data: currencies } = useCurrencies();
  const { data: tags } = useTags();
  const { data: accounts } = useAccounts({ active: true, exclude_debts: true });
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

  const [catSheetOpen, setCatSheetOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [acctSheetOpen, setAcctSheetOpen] = useState(false);
  const [curSheetOpen, setCurSheetOpen] = useState(false);
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

  const form = useForm<BudgetFormData>({
    resolver: safeZodResolver<BudgetFormData>(budgetSchema),
    defaultValues: {
      name: "",
      amount: 0,
      currency_id: null,
      period: "monthly",
      start_date: null,
      end_date: null,
      is_global: false,
      notify_at_percent: null,
      is_active: true,
      category_ids: [],
      tag_ids: [],
      account_ids: [],
      ...defaultValues,
    },
  });

  const explicitCurrencyId = defaultValues?.currency_id ?? null;

  useEffect(() => {
    if (explicitCurrencyId) return;
    const base = currencies?.find((c) => c.isBase);
    if (base && !form.getValues("currency_id")) {
      form.setValue("currency_id", base.id);
    }
  }, [currencies, explicitCurrencyId, form]);

  const currencyId = useWatch({ control: form.control, name: "currency_id" });
  const period = useWatch({ control: form.control, name: "period" });
  const isGlobal = useWatch({ control: form.control, name: "is_global" });
  const isActive = useWatch({ control: form.control, name: "is_active" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const notifyAt = useWatch({
    control: form.control,
    name: "notify_at_percent",
  });
  const selectedCatIds =
    useWatch({ control: form.control, name: "category_ids" }) ?? [];
  const selectedTagIds =
    useWatch({ control: form.control, name: "tag_ids" }) ?? [];
  const selectedAcctIds =
    useWatch({ control: form.control, name: "account_ids" }) ?? [];

  const selectedCurrency = currencies?.find((c) => c.id === currencyId);
  const currencySymbol = selectedCurrency?.symbol ?? "";

  // Bottom-sheet items ----------------------------------------------------
  const categoryItems: BottomSheetItem[] = useMemo(
    () =>
      (categories ?? []).map((c) => ({
        id: c.id,
        label: c.name,
        color: c.color,
        iconNode: <CategoryIcon name={c.icon} color={c.color} size={22} />,
      })),
    [categories],
  );

  const tagItems: BottomSheetItem[] = useMemo(
    () =>
      (tags ?? []).map((t) => ({
        id: t.id,
        label: t.name,
        iconNode: <TagIcon className="size-4 text-muted-foreground" />,
      })),
    [tags],
  );

  const accountItems: BottomSheetItem[] = useMemo(
    () =>
      (accounts ?? []).map((a) => ({
        id: a.id,
        label: a.name,
        keywords: a.currency?.code,
        iconNode: <AccountAvatar account={a} size="sm" />,
      })),
    [accounts],
  );

  const currencyItems: BottomSheetItem[] = useMemo(
    () =>
      (currencies ?? []).map((c) => ({
        id: c.id,
        label: `${c.code} (${c.symbol})${c.isBase ? " · Base" : ""}`,
        keywords: c.name,
        iconNode: (
          <span className="text-sm font-semibold text-muted-foreground">
            {c.symbol}
          </span>
        ),
      })),
    [currencies],
  );

  const amountNum = Number(amount) || 0;
  const isValid =
    form.watch("name").trim().length >= 2 &&
    amountNum > 0 &&
    (isGlobal || selectedCatIds.length > 0);

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

  const periodSuffix =
    period === "one_time" ? "once" : period.replace("ly", "");

  return (
    <FormWrapper>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
          className="space-y-3 pb-28"
        >
          {/* Hero limit */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <div
                  onClick={focusAmount}
                  className="relative cursor-text overflow-hidden rounded-3xl border border-violet-500/30 bg-violet-500/10 p-6 transition"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-full flex border border-border bg-background/40 px-2.5 py-1 backdrop-blur">
                      <span className="text-[10px] font-semibold tracking-wider text-violet-600 dark:text-violet-400">
                        BUDGET LIMIT
                      </span>
                    </div>
                    <div className="text-[10px] capitalize text-muted-foreground">
                      {PERIOD_META.find((p) => p.id === period)?.label}
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
                        field.onChange(v === "" ? 0 : Number(v));
                      }}
                      className="bg-transparent text-center text-6xl font-light tabular-nums outline-none placeholder:text-muted-foreground/30"
                      style={{
                        width: `${Math.max(1, (rawAmount || "0").length + 0.5)}ch`,
                      }}
                    />
                    <span className="text-2xl font-light text-violet-600 opacity-70 dark:text-violet-400">
                      {currencySymbol}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
                    <span>
                      {isGlobal
                        ? "All expenses"
                        : `${selectedCatIds.length} categor${
                            selectedCatIds.length === 1 ? "y" : "ies"
                          }`}
                    </span>
                    <span>
                      {selectedAcctIds.length === 0
                        ? "All accounts"
                        : `${selectedAcctIds.length} account${
                            selectedAcctIds.length === 1 ? "" : "s"
                          }`}
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
                      placeholder="e.g. Food budget"
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
                        : "Base currency"}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Period segmented selector */}
          <FormField
            control={form.control}
            name="period"
            render={({ field }) => (
              <FormItem>
                <div className="grid grid-cols-4 gap-2">
                  {PERIOD_META.map((p) => {
                    const Icon = p.icon;
                    const active = field.value === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => field.onChange(p.id)}
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3 transition",
                          active
                            ? "border-violet-500/30 bg-violet-500/10"
                            : "border-border bg-card/40 hover:border-muted-foreground/30",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            active
                              ? "text-violet-600 dark:text-violet-400"
                              : "text-muted-foreground",
                          )}
                        />
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            active
                              ? "text-violet-600 dark:text-violet-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {p.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* One-time date range */}
          {period === "one_time" && (
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <GlassField
                      label="Start date"
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
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <GlassField
                      label="End date"
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
            </div>
          )}

          {/* Global budget toggle */}
          <FormField
            control={form.control}
            name="is_global"
            render={({ field }) => (
              <ToggleRow
                label="Global budget"
                description="Apply to all expenses, not specific categories"
                icon={Globe}
                active={!!field.value}
                activeTint="violet"
                onClick={() => field.onChange(!field.value)}
              />
            )}
          />

          {/* Categories — hidden when global */}
          <AnimatePresence initial={false}>
            {!isGlobal && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <FormField
                  control={form.control}
                  name="category_ids"
                  render={({ field }) => (
                    <FormItem>
                      <GlassField
                        label={`Categories${
                          selectedCatIds.length > 0
                            ? ` · ${selectedCatIds.length}`
                            : ""
                        }`}
                        icon={Layers}
                        iconClassName="text-violet-500"
                      >
                        {selectedCatIds.length > 0 && (
                          <div className="mb-2.5 flex flex-wrap gap-1.5">
                            {selectedCatIds.map((id) => {
                              const cat = categories?.find((c) => c.id === id);
                              if (!cat) return null;
                              return (
                                <motion.span
                                  key={cat.id}
                                  layout
                                  initial={{ scale: 0.9, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                                  style={{
                                    backgroundColor: `${cat.color}1a`,
                                    borderColor: `${cat.color}66`,
                                    color: cat.color,
                                  }}
                                >
                                  <CategoryIcon
                                    name={cat.icon}
                                    color={cat.color}
                                    size={12}
                                  />
                                  {cat.name}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      field.onChange(
                                        selectedCatIds.filter(
                                          (x) => x !== cat.id,
                                        ),
                                      )
                                    }
                                    aria-label={`Remove ${cat.name}`}
                                  >
                                    <X className="size-3" />
                                  </button>
                                </motion.span>
                              );
                            })}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setCatSheetOpen(true)}
                          className="flex w-full items-center justify-between gap-2 text-left text-sm text-muted-foreground transition hover:text-foreground"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="size-3.5" />
                            {selectedCatIds.length > 0
                              ? "Add or edit categories"
                              : "Choose categories"}
                          </span>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </button>
                      </GlassField>
                      <FormMessage className="mt-2" />
                    </FormItem>
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tags */}
          <FormField
            control={form.control}
            name="tag_ids"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label={`Tags${
                    selectedTagIds.length > 0
                      ? ` · ${selectedTagIds.length}`
                      : ""
                  }`}
                  sub="Only transactions with selected tags count toward this budget"
                  icon={TagIcon}
                  iconClassName="text-violet-500"
                >
                  {selectedTagIds.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setTagSheetOpen(true)}
                      className="flex w-full items-center justify-between gap-2 text-left text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      <span className="flex items-center gap-1.5">
                        <Plus className="size-3.5" />
                        Add tags (optional)
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  ) : (
                    <div>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {selectedTagIds.map((id) => {
                          const tag = tags?.find((t) => t.id === id);
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
                                    selectedTagIds.filter((x) => x !== tag.id),
                                  )
                                }
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
                        className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        <Plus className="size-3" /> Add more
                      </button>
                    </div>
                  )}
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Accounts (optional scoping) */}
          <FormField
            control={form.control}
            name="account_ids"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label={`Accounts${
                    selectedAcctIds.length > 0
                      ? ` · ${selectedAcctIds.length}`
                      : " · All"
                  }`}
                  sub="Limit this budget to specific accounts, or leave empty for all"
                  icon={Wallet}
                  iconClassName="text-emerald-500"
                >
                  {selectedAcctIds.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setAcctSheetOpen(true)}
                      className="flex w-full items-center justify-between gap-2 text-left text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      <span className="flex items-center gap-1.5">
                        <Globe className="size-3.5" />
                        All accounts
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  ) : (
                    <div>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {selectedAcctIds.map((id) => {
                          const acc = accounts?.find((a) => a.id === id);
                          if (!acc) return null;
                          const c = getAccountColor(acc.type, acc.color);
                          return (
                            <motion.span
                              key={acc.id}
                              layout
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                              style={{
                                backgroundColor: `${c}1a`,
                                borderColor: `${c}66`,
                                color: c,
                              }}
                            >
                              <AccountAvatar
                                account={acc}
                                size="sm"
                                className="size-3.5 rounded"
                              />
                              {acc.name}
                              <button
                                type="button"
                                onClick={() =>
                                  field.onChange(
                                    selectedAcctIds.filter((x) => x !== acc.id),
                                  )
                                }
                                aria-label={`Remove ${acc.name}`}
                              >
                                <X className="size-3" />
                              </button>
                            </motion.span>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAcctSheetOpen(true)}
                        className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        <Plus className="size-3" /> Edit accounts
                      </button>
                    </div>
                  )}
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Notify at % */}
          <FormField
            control={form.control}
            name="notify_at_percent"
            render={({ field }) => (
              <FormItem>
                <GlassField
                  label="Notify at %"
                  sub="Get notified when spending reaches this percentage"
                  icon={Bell}
                  iconClassName="text-amber-500"
                >
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="e.g. 80"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          let v = e.target.value.replace(/[^0-9]/g, "");
                          if (v && Number(v) > 100) v = "100";
                          field.onChange(v === "" ? null : Number(v));
                        }}
                        className="h-9 flex-1 border-0 bg-transparent p-0 text-base font-medium tabular-nums shadow-none focus-visible:ring-0"
                      />
                    </FormControl>
                    {notifyAt != null && (
                      <span className="text-base text-muted-foreground">%</span>
                    )}
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    {NOTIFY_PRESETS.map((p) => {
                      const active = notifyAt === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => field.onChange(p)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {p}%
                        </button>
                      );
                    })}
                  </div>
                </GlassField>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Active toggle */}
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <ToggleRow
                label="Active"
                description={
                  field.value
                    ? "Tracking spending now"
                    : "Paused — not tracking"
                }
                icon={Power}
                active={!!field.value}
                activeTint="emerald"
                onClick={() => field.onChange(!field.value)}
              />
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
                  ? "bg-violet-500 text-white shadow-violet-500/30 hover:bg-violet-500/90"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Plus className="size-5" />
              {isSubmitting ? "Saving…" : submitLabel}
              {isValid && (
                <span className="ml-1 text-sm font-normal tabular-nums opacity-80">
                  · {amountNum} {currencySymbol}/{periodSuffix}
                </span>
              )}
            </Button>
          </StickyFooterActions>
        </form>
      </Form>

      {/* Category picker sheet */}
      <BottomSheet
        open={catSheetOpen}
        onClose={() => setCatSheetOpen(false)}
        title="Choose categories"
        items={categoryItems}
        layout="grid"
        multi
        searchable={categoryItems.length > 8}
        selectedIds={selectedCatIds}
        onSelectMulti={(ids) => form.setValue("category_ids", ids)}
        emptyMessage="No categories available"
      />

      {/* Tag picker sheet */}
      <BottomSheet
        open={tagSheetOpen}
        onClose={() => setTagSheetOpen(false)}
        title="Choose tags"
        items={tagItems}
        layout="grid"
        multi
        searchable={tagItems.length > 8}
        selectedIds={selectedTagIds}
        onSelectMulti={(ids) => form.setValue("tag_ids", ids)}
        emptyMessage="No tags yet"
      />

      {/* Account picker sheet */}
      <BottomSheet
        open={acctSheetOpen}
        onClose={() => setAcctSheetOpen(false)}
        title="Limit to accounts"
        items={accountItems}
        layout="list"
        multi
        searchable={accountItems.length > 6}
        selectedIds={selectedAcctIds}
        onSelectMulti={(ids) => form.setValue("account_ids", ids)}
        emptyMessage="No accounts available"
      />

      {/* Currency picker sheet */}
      <BottomSheet
        open={curSheetOpen}
        onClose={() => setCurSheetOpen(false)}
        title="Currency"
        items={currencyItems}
        layout="list"
        searchable={currencyItems.length > 6}
        selectedId={currencyId ?? null}
        onSelect={(id) => form.setValue("currency_id", id)}
        emptyMessage="No currencies available"
      />
    </FormWrapper>
  );
}
