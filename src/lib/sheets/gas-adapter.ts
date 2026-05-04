import type { DataAdapter, SheetName } from './adapter'

const url = () => {
  const u = import.meta.env.VITE_GAS_URL as string
  if (!u) throw new Error('VITE_GAS_URL is not set')
  return u
}

async function get(resource: SheetName, action: string, params: Record<string, string> = {}): Promise<unknown> {
  const u = new URL(url())
  u.searchParams.set('resource', resource)
  u.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const res = await fetch(u.toString())
  const json = await res.json() as { error?: string }
  if (json.error) throw new Error(json.error)
  return json
}

async function post(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(url(), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const json = await res.json() as { error?: string }
  if (json.error) throw new Error(json.error)
  return json
}

export const gasAdapter: DataAdapter = {
  getAll: (sheet) =>
    get(sheet, 'getAll') as Promise<Record<string, unknown>[]>,

  getById: (sheet, id) =>
    get(sheet, 'getById', { id }) as Promise<Record<string, unknown> | null>,

  create: (sheet, data) =>
    post({ action: 'create', resource: sheet, data }) as Promise<Record<string, unknown>>,

  update: (sheet, id, data) =>
    post({ action: 'update', resource: sheet, id, data }) as Promise<Record<string, unknown>>,

  delete: async (sheet, id) => {
    await post({ action: 'delete', resource: sheet, id })
  },
}
