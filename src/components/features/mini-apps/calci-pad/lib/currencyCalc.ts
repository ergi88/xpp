import type { Currency } from '../types'
import { preprocessExpression, safeEval } from './evaluator'

export function convertCurrency(input: string, currencies: Currency[]): string | null {
  const inIdx = input.toLowerCase().indexOf(' in ')
  if (inIdx >= 0) {
    const leftSide = input.slice(0, inIdx).trim()
    const targetCode = input.slice(inIdx + 4).trim().toUpperCase()

    const target = currencies.find(
      c => c.code === targetCode || c.symbol === targetCode
    )
    if (!target) return null

    let source: Currency | undefined
    let cleanExpr = leftSide

    for (const c of currencies) {
      if (leftSide.includes(c.symbol)) {
        source = c
        cleanExpr = leftSide.replaceAll(c.symbol, '')
        break
      }
      if (leftSide.includes(c.code)) {
        source = c
        cleanExpr = leftSide.replaceAll(c.code, '')
        break
      }
    }

    if (!source) return null

    const value = safeEval(preprocessExpression(cleanExpr.trim()))
    if (value === null) return null

    const converted = (value / source.rate) * target.rate
    return `${converted.toFixed(2)} ${target.symbol}`
  }

  for (const c of currencies) {
    if (input.includes(c.symbol) || input.includes(c.code)) {
      const cleanExpr = input.replaceAll(c.symbol, '').replaceAll(c.code, '').trim()
      const value = safeEval(preprocessExpression(cleanExpr))
      if (value === null) return null
      return `${value.toFixed(2)} ${c.symbol}`
    }
  }

  return null
}
