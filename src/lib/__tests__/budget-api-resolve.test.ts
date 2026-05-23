import { describe, it, expect } from 'vitest'
import type { Category, Tag } from '@/types'

// Inline the resolution logic to test it in isolation.
function resolveBudgetRelations(
  raw: Record<string, unknown>,
  categoriesById: Map<string, Category>,
  tagsById: Map<string, Tag>,
) {
  const categoryIds = String(raw.category_ids ?? '').split(',').filter(Boolean)
  const tagIds = String(raw.tag_ids ?? '').split(',').filter(Boolean)
  return {
    categories: categoryIds.map(id => categoriesById.get(id)).filter(Boolean) as Category[],
    tags: tagIds.map(id => tagsById.get(id)).filter(Boolean) as Tag[],
  }
}

const catA: Category = { id: 'cat-a', name: 'Food', type: 'expense', icon: 'utensils', color: '#f00', createdAt: undefined }
const catB: Category = { id: 'cat-b', name: 'Transport', type: 'expense', icon: 'car', color: '#00f', createdAt: undefined }
const tagX: Tag = { id: 'tag-x', name: 'important', createdAt: undefined }

const catMap = new Map([['cat-a', catA], ['cat-b', catB]])
const tagMap = new Map([['tag-x', tagX]])

describe('resolveBudgetRelations', () => {
  it('resolves multiple category ids from CSV', () => {
    const result = resolveBudgetRelations({ category_ids: 'cat-a,cat-b', tag_ids: '' }, catMap, tagMap)
    expect(result.categories).toHaveLength(2)
    expect(result.categories[0].id).toBe('cat-a')
    expect(result.categories[1].id).toBe('cat-b')
  })

  it('resolves tag ids', () => {
    const result = resolveBudgetRelations({ category_ids: '', tag_ids: 'tag-x' }, catMap, tagMap)
    expect(result.tags).toHaveLength(1)
    expect(result.tags[0].id).toBe('tag-x')
  })

  it('skips unknown ids silently', () => {
    const result = resolveBudgetRelations({ category_ids: 'unknown-id', tag_ids: '' }, catMap, tagMap)
    expect(result.categories).toHaveLength(0)
  })

  it('handles empty category_ids', () => {
    const result = resolveBudgetRelations({ category_ids: '', tag_ids: '' }, catMap, tagMap)
    expect(result.categories).toHaveLength(0)
    expect(result.tags).toHaveLength(0)
  })

  it('handles missing category_ids key', () => {
    const result = resolveBudgetRelations({}, catMap, tagMap)
    expect(result.categories).toHaveLength(0)
  })
})
