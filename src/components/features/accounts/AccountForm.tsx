import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { accountSchema, AccountFormData } from "@/schemas";
import { useCurrencies } from "@/hooks";
import { REGULAR_ACCOUNT_TYPE_CONFIG, REGULAR_ACCOUNT_TYPES } from "@/constants";
import type { RegularAccountType } from "@/types";
import { cn } from "@/lib/utils";
import { FormWrapper } from "@/components/shared/FormWrapper";

interface AccountFormProps {
  defaultValues?: Partial<AccountFormData>;
  onSubmit: (data: AccountFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function AccountForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: AccountFormProps) {
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "bank",
      currency_id: "",
      initial_balance: 0,
      is_active: true,
      card_last_digits: null,
      card_expiry: null,
      credit_limit: null,
      ...defaultValues,
    },
  });

  const accountType = useWatch({ control: form.control, name: "type" });
  const showCardFields = accountType === "bank" || accountType === "credit";
  const isCredit = accountType === "credit";

  return (
    <FormWrapper>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Account" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {REGULAR_ACCOUNT_TYPES.map((type) => {
                      const config = REGULAR_ACCOUNT_TYPE_CONFIG[type as RegularAccountType];
                      const Icon = config.icon;
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn("size-4", config.textColor)} />
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
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
                <Select onValueChange={field.onChange} value={field.value} disabled={currenciesLoading}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {currencies?.map((currency) => (
                      <SelectItem key={currency.id} value={currency.id.toString()}>
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
            name="initial_balance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isCredit ? "Initial Balance Owed" : "Initial Balance"}</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min={0} placeholder="0.00" {...field} />
                </FormControl>
                <FormDescription>
                  {isCredit
                    ? "Amount already owed on this card (0 if starting fresh)"
                    : "Starting balance for this account"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {isCredit && (
            <FormField
              control={form.control}
              name="credit_limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Limit</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormDescription>Maximum credit available on this card</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {showCardFields && (
            <>
              <FormField
                control={form.control}
                name="card_last_digits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last 4 Digits</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="1234"
                        maxLength={4}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormDescription>Last 4 digits of the card number</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="card_expiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="MM/YY"
                        maxLength={5}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, "")
                          if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2, 4)
                          field.onChange(v || null)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active</FormLabel>
                  <FormDescription>Inactive accounts are hidden from lists</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </form>
      </Form>
    </FormWrapper>
  );
}
