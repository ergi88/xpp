import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { motion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  Plus,
  Tag as TagIcon,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { safeZodResolver } from "@/lib/zod-resolver";
import { cn } from "@/lib/utils";
import { templateSchema, TemplateFormData } from "@/schemas";
import { useAccounts, useCategories, useTags } from "@/hooks";

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
import { CategorySelect } from "@/components/shared/CategorySelect";
import { FormWrapper } from "@/components/shared/FormWrapper";
import { StickyFooterActions } from "@/components/shared/StickyFooterActions";
import {
  BottomSheet,
  type BottomSheetItem,
} from "@/components/ui/bottom-sheet";

interface TemplateFormProps {
  defaultValues?: Partial<TemplateFormData>;
  onSubmit: (data: TemplateFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

type TemplateType = TemplateFormData["type"];
type TypeTint = "emerald" | "rose" | "sky";

const TYPE_META: Record<
  TemplateType,
  { label: string; icon: typeof ArrowDownLeft; tint: TypeTint; sign: string }
> = {
  income: { label: "Income", icon: ArrowDownLeft, tint: "emerald", sign: "+" },
  expense: { label: "Expense", icon: ArrowUpRight, tint: "rose", sign: "−" },
  transfer: { label: "Transfer", icon: ArrowLeftRight, tint: "sky", sign: "" },
};

const TINT_CLASSES: Record<
  TypeTint,
  { text: string; bg: string; border: string; solid: string; shadow: string }
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
      {sub && (
        <p className="-mt-1 mb-2 text-[11px] leading-snug text-muted-foreground">
          {sub}
        </p>
      )}
      {children}
    </div>
  );
}

export function TemplateForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: TemplateFormProps) {
  const { data: accounts } = useAccounts({ active: true, exclude_debts: true });
  const { data: categories } = useCategories();
  const { data: tags } = useTags();

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

  const formDefaults = useMemo(
    () => ({
      name: "",
      icon: "",
      type: "expense" as const,
      account_id: "",
      to_account_id: null,
      category_id: null,
      amount: null,
      description: "",
      tag_ids: [],
      ...defaultValues,
    }),
    [defaultValues],
  );

  const form = useForm<TemplateFormData>({
    resolver: safeZodResolver<TemplateFormData>(templateSchema),
    defaultValues: formDefaults,
  });

  useEffect(() => {
    form.reset(formDefaults);
    setRawAmount(
      formDefaults.amount != null ? String(formDefaults.amount) : "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDefaults]);

  const type = useWatch({ control: form.control, name: "type" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const toAccountId = useWatch({
    control: form.control,
    name: "to_account_id",
  });
  const amount = useWatch({ control: form.control, name: "amount" });
  const icon = useWatch({ control: form.control, name: "icon" });
  const selectedTagIds =
    useWatch({ control: form.control, name: "tag_ids" }) ?? [];

  const isTransfer = type === "transfer";
  const meta = TYPE_META[type];
  const tint = TINT_CLASSES[meta.tint];
  const sign = meta.sign;

  const selectedAccount = accounts?.find((a) => a.id === accountId);
  const selectedToAccount = accounts?.find((a) => a.id === toAccountId);

  const filteredCategories = useMemo(
    () =>
      (categories?.filter((c) => c.type === type) ?? []).sort(
        (a, b) => (b.transactionsCount ?? 0) - (a.transactionsCount ?? 0),
      ),
    [categories, type],
  );

  // Auto-select first account
  useEffect(() => {
    if (!accountId && accounts && accounts.length > 0) {
      form.setValue("account_id", accounts[0].id);
    }
  }, [accountId, accounts, form]);

  // Auto-select most popular category
  useEffect(() => {
    const currentCategoryId = form.getValues("category_id");
    if (
      !currentCategoryId &&
      type !== "transfer" &&
      filteredCategories.length > 0
    ) {
      form.setValue("category_id", filteredCategories[0].id);
    }
  }, [type, filteredCategories, form]);

  const tagItems: BottomSheetItem[] = (tags ?? []).map((t) => ({
    id: t.id,
    label: t.name,
    iconNode: <TagIcon className="size-4 text-muted-foreground" />,
  }));

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

  return (
    <FormWrapper>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, handleInvalid)}
          className="space-y-3 pb-28"
        >
          {/* Type tabs */}
          <div className="sticky -top-4 z-10 -mx-2 px-2 pt-2">
            <div className="relative flex gap-1 rounded-2xl border border-border bg-card/80 p-1 backdrop-blur-xl">
              {(Object.entries(TYPE_META) as [TemplateType, typeof meta][]).map(
                ([key, m]) => {
                  const Icon = m.icon;
                  const tc = TINT_CLASSES[m.tint];
                  const active = type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        form.setValue("type", key);
                        if (key === "transfer") {
                          form.setValue("category_id", null);
                        } else {
                          form.setValue("to_account_id", null);
                        }
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
                          layoutId="template-type-tab-bg"
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

          {/* Name + emoji */}
          <GlassField
            label="Template name"
            icon={TagIcon}
            iconClassName="text-violet-500"
          >
            <div className="flex items-center gap-2">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value.slice(0, 4))}
                    placeholder="☕"
                    aria-label="Emoji"
                    className="h-10 w-12 shrink-0 rounded-xl border-border bg-background/40 text-center text-xl"
                  />
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="e.g. Morning coffee"
                        className="h-10 border-0 bg-transparent text-sm font-medium shadow-none focus-visible:ring-0"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="name"
              render={() => <FormMessage className="mt-2" />}
            />
          </GlassField>

          {/* Hero amount (optional) */}
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
                        {meta.label.toUpperCase()} AMOUNT · OPTIONAL
                      </span>
                    </div>
                    {isTransfer && selectedAccount && selectedToAccount && (
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
                        field.onChange(v === "" ? null : Number(v));
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
                  <p className="mt-4 text-center text-[11px] text-muted-foreground">
                    Leave blank to type the amount each time you use this
                    template
                  </p>
                </div>
                <FormMessage className="mt-2" />
              </FormItem>
            )}
          />

          {/* Accounts */}
          {isTransfer ? (
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
            </>
          ) : (
            <>
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

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <GlassField
                      label="Category"
                      icon={TagIcon}
                      iconClassName="text-violet-500"
                    >
                      <CategorySelect
                        value={field.value}
                        onChange={field.onChange}
                        type={type as "income" | "expense"}
                      />
                    </GlassField>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <GlassField label="Description">
                  <FormControl>
                    <Textarea
                      placeholder="Prefilled into the transaction (optional)"
                      {...field}
                      value={field.value ?? ""}
                      rows={3}
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
                            className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                          >
                            <Plus className="size-3" /> Add more
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

          {/* Sticky submit */}
          <StickyFooterActions className="bg-unset">
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "h-10 w-full rounded-xl font-semibold shadow-lg transition",
                tint.solid,
                tint.shadow,
                "text-white",
              )}
            >
              <Plus className="size-5" />
              {isSubmitting ? "Saving…" : submitLabel}
              <span className="ml-1 text-sm font-normal tabular-nums opacity-80">
                · {icon ? `${icon} ` : ""}
                {amount != null
                  ? `${sign}${amount} ${selectedAccount?.currency?.symbol ?? ""}`
                  : ""}
              </span>
            </Button>
          </StickyFooterActions>
        </form>
      </Form>

      {/* Tag picker sheet */}
      <BottomSheet
        open={tagSheetOpen}
        onClose={() => setTagSheetOpen(false)}
        title="Choose tags"
        items={tagItems}
        layout="grid"
        searchable={tagItems.length > 8}
        multi
        selectedIds={selectedTagIds}
        onSelectMulti={(ids) => form.setValue("tag_ids", ids)}
        emptyMessage="No tags yet"
      />
    </FormWrapper>
  );
}
