export function evaluate(expr: string): string {
  const cleaned = expr.replace(/,/g, '').trim()
  if (!cleaned) return '—'
  try {
    // eslint-disable-next-line no-new-func
    const result = Function('return ' + cleaned)()
    if (typeof result !== 'number' || !isFinite(result)) return '—'
    // Trim floating-point noise: 0.1+0.2 → 0.30000000000000004 → "0.3"
    return String(parseFloat(result.toPrecision(12)))
  } catch {
    return '—'
  }
}
