// src/lib/mutation-queue.ts
import { get, set } from 'idb-keyval'

export type QueuedMutation = {
  id: string
  sheet: string
  action: 'create' | 'update' | 'delete'
  data?: Record<string, unknown>
  resourceId?: string
  timestamp: number
}

const KEY = 'xpp-mutation-queue'

export async function getQueue(): Promise<QueuedMutation[]> {
  return (await get<QueuedMutation[]>(KEY)) ?? []
}

export async function enqueue(
  mutation: Omit<QueuedMutation, 'id' | 'timestamp'>,
): Promise<void> {
  const queue = await getQueue()
  queue.push({ ...mutation, id: crypto.randomUUID(), timestamp: Date.now() })
  await set(KEY, queue)
}

export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue()
  await set(KEY, queue.filter((m) => m.id !== id))
}

export async function clearQueue(): Promise<void> {
  await set(KEY, [])
}
