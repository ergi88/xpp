import type { DataAdapter } from './adapter'

async function loadAdapter(): Promise<DataAdapter> {
  const type = import.meta.env.VITE_ADAPTER ?? 'gas'
  if (type === 'gas') {
    const { gasAdapter } = await import('./gas-adapter')
    return gasAdapter
  }
  throw new Error(`Unknown adapter: ${type}`)
}

export const adapter: DataAdapter = new Proxy({} as DataAdapter, {
  get(_target, prop) {
    return async (...args: unknown[]) => {
      const a = await loadAdapter()
      return (a[prop as keyof DataAdapter] as (...a: unknown[]) => unknown)(...args)
    }
  },
})
