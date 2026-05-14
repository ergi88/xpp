import { z } from 'zod'

export const splitChildSchema = z.object({
    id: z.string().min(1).optional(),
    description: z.string().max(255).nullable().optional(),
    quantity: z.coerce.number().min(0.0001).nullable().optional(),
    price_per_unit: z.coerce.number().min(0).nullable().optional(),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
    category_id: z.string().min(1).nullable().optional(),
    debt_id: z.string().min(1).nullable().optional(),
}).superRefine((data, ctx) => {
    const hasCategory = !!data.category_id
    const hasDebt = !!data.debt_id
    if (hasCategory === hasDebt) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Each split child must have exactly one of category or debt',
            path: ['category_id'],
        })
    }
})

export type SplitChildFormData = z.infer<typeof splitChildSchema>

export const transactionItemSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    quantity: z.coerce.number().int('Must be an integer').min(1, 'Must be at least 1'),
    price_per_unit: z.coerce.number().min(0, 'Cannot be negative'),
})

export const transactionSchema = z.object({
    type: z.enum(['income', 'expense', 'transfer'], {
        error: 'Please select transaction type',
    }),

    account_id: z.string({
        error: 'Please select account',
    }).min(1, 'Please select account'),

    to_account_id: z.string().min(1).optional().nullable(),

    category_id: z.string().min(1).optional().nullable(),

    amount: z.coerce.number({
        error: 'Amount is required',
    }).positive('Amount must be positive'),

    to_amount: z.coerce.number().positive().optional().nullable(),

    exchange_rate: z.coerce.number().positive().optional().nullable(),

    description: z.string().max(500).optional(),

    date: z.preprocess(
        (val) => val ?? new Date().toISOString().split('T')[0],
        z.string().min(1, 'Date is required')
    ),

    items: z.array(transactionItemSchema).optional(),

    tag_ids: z.array(z.string().min(1)).optional(),

    is_excluded: z.boolean().optional(),
    is_one_time: z.boolean().optional(),
    parent_id: z.string().min(1).nullable().optional(),
    debt_id: z.string().min(1).nullable().optional(),
    linked_transaction_id: z.string().min(1).nullable().optional(),
    recurring_id: z.string().min(1).nullable().optional(),
    children: z.array(splitChildSchema).optional(),
}).superRefine((data, ctx) => {
    // Transfer requires to_account_id
    if (data.type === 'transfer' && !data.to_account_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Destination account is required for transfers',
            path: ['to_account_id'],
        })
    }

    // Transfer should not have category
    if (data.type === 'transfer' && data.category_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Category should not be set for transfers',
            path: ['category_id'],
        })
    }

    // Income/Expense must have either a category OR a debt link (XOR enforced
    // by the form's mode switch — schema only requires one of them present).
    if (data.type !== 'transfer' && !data.category_id && !data.debt_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please select a category or debt',
            path: ['category_id'],
        })
    }

    // Validate items total matches amount (only if there are items with values)
    const items = data.items ?? []
    if (items.length > 0) {
        const itemsTotal = items.reduce((sum, item) => sum + item.quantity * item.price_per_unit, 0)
        if (itemsTotal > 0 && Math.abs(itemsTotal - data.amount) > 0.01) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Items total (${itemsTotal.toFixed(2)}) must equal amount (${data.amount.toFixed(2)})`,
                path: ['items'],
            })
        }
    }

    // Phase 1 invariants:
    if (data.is_excluded && data.is_one_time) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Transaction cannot be both excluded and one-time',
            path: ['is_one_time'],
        })
    }

    // Phase 3: split children must sum to parent amount (within 0.01).
    if (data.children && data.children.length > 0) {
        const sum = data.children.reduce((s, c) => s + (c.amount || 0), 0)
        if (Math.abs(sum - data.amount) > 0.01) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Children total (${sum.toFixed(2)}) must equal amount (${data.amount.toFixed(2)})`,
                path: ['children'],
            })
        }
    }
})

export type TransactionFormValues = z.infer<typeof transactionSchema>
export type TransactionItemFormValues = z.infer<typeof transactionItemSchema>
