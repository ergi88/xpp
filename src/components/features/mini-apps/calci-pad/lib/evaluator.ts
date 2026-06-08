const ALLOWED_CHARS = /^[0-9.\s+\-*/()]+$/

const INVALID_SYNTAX = [
  /[+\-*/]\s*[*/]/,
  /\(\s*[*/]/,
  /[+\-*/]\s*\)/,
  /\(\s*\)/,
]

export function safeEval(expr: string): number | null {
  if (!ALLOWED_CHARS.test(expr)) return null
  for (const p of INVALID_SYNTAX) {
    if (p.test(expr)) return null
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('return ' + expr)()
    if (typeof result !== 'number' || !isFinite(result)) return null
    return result
  } catch {
    return null
  }
}

export function preprocessExpression(expr: string): string {
  let text = expr
  text = text.replace(/(?<![.\d])(\d+)(?![.\d])/g, '$1.0')
  text = text.replace(/k/g, '*1000.0')
  text = text.replace(/M/g, '*1000000.0')
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)%/g,
    '$1 $2 ($1 * $3 / 100.0)'
  )
  text = text.replace(/(\d+(?:\.\d+)?)%/g, '($1 * 0.01)')
  return text
}

export function stripComments(line: string): string {
  let end = line.length
  const si = line.indexOf('//')
  const hi = line.indexOf('#')
  if (si >= 0) end = Math.min(end, si)
  if (hi >= 0) end = Math.min(end, hi)
  return line.slice(0, end).trim()
}

export function formatResult(value: number, precision: number | null): string {
  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: precision && precision > 0 ? precision : 8,
  }).format(value)
}
