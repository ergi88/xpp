import { v4 as uuidv4 } from 'uuid'
import { adapter } from './client'
import type { TransactionTemplate } from '@/types'
import type { TemplateFormData } from '@/schemas'
import { accountsApi } from './accounts'
import { categoriesApi } from './categories'
import { tagsApi } from './tags'

function toTemplate(
    r: Record<string, unknown>,
    accountMap: Map<string, unknown>,
    categoryMap: Map<string, unknown>,
    tagMap: Map<string, unknown>,
): TransactionTemplate {
    const tagIds = r.tag_ids ? String(r.tag_ids).split(',').filter(Boolean) : []
    return {
        id: r.id as string,
        name: (r.name as string) ?? '',
        icon: r.icon ? String(r.icon) : undefined,
        type: r.type as TransactionTemplate['type'],
        accountId: r.account_id as string,
        toAccountId: r.to_account_id ? String(r.to_account_id) : undefined,
        categoryId: r.category_id ? String(r.category_id) : undefined,
        // Blank cell → undefined (means "fill amount each time").
        amount: r.amount !== undefined && r.amount !== '' ? Number(r.amount) : undefined,
        description: r.description ? String(r.description) : undefined,
        tagIds,
        sortOrder: r.sort_order !== undefined && r.sort_order !== '' ? Number(r.sort_order) : undefined,
        createdAt: r.created_at as string | undefined,
        account: accountMap.get(r.account_id as string) as TransactionTemplate['account'],
        toAccount: r.to_account_id ? accountMap.get(r.to_account_id as string) as TransactionTemplate['toAccount'] : undefined,
        category: r.category_id ? categoryMap.get(r.category_id as string) as TransactionTemplate['category'] : undefined,
        tags: tagIds.map(tid => tagMap.get(tid)).filter(Boolean) as TransactionTemplate['tags'],
    }
}

async function buildMaps() {
    const [accounts, categories, tags] = await Promise.all([
        accountsApi.getAll(),
        categoriesApi.getAll(),
        tagsApi.getAll(),
    ])
    return {
        accountMap: new Map(accounts.map(a => [a.id, a])),
        categoryMap: new Map(categories.map(c => [c.id, c])),
        tagMap: new Map(tags.map(t => [t.id, t])),
    }
}

export const templatesApi = {
    getAll: async (): Promise<TransactionTemplate[]> => {
        const [rows, maps] = await Promise.all([adapter.getAll('templates'), buildMaps()])
        return rows
            .map(r => toTemplate(r, maps.accountMap, maps.categoryMap, maps.tagMap))
            .sort((a, b) => {
                const so = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
                return so !== 0 ? so : a.name.localeCompare(b.name)
            })
    },

    getById: async (id: string | number): Promise<TransactionTemplate> => {
        const [r, maps] = await Promise.all([adapter.getById('templates', String(id)), buildMaps()])
        if (!r) throw new Error('Template not found')
        return toTemplate(r, maps.accountMap, maps.categoryMap, maps.tagMap)
    },

    create: async (data: TemplateFormData): Promise<TransactionTemplate> => {
        const id = uuidv4()
        await adapter.create('templates', {
            id,
            name: data.name,
            icon: data.icon ?? '',
            type: data.type,
            account_id: data.account_id,
            to_account_id: data.to_account_id ?? '',
            category_id: data.category_id ?? '',
            amount: data.amount ?? '',
            description: data.description ?? '',
            tag_ids: (data.tag_ids ?? []).join(','),
            sort_order: '',
            created_at: new Date().toISOString(),
        })
        return templatesApi.getById(id)
    },

    update: async (id: string | number, data: Partial<TemplateFormData>): Promise<TransactionTemplate> => {
        await adapter.update('templates', String(id), {
            ...data,
            // Persist the "no fixed amount" choice as a blank cell.
            amount: data.amount == null ? '' : data.amount,
            tag_ids: data.tag_ids ? data.tag_ids.join(',') : undefined,
        } as Record<string, unknown>)
        return templatesApi.getById(id)
    },

    delete: (id: string | number): Promise<void> =>
        adapter.delete('templates', String(id)),
}
