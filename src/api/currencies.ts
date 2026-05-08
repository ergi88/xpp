import { adapter } from './client'
import type { Currency, CurrencyFormData } from '@/types'

function toCurrency(r: Record<string, unknown>): Currency {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    symbol: r.symbol as string,
    decimals: Number(r.decimals ?? 2),
    isBase: r.is_base === 'true' || r.is_base === true,
    rate: Number(r.rate ?? 1),
    createdAt: r.created_at as string | undefined,
  }
}

export const currenciesApi = {
  getAll: async (): Promise<Currency[]> =>
    (await adapter.getAll('currencies')).map(toCurrency),

  getById: async (id: string | number): Promise<Currency> => {
    const r = await adapter.getById('currencies', String(id))
    if (!r) throw new Error('Currency not found')
    return toCurrency(r)
  },

  create: async (data: CurrencyFormData): Promise<Currency> => {
    const existing = await currenciesApi.getAll()
    const found = existing.find(c => c.code === data.code)
    if (found) return found
    const r = await adapter.create('currencies', {
      id: crypto.randomUUID(),
      code: data.code,
      name: data.name,
      symbol: data.symbol,
      decimals: data.decimals,
      is_base: String(data.isBase ?? false),
      rate: data.rate ?? 1,
      created_at: new Date().toISOString(),
    })
    return toCurrency(r)
  },

  update: async (id: string | number, data: Partial<CurrencyFormData>): Promise<Currency> => {
    const r = await adapter.update('currencies', String(id), data as Record<string, unknown>)
    return toCurrency(r)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('currencies', String(id)),

  setBase: async (id: string | number): Promise<Currency> => {
    const all = await adapter.getAll('currencies')
    await Promise.all(
      all.map(c => adapter.update('currencies', c.id as string, { is_base: 'false' }))
    )
    const r = await adapter.update('currencies', String(id), { is_base: 'true' })
    return toCurrency(r)
  },
}
