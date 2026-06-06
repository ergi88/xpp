import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { motion } from "motion/react";
import {
  ArrowRight,
  Banknote,
  HandCoins,
  Minus,
  Plus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { safeZodResolver } from "@/lib/zod-resolver";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { AccountSelect } from "@/components/shared/AccountSelect";
import { AmountText } from "@/components/shared/AmountText";
import { debtPaymentSchema, DebtPaymentFormData } from "@/schemas";
import { useAccounts } from "@/hooks";
import { resolvePaymentTxType } from "@/api/debts";
import { Debt } from "@/types";

interface DebtPaymentDialogProps {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (debtId: string, data: DebtPaymentFormData) => void;
  isSubmitting?: boolean;
  mode: "payment" | "collection";
}

type Direction = "decrease" | "increase";

function GlassField({
  label,
  icon: Icon,
  iconClassName,
  children,
  accessory,
}: {
  label: string;
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
      {children}
    </div>
  );
}

export function DebtPaymentDialog({
  debt,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  mode,
}: DebtPaymentDialogProps) {
  const { data: accounts } = useAccounts({
    active: true,
    exclude_debts: true,
  });

  const [rawAmount, setRawAmount] = useState("");
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<DebtPaymentFormData>({
    resolver: safeZodResolver<DebtPaymentFormData>(debtPaymentSchema),
    defaultValues: {
      account_id: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      description: "",
      direction: "decrease",
    },
  });

  // Reset the form whenever the dialog (re)opens for a debt.
  useEffect(() => {
    if (open) {
      form.reset({
        account_id: "",
        amount: 0,
        date: new Date().toISOString().split("T")[0],
        description: "",
        direction: "decrease",
      });
      setRawAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debt?.id]);

  const direction = (useWatch({ control: form.control, name: "direction" }) ??
    "decrease") as Direction;
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const amount = useWatch({ control: form.control, name: "amount" });

  const debtType = debt?.debtType ?? "owed_to_me";
  const txType = resolvePaymentTxType(debtType, direction);
  const tint =
    txType === "income"
      ? {
          text: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/30",
          solid: "bg-emerald-500 hover:bg-emerald-500/90",
          shadow: "shadow-emerald-500/30",
          sign: "+",
        }
      : {
          text: "text-rose-600 dark:text-rose-400",
          bg: "bg-rose-500/10",
          border: "border-rose-500/30",
          solid: "bg-rose-500 hover:bg-rose-500/90",
          shadow: "shadow-rose-500/30",
          sign: "−",
        };

  const decimals = debt?.currency?.decimals ?? 2;
  const symbol = debt?.currency?.symbol ?? "";
  const amountNum = Number(amount) || 0;

  // New remaining preview. Decrease settles; increase grows.
  const newRemaining = useMemo(() => {
    if (!debt) return 0;
    const delta = direction === "decrease" ? -amountNum : amountNum;
    return Math.max(0, debt.remainingDebt + delta);
  }, [debt, direction, amountNum]);

  const directionLabels: Record<Direction, { label: string; sub: string }> =
    debtType === "i_owe"
      ? {
          decrease: { label: "Pay back", sub: "Reduce what you owe" },
          increase: { label: "Borrow more", sub: "Grow what you owe" },
        }
      : {
          decrease: { label: "Collect", sub: "Reduce what's owed to you" },
          increase: { label: "Lend more", sub: "Grow what's owed to you" },
        };

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

  const handleSubmit = (data: DebtPaymentFormData) => {
    if (debt) onSubmit(debt.id, data);
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

  const selectedAccount = accounts?.find((a) => a.id === accountId);
  const isValid = amountNum > 0 && !!accountId;

  const title = mode === "payment" ? "Make Payment" : "Collect Payment";

  const DirectionIcon = debtType === "i_owe" ? Banknote : HandCoins;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {direction === "decrease"
              ? "Record a movement that settles this debt"
              : "Record a movement that grows this debt"}
          </DialogDescription>
        </DialogHeader>

        {debt && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}
              className="space-y-3"
            >
              {/* Debt summary */}
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card/40 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      debtType === "i_owe"
                        ? "bg-rose-500/10"
                        : "bg-emerald-500/10",
                    )}
                  >
                    <DirectionIcon
                      className={cn(
                        "size-4",
                        debtType === "i_owe"
                          ? "text-rose-500"
                          : "text-emerald-500",
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {debt.name}
                    </div>
                    <div className="text-[11px] tabular-nums text-muted-foreground">
                      Remaining{" "}
                      <AmountText
                        value={debt.remainingDebt}
                        decimals={decimals}
                        currency={symbol}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Direction toggle */}
              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <div className="relative flex gap-1 rounded-2xl border border-border bg-card/80 p-1 backdrop-blur-xl">
                      {(["decrease", "increase"] as Direction[]).map((dir) => {
                        const active = field.value === dir;
                        const Icon = dir === "decrease" ? Minus : Plus;
                        return (
                          <button
                            key={dir}
                            type="button"
                            onClick={() => field.onChange(dir)}
                            className={cn(
                              "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-center transition",
                              active
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {active && (
                              <motion.div
                                layoutId="debt-dir-bg"
                                className="absolute inset-0 rounded-xl border border-border bg-accent"
                                transition={{
                                  type: "spring",
                                  stiffness: 400,
                                  damping: 30,
                                }}
                              />
                            )}
                            <span className="relative z-10 flex items-center gap-1 text-sm font-medium">
                              <Icon className="size-3.5" />
                              {directionLabels[dir].label}
                            </span>
                            <span className="relative z-10 text-[10px] text-muted-foreground">
                              {directionLabels[dir].sub}
                            </span>
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
                            {txType === "income" ? "INCOME" : "EXPENSE"} ·{" "}
                            {directionLabels[direction].label.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-center gap-1.5">
                        <motion.span
                          key={tint.sign}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn("text-6xl font-light", tint.text)}
                        >
                          {tint.sign}
                        </motion.span>
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
                        <span
                          className={cn(
                            "text-2xl font-light opacity-70",
                            tint.text,
                          )}
                        >
                          {symbol}
                        </span>
                      </div>

                      <div className="mt-5 border-t border-border/60 pt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Remaining after
                          </span>
                          <div className="flex items-center gap-1.5 font-medium tabular-nums">
                            <span className="text-muted-foreground">
                              {debt.remainingDebt.toFixed(decimals)}
                            </span>
                            <ArrowRight className="size-3 text-muted-foreground" />
                            <span className={tint.text}>
                              {newRemaining.toFixed(decimals)} {symbol}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick fills (settle path) */}
                      {direction === "decrease" && (
                        <div className="mt-3 flex justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRawAmount(String(debt.remainingDebt));
                              field.onChange(debt.remainingDebt);
                            }}
                            className="rounded-full border border-border bg-card/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const half =
                                Math.round((debt.remainingDebt / 2) * 100) /
                                100;
                              setRawAmount(String(half));
                              field.onChange(half);
                            }}
                            className="rounded-full border border-border bg-card/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                          >
                            Half
                          </button>
                        </div>
                      )}
                    </div>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              {/* Account */}
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <GlassField
                      label={
                        txType === "income"
                          ? "Account to receive into"
                          : "Account to pay from"
                      }
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

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <GlassField label="Date">
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
                          placeholder="Optional notes…"
                          {...field}
                          rows={2}
                          className="resize-none border-0 text-sm shadow-none focus-visible:ring-0"
                        />
                      </FormControl>
                    </GlassField>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className={cn(
                    "flex-1 font-semibold shadow-lg transition",
                    isValid
                      ? cn(tint.solid, tint.shadow, "text-white")
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {isSubmitting
                    ? "Processing…"
                    : directionLabels[direction].label}
                  {isValid && (
                    <span className="ml-1 text-sm font-normal tabular-nums opacity-80">
                      · {tint.sign}
                      {amountNum} {selectedAccount?.currency?.symbol ?? symbol}
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
