import { z } from 'zod'

export const templateSchema = z.object({
    name: z.string({
        message: 'Please enter a name',
    }).min(1, 'Please enter a name').max(60, 'Name is too long'),

    icon: z.string().max(8).nullable().optional(),

    type: z.enum(['income', 'expense', 'transfer'], {
        message: 'Please select a type',
    }),

    account_id: z.string({
        message: 'Please select an account',
    }).min(1, 'Please select an account'),

    to_account_id: z.preprocess(v => v === '' ? null : v, z.string().min(1).nullable().optional()),

    category_id: z.string().min(1).nullable().optional(),

    // Optional: blank means "fill the amount in each time".
    amount: z.coerce.number()
        .min(0.01, 'Amount must be greater than 0')
        .nullable()
        .optional(),

    description: z.string().max(255).nullable().optional(),

    tag_ids: z.array(z.string().min(1)).default([]),
}).superRefine((data, ctx) => {
    // Require category for income/expense
    if ((data.type === 'income' || data.type === 'expense') && !data.category_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please select a category',
            path: ['category_id'],
        })
    }

    // Require to_account_id for transfer
    if (data.type === 'transfer' && !data.to_account_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please select destination account',
            path: ['to_account_id'],
        })
    }

    // Don't allow same account for transfer
    if (data.type === 'transfer' && data.account_id === data.to_account_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Destination must be different from source',
            path: ['to_account_id'],
        })
    }
})

export type TemplateFormData = z.infer<typeof templateSchema>
