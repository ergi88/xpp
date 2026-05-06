import type { Settings } from '@/types'

const KEY = 'xpp_settings'

const defaults: Settings = {
  auto_update_currencies: false,
  hide_amounts: false,
  lock_timeout_minutes: 5,
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
    return updated
  },
}
