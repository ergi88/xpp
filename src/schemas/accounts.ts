import { z } from 'zod'

export const accountSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(255, 'Maximum 255 characters'),

    type: z.enum(['bank', 'crypto', 'cash'], {
        error: 'Please select account type',
    }),

    currency_id: z.coerce.number({
        error: 'Please select currency',
    }).positive('Please select currency'),

    initial_balance: z.coerce.number()
        .min(0, 'Balance cannot be negative')
        .optional()
        .default(0),

    is_active: z.boolean().optional().default(true),
})

export type AccountFormData = z.infer<typeof accountSchema>
