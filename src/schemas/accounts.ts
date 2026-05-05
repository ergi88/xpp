import { z } from "zod";

export const accountSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Maximum 255 characters"),

  type: z.enum(["bank", "crypto", "cash", "credit"], {
    error: "Please select account type",
  }),

  currency_id: z.string().min(1, "Please select currency"),

  initial_balance: z.coerce
    .number()
    .min(0, "Balance cannot be negative")
    .optional()
    .default(0),

  is_active: z.boolean().optional().default(true),

  card_last_digits: z
    .string()
    .length(4, "Must be exactly 4 digits")
    .regex(/^\d{4}$/, "Must be 4 numeric digits")
    .optional()
    .nullable(),

  card_expiry: z
    .string()
    .regex(/^\d{2}\/\d{2}$/, "Format must be MM/YY")
    .optional()
    .nullable(),

  credit_limit: z.coerce
    .number()
    .min(0, "Credit limit cannot be negative")
    .optional()
    .nullable(),
}).superRefine((data, ctx) => {
  if (data.type === 'credit' && data.credit_limit == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Credit limit is required for credit accounts',
      path: ['credit_limit'],
    })
  }
})

export type AccountFormData = z.infer<typeof accountSchema>;
