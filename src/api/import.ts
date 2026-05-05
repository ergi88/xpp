import Papa from 'papaparse'
import { transactionsApi } from './transactions'
import { categoriesApi } from './categories'
import { tagsApi } from './tags'
import type {
  CsvParseResult,
  ColumnMapping,
  ImportOptions,
  ImportPreviewResult,
  ImportResult,
} from '@/types/import'

const parsedCache = new Map<string, { headers: string[]; rows: string[][] }>()

export const importApi = {
  parse: (file: File): Promise<CsvParseResult> =>
    new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (result) => {
          const all = result.data as string[][]
          if (all.length === 0) return reject(new Error('Empty file'))
          const headers = all[0]
          const previewRows = all.slice(1, 6)
          const importId = crypto.randomUUID()
          parsedCache.set(importId, { headers, rows: all.slice(1) })
          resolve({
            importId,
            headers,
            previewRows,
            totalRows: all.length - 1,
            detectedFormats: {
              dateFormat: 'ISO',
              amountFormat: 'US',
              hasHeader: true,
              delimiter: ',',
            },
            suggestedMapping: {},
          })
        },
        error: reject,
      })
    }),

  preview: async (
    importId: string,
    mapping: ColumnMapping,
    options: ImportOptions,
  ): Promise<ImportPreviewResult> => {
    const cached = parsedCache.get(importId)
    if (!cached) throw new Error('Import session expired')
    const preview = cached.rows.slice(0, 20).map((row, i) => ({
      row: i + 2,
      date: row[mapping.date] ?? '',
      type: mapping.type !== null ? (row[mapping.type] ?? options.defaultType ?? 'expense') : (options.defaultType ?? 'expense'),
      amount: parseFloat(row[mapping.amount] ?? '0') || 0,
      description: mapping.description !== null ? (row[mapping.description] ?? null) : null,
      category: mapping.category !== null ? (row[mapping.category] ?? null) : null,
      tags: [] as string[],
      status: 'new' as const,
      duplicateOf: null,
      warnings: [] as string[],
      error: null,
    }))
    return {
      previewTransactions: preview,
      summary: {
        willCreate: preview.length,
        willSkip: 0,
        hasErrors: 0,
        currenciesToCreate: [],
        tagsToCreate: [],
        categoriesToCreate: [],
      },
    }
  },

  import: async (
    importId: string,
    mapping: ColumnMapping,
    options: ImportOptions,
  ): Promise<ImportResult> => {
    const cached = parsedCache.get(importId)
    if (!cached) throw new Error('Import session expired')

    const [categories, tags] = await Promise.all([
      categoriesApi.getAll(),
      tagsApi.getAll(),
    ])
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
    const tagMap = new Map(tags.map(t => [t.name.toLowerCase(), t.id]))

    let created = 0
    const errors: { row: number; message: string }[] = []

    const rows = options.skipFirstRow ? cached.rows.slice(1) : cached.rows

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      try {
        const date = row[mapping.date]
        const amountRaw = row[mapping.amount]
        const amount = parseFloat(amountRaw)
        if (!date || isNaN(amount)) throw new Error('Missing date or amount')

        const typeRaw = mapping.type !== null
          ? row[mapping.type]
          : options.defaultType ?? 'expense'

        const categoryName = mapping.category !== null
          ? row[mapping.category]?.toLowerCase()
          : undefined
        const categoryId = categoryName ? categoryMap.get(categoryName) : undefined

        await transactionsApi.create({
          type: (typeRaw as 'income' | 'expense') ?? 'expense',
          account_id: String(options.defaultAccountId),
          category_id: categoryId as unknown as string | undefined,
          amount: Math.abs(amount),
          date,
          description: mapping.description !== null
            ? row[mapping.description]
            : undefined,
        })
        created++
      } catch (err) {
        errors.push({ row: rowNum, message: String(err) })
      }
    }

    parsedCache.delete(importId)
    return {
      created,
      skippedDuplicates: 0,
      errors,
      createdCurrencies: [],
      createdTags: [],
      createdCategories: [],
    }
  },
}
