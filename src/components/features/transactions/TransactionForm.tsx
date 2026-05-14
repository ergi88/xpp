import {
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  transactionSchema,
  TransactionFormValues,
} from "@/schemas/transactions";
import {
  useAccounts,
  useCategories,
  useTags,
  useDebts,
  useCreateDebt,
} from "@/hooks";
import { cn } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Banknote,
  HandCoins,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccountSelect } from "@/components/shared/AccountSelect";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { FormWrapper } from "@/components/shared/FormWrapper";
import { AmountText } from "@/components/shared/AmountText";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const TRANSACTION_TYPES = [
  {
    value: "income",
    label: "Income",
    icon: ArrowDownLeft,
    color: "text-green-600",
  },
  {
    value: "expense",
    label: "Expense",
    icon: ArrowUpRight,
    color: "text-red-600",
  },
  {
    value: "transfer",
    label: "Transfer",
    icon: ArrowLeftRight,
    color: "text-blue-600",
  },
] as const;

interface TransactionFormProps {
  defaultValues?: Partial<TransactionFormValues>;
  onSubmit: (data: TransactionFormValues) => void;
  onTypeChange?: (type: TransactionFormValues["type"]) => void;
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
  const createDebt = useCreateDebt();
  const [pickerMode, setPickerMode] = useState<"category" | "debt">(
    defaultValues?.debt_id ? "debt" : "category",
  );
  const [createDebtOpen, setCreateDebtOpen] = useState(false);
  const [newDebtName, setNewDebtName] = useState("");
  const [newDebtAmount, setNewDebtAmount] = useState("");

  const formDefaults = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      type: defaultValues?.type ?? ("expense" as const),
      account_id: defaultValues?.account_id ?? "",
      to_account_id: defaultValues?.to_account_id ?? null,
      category_id: defaultValues?.category_id ?? null,
      amount: defaultValues?.amount ?? 0,
      to_amount: defaultValues?.to_amount ?? null,
      description: defaultValues?.description ?? "",
      date: defaultValues?.date || today,
      tag_ids: defaultValues?.tag_ids ?? [],
      is_excluded: defaultValues?.is_excluded ?? false,
      is_one_time: defaultValues?.is_one_time ?? false,
      debt_id: defaultValues?.debt_id ?? null,
    };
  }, [defaultValues]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema) as Resolver<TransactionFormValues>,
    defaultValues: formDefaults,
  });

  // Reset form when defaults change (e.g., when editing and data loads)
  useEffect(() => {
    form.reset(formDefaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDefaults]);

  const transactionType = useWatch({ control: form.control, name: "type" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const categoryId = useWatch({ control: form.control, name: "category_id" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const toAccountId = useWatch({
    control: form.control,
    name: "to_account_id",
  });
  const toAmount = useWatch({ control: form.control, name: "to_amount" });
  const selectedTagIds =
    useWatch({ control: form.control, name: "tag_ids" }) ?? [];

  // Filter categories based on transaction type and sort by popularity
  const filteredCategories = useMemo(() => {
    return (categories?.filter((c) => c.type === transactionType) ?? []).sort(
      (a, b) => (b.transactionsCount ?? 0) - (a.transactionsCount ?? 0),
    );
  }, [categories, transactionType]);

  // Auto-select first account if none selected
  useEffect(() => {
    if (!accountId && accounts && accounts.length > 0) {
      form.setValue("account_id", accounts[0].id);
    }
  }, [accountId, accounts, form]);

  // Auto-select most popular category if none selected (only for income/expense)
  useEffect(() => {
    if (
      !categoryId &&
      transactionType !== "transfer" &&
      filteredCategories.length > 0
    ) {
      form.setValue("category_id", filteredCategories[0].id);
    }
  }, [categoryId, transactionType, filteredCategories, form]);

  // Reset category when type changes
  useEffect(() => {
    if (transactionType === "transfer") {
      form.setValue("category_id", null);
    }
  }, [transactionType, form]);

  const selectedAccount = accounts?.find((a) => a.id === accountId);
  const selectedToAccount = accounts?.find((a) => a.id === toAccountId);

  // Calculate balance preview
  const balancePreview = useMemo(() => {
    if (!selectedAccount) return null;

    const currentBalance = selectedAccount.currentBalance;
    const txAmount = Number(amount) || 0;

    let newBalance = currentBalance;
    if (transactionType === "income") {
      newBalance = currentBalance + txAmount;
    } else if (
      transactionType === "expense" ||
      transactionType === "transfer"
    ) {
      newBalance = currentBalance - txAmount;
    }

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

  // Balance preview for destination account (transfer)
  const toBalancePreview = useMemo(() => {
    if (!selectedToAccount || transactionType !== "transfer") return null;

    const currentBalance = selectedToAccount.currentBalance;
    const txAmount = Number(toAmount) || Number(amount) || 0;
    const newBalance = currentBalance + txAmount;

    return {
      currentBalance,
      newBalance,
      currency: selectedToAccount.currency?.symbol ?? "",
      decimals: selectedToAccount.currency?.decimals ?? 2,
    };
  }, [selectedToAccount, toAmount, amount, transactionType]);

  return (
    <FormWrapper>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Transaction Type Tabs */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            {TRANSACTION_TYPES.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  form.setValue("type", value);
                  onTypeChange?.(value);
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all",
                  transactionType === value
                    ? "bg-background shadow-sm"
                    : "hover:bg-background/50",
                )}
              >
                <Icon
                  className={cn("size-4", transactionType === value && color)}
                />
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Account */}
            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {transactionType === "transfer"
                      ? "From Account"
                      : "Account"}
                  </FormLabel>
                  <AccountSelect
                    value={field.value}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* To Account (Transfer only) */}
            {transactionType === "transfer" ? (
              <FormField
                control={form.control}
                name="to_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Account</FormLabel>
                    <AccountSelect
                      value={field.value}
                      onChange={field.onChange}
                      excludeId={accountId}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              /* Category OR Debt (Income/Expense only) */
              <FormField
                control={form.control}
                name="category_id"
                render={({ field: categoryField }) => {
                  const compatibleDebts = (debts ?? []).filter((d) => {
                    if (!selectedAccount?.currency?.id) return true;
                    return d.currencyId === selectedAccount.currency.id;
                  });
                  return (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>
                          {pickerMode === "debt" ? "Debt" : "Category"}
                        </FormLabel>
                        <Select
                          value={pickerMode}
                          onValueChange={(v) => {
                            const next = v as "category" | "debt";
                            setPickerMode(next);
                            if (next === "category") {
                              form.setValue("debt_id", null);
                            } else {
                              categoryField.onChange(null);
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="category">Category</SelectItem>
                            <SelectItem value="debt">Debt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {pickerMode === "category" ? (
                        <CategorySelect
                          value={categoryField.value}
                          onChange={categoryField.onChange}
                          type={transactionType as "income" | "expense"}
                        />
                      ) : (
                        <FormField
                          control={form.control}
                          name="debt_id"
                          render={({ field: debtField }) => (
                            <Select
                              value={debtField.value ?? ""}
                              onValueChange={(v) => {
                                if (v === "__new__") {
                                  setCreateDebtOpen(true);
                                  return;
                                }
                                debtField.onChange(v || null);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Pick a debt or create new" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {compatibleDebts.map((d) => {
                                  const Icon =
                                    d.debtType === "i_owe"
                                      ? Banknote
                                      : HandCoins;
                                  const color =
                                    d.debtType === "i_owe"
                                      ? "text-red-600"
                                      : "text-green-600";
                                  return (
                                    <SelectItem key={d.id} value={d.id}>
                                      <div className="flex items-center gap-2 w-full">
                                        <Icon
                                          className={cn(
                                            "size-3.5 shrink-0",
                                            color,
                                          )}
                                        />
                                        <span className="flex-1 truncate">
                                          {d.name}
                                        </span>
                                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                          <AmountText
                                            value={d.remainingDebt}
                                            decimals={
                                              d.currency?.decimals ?? 2
                                            }
                                            currency={d.currency?.symbol}
                                          />
                                        </span>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                                <SelectItem value="__new__">
                                  <span className="text-primary font-medium">
                                    + Create new debt
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}
          </div>

          {/* Balance Preview */}
          {balancePreview && (
            <div
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg border text-sm",
                balancePreview.insufficientFunds
                  ? "bg-destructive/10 border-destructive/50"
                  : "bg-muted/50",
              )}
            >
              <div className="flex-1">
                <span className="text-muted-foreground">Balance: </span>
                <span className="font-mono font-medium">
                  {balancePreview.currentBalance.toFixed(
                    balancePreview.decimals,
                  )}{" "}
                  {balancePreview.currency}
                </span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex-1 text-right">
                <span className="text-muted-foreground">After: </span>
                <span
                  className={cn(
                    "font-mono font-medium",
                    balancePreview.insufficientFunds
                      ? "text-destructive"
                      : balancePreview.newBalance >
                          balancePreview.currentBalance
                        ? "text-green-600"
                        : "text-foreground",
                  )}
                >
                  {balancePreview.newBalance.toFixed(balancePreview.decimals)}{" "}
                  {balancePreview.currency}
                </span>
              </div>
              {balancePreview.insufficientFunds && (
                <span className="text-destructive text-xs font-medium">
                  Insufficient funds
                </span>
              )}
            </div>
          )}

          {/* To Account Balance Preview (Transfer) */}
          {toBalancePreview && (
            <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/50 text-sm">
              <div className="flex-1">
                <span className="text-muted-foreground">To Balance: </span>
                <span className="font-mono font-medium">
                  {toBalancePreview.currentBalance.toFixed(
                    toBalancePreview.decimals,
                  )}{" "}
                  {toBalancePreview.currency}
                </span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex-1 text-right">
                <span className="text-muted-foreground">After: </span>
                <span className="font-mono font-medium text-green-600">
                  {toBalancePreview.newBalance.toFixed(
                    toBalancePreview.decimals,
                  )}{" "}
                  {toBalancePreview.currency}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {transactionType === "transfer" ? "Send Amount" : "Amount"}
                    {selectedAccount?.currency?.symbol && (
                      <span className="text-muted-foreground ml-1">
                        ({selectedAccount.currency.symbol})
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* To Amount (Transfer only) or Date */}
            {transactionType === "transfer" ? (
              <FormField
                control={form.control}
                name="to_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receive Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00 (auto if same currency)"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Date for transfer */}
          {transactionType === "transfer" && (
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Optional notes..."
                    className="resize-none h-20"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Flags */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <FormField
              control={form.control}
              name="is_excluded"
              render={({ field }) => {
                const isOneTime = form.watch('is_one_time')
                return (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        disabled={!!isOneTime}
                        onCheckedChange={(v) => field.onChange(!!v)}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel>Exclude from reports</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Hidden from every aggregate. Account balance still counts it.
                      </p>
                    </div>
                  </FormItem>
                )
              }}
            />
            <FormField
              control={form.control}
              name="is_one_time"
              render={({ field }) => {
                const isExcluded = form.watch('is_excluded')
                return (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        disabled={!!isExcluded}
                        onCheckedChange={(v) => field.onChange(!!v)}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel>Mark as one-time</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Counted in raw totals but skipped from averages and projections.
                      </p>
                    </div>
                  </FormItem>
                )
              }}
            />
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <FormField
              control={form.control}
              name="tag_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const isSelected = selectedTagIds.includes(tag.id);
                      return (
                        <Badge
                          key={tag.id}
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isSelected
                              ? "hover:bg-primary/80"
                              : "hover:bg-muted",
                          )}
                          onClick={() => {
                            const newTagIds = isSelected
                              ? selectedTagIds.filter((id) => id !== tag.id)
                              : [...selectedTagIds, tag.id];
                            field.onChange(newTagIds);
                          }}
                        >
                          #{tag.name}
                        </Badge>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <Button
            type="submit"
            disabled={isSubmitting || balancePreview?.insufficientFunds}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </form>
      </Form>

      {/* Create new debt dialog */}
      <Dialog open={createDebtOpen} onOpenChange={setCreateDebtOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new debt</DialogTitle>
            <DialogDescription>
              {transactionType === "income"
                ? "Income → 'I owe' debt. Money received that you'll pay back."
                : "Expense → 'Owed to me' debt. Money lent that someone will repay."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-debt-name">Name</Label>
              <Input
                id="new-debt-name"
                value={newDebtName}
                onChange={(e) => setNewDebtName(e.target.value)}
                placeholder="e.g. Loan from John"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-debt-amount">Amount</Label>
              <Input
                id="new-debt-amount"
                type="number"
                step="0.01"
                min={0}
                value={newDebtAmount}
                onChange={(e) => setNewDebtAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateDebtOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                createDebt.isPending ||
                !newDebtName.trim() ||
                !(Number(newDebtAmount) > 0) ||
                !selectedAccount?.currency?.id
              }
              onClick={async () => {
                const debtType =
                  transactionType === "income" ? "i_owe" : "owed_to_me";
                const created = await createDebt.mutateAsync({
                  name: newDebtName.trim(),
                  debt_type: debtType,
                  currency_id: selectedAccount!.currency!.id,
                  amount: Number(newDebtAmount),
                });
                form.setValue("debt_id", created.id);
                setCreateDebtOpen(false);
                setNewDebtName("");
                setNewDebtAmount("");
              }}
            >
              {createDebt.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormWrapper>
  );
}
