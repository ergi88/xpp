import type { Page, Currency } from '../types'

function key(prefix: string, name: string): string {
  return prefix ? `${prefix}_${name}` : `calci_${name}`
}

export function loadPages(prefix = ''): Page[] {
  try {
    const raw = localStorage.getItem(key(prefix, 'pages'))
    return raw ? (JSON.parse(raw) as Page[]) : []
  } catch {
    return []
  }
}

export function savePages(pages: Page[], prefix = ''): void {
  localStorage.setItem(key(prefix, 'pages'), JSON.stringify(pages))
}

export function loadCurrencies(prefix = ''): Currency[] {
  try {
    const raw = localStorage.getItem(key(prefix, 'currencies'))
    return raw ? (JSON.parse(raw) as Currency[]) : []
  } catch {
    return []
  }
}

export function saveCurrencies(currencies: Currency[], prefix = ''): void {
  localStorage.setItem(key(prefix, 'currencies'), JSON.stringify(currencies))
}

export function loadPrecision(prefix = ''): number {
  try {
    const raw = localStorage.getItem(key(prefix, 'precision'))
    return raw ? parseInt(raw, 10) : 0
  } catch {
    return 0
  }
}

export function savePrecision(precision: number, prefix = ''): void {
  localStorage.setItem(key(prefix, 'precision'), String(precision))
}

export function loadActivePageId(prefix = ''): string | null {
  return localStorage.getItem(key(prefix, 'active_page_id'))
}

export function saveActivePageId(id: string, prefix = ''): void {
  localStorage.setItem(key(prefix, 'active_page_id'), id)
}
