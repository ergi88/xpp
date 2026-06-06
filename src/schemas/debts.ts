import { z } from "zod";

export const debtSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Maximum 255 characters"),

  debt_type: z.enum(["i_owe", "owed_to_me"], {
    error: "Please select debt type",
  }),

  currency_id: z.string().min(1, "Please select currency"),

  amount: z.coerce.number().positive("Amount must be greater than 0"),

  due_date: z.string().optional(),

  counterparty: z.string().max(255).optional(),

  description: z.string().max(1000).optional(),

  origin_account_id: z.string().min(1).optional(),
  origin_date: z.string().optional(),
  origin_transaction_id: z.string().min(1).optional(),
});

export type DebtFormData = z.infer<typeof debtSchema>;

export const debtPaymentSchema = z.object({
  account_id: z.string().min(1, "Please select account"),

  amount: z.coerce.number().positive("Amount must be greater than 0"),

  date: z.string().min(1, "Date is required"),

  description: z.string().max(1000).optional(),

  // decrease = settle the debt (reduce remaining); increase = grow the debt.
  // The resulting transaction type (income/expense) is derived from this plus
  // the debt's direction — see resolvePaymentTxType in api/debts.
  direction: z.enum(["decrease", "increase"]).default("decrease"),
});

export type DebtPaymentFormData = z.infer<typeof debtPaymentSchema>;
