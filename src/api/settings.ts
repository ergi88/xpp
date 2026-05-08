import type { Settings } from '@/types'
import { adapter } from './client'
import { setThemeValue, type Theme } from '@/hooks/use-theme'

const KEY = 'xpp_settings'
const THEME_KEY = 'theme'

const defaults: Settings = {
  auto_update_currencies: false,
  hide_amounts: false,
  lock_enabled: true,
  lock_timeout_minutes: 5,
}

async function writeToSheet(key: string, value: string): Promise<void> {
  try {
    await adapter.update('settings', key, { value })
  } catch {
    await adapter.create('settings', { id: key, key, value })
  }
}

export const settingsApi = {
  get: async (): Promise<Settings> => {
    try {
      const stored = localStorage.getItem(KEY)
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults
    } catch {
      return defaults
    }
  },

  update: async (data: Partial<Settings>): Promise<Settings> => {
    const current = await settingsApi.get()
    const updated = { ...current, ...data }
    localStorage.setItem(KEY, JSON.stringify(updated))
    if (data.lock_timeout_minutes !== undefined) {
      localStorage.setItem('xpp_lock_timeout_minutes', String(data.lock_timeout_minutes))
    }
    for (const [k, v] of Object.entries(data)) {
      writeToSheet(k, String(v)).catch(() => {})
    }
    return updated
  },

  syncFromSheet: async (): Promise<void> => {
    try {
      const rows = await adapter.getAll('settings')
      const map: Record<string, string> = {}
      for (const row of rows) {
        const k = String(row.key ?? row.id ?? '')
        if (k && row.value !== undefined) map[k] = String(row.value)
      }

      if (map[THEME_KEY] === 'light' || map[THEME_KEY] === 'dark') {
        setThemeValue(map[THEME_KEY] as Theme)
      }

      const updates: Partial<Settings> = {}
      if (map.auto_update_currencies !== undefined)
        updates.auto_update_currencies = map.auto_update_currencies === 'true'
      if (map.hide_amounts !== undefined)
        updates.hide_amounts = map.hide_amounts === 'true'
      if (map.lock_enabled !== undefined)
        updates.lock_enabled = map.lock_enabled !== 'false'
      if (map.lock_timeout_minutes !== undefined)
        updates.lock_timeout_minutes = Number(map.lock_timeout_minutes)

      if (Object.keys(updates).length > 0) {
        const current = await settingsApi.get()
        const merged = { ...current, ...updates }
        localStorage.setItem(KEY, JSON.stringify(merged))
        if (updates.lock_timeout_minutes !== undefined)
          localStorage.setItem('xpp_lock_timeout_minutes', String(updates.lock_timeout_minutes))
      }
    } catch {}
  },

  syncThemeToSheet: (theme: string): void => {
    writeToSheet(THEME_KEY, theme).catch(() => {})
  },
}
