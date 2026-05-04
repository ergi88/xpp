export type SheetName =
  | 'transactions'
  | 'accounts'
  | 'categories'
  | 'budgets'
  | 'tags'
  | 'recurring'
  | 'debts'
  | 'currencies'

export interface DataAdapter {
  getAll(sheet: SheetName): Promise<Record<string, unknown>[]>
  getById(sheet: SheetName, id: string): Promise<Record<string, unknown> | null>
  create(sheet: SheetName, data: Record<string, unknown>): Promise<Record<string, unknown>>
  update(sheet: SheetName, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>
  delete(sheet: SheetName, id: string): Promise<void>
}
