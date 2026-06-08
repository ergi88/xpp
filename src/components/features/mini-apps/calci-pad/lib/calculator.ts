import type { Currency } from '../types'
import { stripComments, preprocessExpression, safeEval, formatResult } from './evaluator'
import { calculateDate } from './dateCalc'
import { convertCurrency } from './currencyCalc'
import { convertUnits } from './unitCalc'

export function evaluateLine(
  line: string,
  precision: number | null,
  currencies: Currency[]
): string | null {
  const stripped = stripComments(line)
  if (!stripped) return null

  const dateResult = calculateDate(stripped)
  if (dateResult) return dateResult

  const currencyResult = convertCurrency(stripped, currencies)
  if (currencyResult) return currencyResult

  const unitResult = convertUnits(stripped)
  if (unitResult) return unitResult

  const preprocessed = preprocessExpression(stripped)
  const value = safeEval(preprocessed)
  if (value === null) return null

  return formatResult(value, precision)
}

export function evaluateText(
  text: string,
  precision: number | null,
  currencies: Currency[]
): string[] {
  return text.split('\n').map(line => evaluateLine(line, precision, currencies) ?? '')
}
