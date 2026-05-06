// src/lib/sheets/gas-adapter.ts
import type { DataAdapter, SheetName } from './adapter'
import { enqueue } from '@/lib/mutation-queue'

const url = () => {
  const u = localStorage.getItem('xpp_gas_url') || (import.meta.env.VITE_GAS_URL as string)
  if (!u) throw new Error('GAS URL not configured. Complete setup first.')
  return u
}

async function get(
  resource: SheetName,
  action: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const u = new URL(url())
  u.searchParams.set('resource', resource)
  u.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const res = await fetch(u.toString())
  const json = (await res.json()) as { error?: string }
  if (json.error) throw new Error(json.error)
  return json
}

async function post(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(url(), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as { error?: string }
  if (json.error) throw new Error(json.error)
  return json
}

export const gasAdapter: DataAdapter = {
  getAll: (sheet) =>
    get(sheet, 'getAll') as Promise<Record<string, unknown>[]>,

  getById: (sheet, id) =>
    get(sheet, 'getById', { id }) as Promise<Record<string, unknown> | null>,

  create: async (sheet, data) => {
    if (!navigator.onLine) {
      await enqueue({ sheet, action: 'create', data })
      return data
    }
    return post({ action: 'create', resource: sheet, data }) as Promise<Record<string, unknown>>
  },

  update: async (sheet, id, data) => {
    if (!navigator.onLine) {
      await enqueue({ sheet, action: 'update', resourceId: id, data })
      return { ...data, id }
    }
    return post({ action: 'update', resource: sheet, id, data }) as Promise<Record<string, unknown>>
  },

  delete: async (sheet, id) => {
    if (!navigator.onLine) {
      await enqueue({ sheet, action: 'delete', resourceId: id })
      return
    }
    await post({ action: 'delete', resource: sheet, id })
  },
}
