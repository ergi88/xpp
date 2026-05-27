import { useForm } from "react-hook-form";
import { safeZodResolver } from "@/lib/zod-resolver";
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { debtSchema, DebtFormData } from "@/schemas";
import { useCurrencies, useAccounts } from "@/hooks";
import { Banknote, HandCoins } from "lucide-react";
import { toLocalDateString } from "@/lib/date";
import { FormWrapper } from "@/components/shared/FormWrapper";
import { AmountText } from "@/components/shared/AmountText";

interface DebtFormProps {
  defaultValues?: Partial<DebtFormData>;
  onSubmit: (data: DebtFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  showOriginTransaction?: boolean;
}

const DEBT_TYPES = [
  {
    value: "i_owe",
    label: "I Owe",
    icon: Banknote,
    description: "Money you owe to someone",
    color: "text-red-600",
  },
  {
    value: "owed_to_me",
    label: "Owed to Me",
    icon: HandCoins,
    description: "Money someone owes to you",
    color: "text-green-600",
  },
];

export function DebtForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
  showOriginTransaction = false,
}: DebtFormProps) {
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();
  const { data: accounts, isLoading: accountsLoading } = useAccounts({
    active: true,
    exclude_debts: true,
  });

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

  const debtType = form.watch("debt_type");
  const hasOriginAccount = !!form.watch("origin_account_id");
  const [createOriginTx, setCreateOriginTx] = React.useState(false);

  function handleOriginToggle(checked: boolean) {
    setCreateOriginTx(checked);
    if (!checked) {
      form.setValue("origin_account_id", undefined);
    }
  }

  const originLabel =
    debtType === "i_owe"
      ? "Account that received the funds"
      : "Account that paid";

  const originDescription =
    debtType === "i_owe"
      ? "Records an income transaction — money/value you received that created this debt"
      : "Records an expense transaction — money you paid that created this debt";

  return (
    <FormWrapper>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-w-md space-y-4"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Car Loan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="debt_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select debt type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DEBT_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`size-4 ${type.color}`} />
                            <span>{type.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {form.watch("debt_type") === "i_owe"
                    ? "Money you need to pay back"
                    : "Money you expect to receive"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={currenciesLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {currencies?.map((currency) => (
                      <SelectItem
                        key={currency.id}
                        value={currency.id.toString()}
                      >
                        <span className="font-mono">{currency.code}</span>
                        <span className="text-muted-foreground ml-2">
                          {currency.symbol} · {currency.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="1000.00"
                    {...field}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? 0 : parseFloat(e.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormDescription>Total debt amount</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="counterparty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Counterparty</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe / Bank Name" {...field} />
                </FormControl>
                <FormDescription>
                  Who you owe to or who owes you
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormDescription>
                  Optional deadline for the debt
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional notes about this debt..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {showOriginTransaction && (
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Link origin transaction</p>
                  <p className="text-xs text-muted-foreground">
                    {debtType === "i_owe"
                      ? "Record the income that created this debt"
                      : "Record the expense that created this debt"}
                  </p>
                </div>
                <Switch
                  checked={createOriginTx}
                  onCheckedChange={handleOriginToggle}
                />
              </div>

              {createOriginTx && (
                <>
                  <FormField
                    control={form.control}
                    name="origin_account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{originLabel}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                          disabled={accountsLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accounts?.map((account) => (
                              <SelectItem
                                key={account.id}
                                value={account.id.toString()}
                              >
                                <div className="flex items-center justify-between gap-4 w-full">
                                  <span>{account.name}</span>
                                  <span className="text-muted-foreground text-xs font-mono">
                                    <AmountText
                                      value={account.currentBalance}
                                      decimals={account.currency?.decimals ?? 2}
                                      currency={account.currency?.symbol}
                                    />
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{originDescription}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="origin_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transaction Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </form>
      </Form>
    </FormWrapper>
  );
}

// React needs to be in scope for JSX
import React from "react";
