import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const val = await get<string>(key)
    return val ?? null
  },
  setItem: (key: string, value: string): Promise<void> => set(key, value),
  removeItem: (key: string): Promise<void> => del(key),
}

export const persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'xpp-query-cache',
})
