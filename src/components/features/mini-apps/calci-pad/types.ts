export interface Page {
  id: string
  title: string
  content: string
  color: string
  lastModified: string
}

export interface Currency {
  id: string
  code: string
  symbol: string
  rate: number
}

export const DEFAULT_CURRENCIES: Currency[] = [
  { id: 'usd', code: 'USD', symbol: '$', rate: 1.0 },
  { id: 'eur', code: 'EUR', symbol: '€', rate: 0.95 },
  { id: 'gbp', code: 'GBP', symbol: '£', rate: 0.82 },
  { id: 'all', code: 'ALL', symbol: 'L', rate: 95.0 },
]
