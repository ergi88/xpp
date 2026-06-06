// src/lib/sheets/gas-adapter.ts
import type { DataAdapter, SheetName } from './adapter'
import { enqueue } from '@/lib/mutation-queue'

const url = () => {
  const u = localStorage.getItem('xpp_gas_url') || (import.meta.env.VITE_GAS_URL as string)
  if (!u) throw new Error('GAS URL not configured. Complete setup first.')
  return u
}

// Google Apps Script web apps respond to POST with a 302 to
// script.googleusercontent.com; fetch follows it to reach the JSON. That hop
// intermittently serves a transient HTML page (Google quota / "unable to open
// the file" / login interstitial) instead, which used to blow up `res.json()`
// with `Unexpected token '<', "<!DOCTYPE "...`. Parse the body as text first so
// we can detect that case and raise a meaningful error instead.
class TransientGasError extends Error {}

async function parseGasResponse(res: Response): Promise<{ error?: string }> {
  const text = await res.text()
  const looksLikeHtml = /^\s*<(?:!doctype|html)/i.test(text)

  if (!res.ok || looksLikeHtml) {
    throw new TransientGasError(
      `Google Sheets returned a non-JSON response (HTTP ${res.status}). ` +
        `This is usually a transient Apps Script error — please retry.`,
    )
  }

  try {
    return JSON.parse(text) as { error?: string }
  } catch {
    throw new TransientGasError(
      'Google Sheets returned an unreadable response. Please retry.',
    )
  }
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
  // Reads are idempotent — retry transient HTML responses a few times.
  return withRetry(async () => {
    const res = await fetch(u.toString())
    const json = await parseGasResponse(res)
    if (json.error) throw new Error(json.error)
    return json
  })
}

async function post(
  body: Record<string, unknown>,
  { retry = false }: { retry?: boolean } = {},
): Promise<unknown> {
  const send = async () => {
    const res = await fetch(url(), {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const json = await parseGasResponse(res)
    if (json.error) throw new Error(json.error)
    return json
  }
  // Only retry when the caller knows the write is idempotent (update/delete).
  // `create` appends a row, so retrying could duplicate it.
  return retry ? withRetry(send) : send()
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!(err instanceof TransientGasError)) throw err
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
  throw lastErr
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
    return post(
      { action: 'update', resource: sheet, id, data },
      { retry: true },
    ) as Promise<Record<string, unknown>>
  },

  delete: async (sheet, id) => {
    if (!navigator.onLine) {
      await enqueue({ sheet, action: 'delete', resourceId: id })
      return
    }
    await post({ action: 'delete', resource: sheet, id }, { retry: true })
  },
}
