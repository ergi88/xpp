import type { Resolver, FieldValues } from 'react-hook-form'
import type { ZodType } from 'zod'

// Wraps a Zod schema as a react-hook-form Resolver using safeParse directly.
// Replaces @hookform/resolvers/zod, which in v3.x lets some Zod v4 ZodError
// shapes escape as unhandled promise rejections instead of routing them into
// form.formState.errors. This implementation never throws.
export function safeZodResolver<T extends FieldValues>(
    schema: ZodType
): Resolver<T> {
    return async (values) => {
        const result = schema.safeParse(values)
        if (result.success) {
            return { values: result.data as T, errors: {} }
        }
        const errors: Record<string, { type: string; message: string }> = {}
        for (const issue of result.error.issues) {
            const path = issue.path.join('.') || '_root'
            if (!errors[path]) {
                errors[path] = { type: issue.code, message: issue.message }
            }
        }
        return { values: {}, errors: errors as never }
    }
}
