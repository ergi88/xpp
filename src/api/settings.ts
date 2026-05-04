import type { Settings } from '@/types'

const KEY = 'xpp_settings'

const defaults: Settings = {
  auto_update_currencies: false,
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
    return updated
  },
}
