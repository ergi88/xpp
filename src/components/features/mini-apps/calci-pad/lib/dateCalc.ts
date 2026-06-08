const BASE_PATTERN = /^(now|today)/i
const OP_PATTERN = /([+-])\s*(\d+)\s*(d|day|days|w|week|weeks|mo|month|months|y|year|years)\b/gi

export function calculateDate(input: string): string | null {
  if (!BASE_PATTERN.test(input)) return null

  const matches = [...input.matchAll(OP_PATTERN)]
  if (matches.length === 0) return null

  let date = new Date()

  for (const m of matches) {
    const sign = m[1] === '-' ? -1 : 1
    const value = parseInt(m[2], 10) * sign
    const unit = m[3].toLowerCase()

    if (unit.startsWith('mo')) date = addMonths(date, value)
    else if (unit.startsWith('y')) date = addYears(date, value)
    else if (unit.startsWith('w')) date = addDays(date, value * 7)
    else if (unit.startsWith('d')) date = addDays(date, value)
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}
