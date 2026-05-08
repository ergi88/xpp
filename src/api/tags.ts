import { v4 as uuidv4 } from 'uuid'
import { adapter } from './client'
import type { Tag, TagFormData } from '@/types'

function toTag(r: Record<string, unknown>): Tag {
  return {
    id: r.id as string,
    name: r.name as string,
    createdAt: r.created_at as string | undefined,
  }
}

export const tagsApi = {
  getAll: async (): Promise<Tag[]> =>
    (await adapter.getAll('tags')).map(toTag),

  getById: async (id: string | number): Promise<Tag> => {
    const r = await adapter.getById('tags', String(id))
    if (!r) throw new Error('Tag not found')
    return toTag(r)
  },

  create: async (data: TagFormData): Promise<Tag> => {
    const r = await adapter.create('tags', {
      id: uuidv4(),
      name: data.name,
      created_at: new Date().toISOString(),
    })
    return toTag(r)
  },

  update: async (id: string | number, data: Partial<TagFormData>): Promise<Tag> => {
    const r = await adapter.update('tags', String(id), data as Record<string, unknown>)
    return toTag(r)
  },

  delete: (id: string | number): Promise<void> =>
    adapter.delete('tags', String(id)),
}
