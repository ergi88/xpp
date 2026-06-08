const UNIT_PATTERN = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s+in\s+([a-zA-Z]+)$/i

const LENGTH_IN_METERS: Record<string, number> = {
  m: 1, meter: 1, meters: 1,
  cm: 0.01, centimeter: 0.01, centimeters: 0.01,
  mm: 0.001, millimeter: 0.001, millimeters: 0.001,
  km: 1000, kilometer: 1000, kilometers: 1000,
  in: 0.0254, inch: 0.0254, inches: 0.0254,
  ft: 0.3048, foot: 0.3048, feet: 0.3048,
  mi: 1609.344, mile: 1609.344, miles: 1609.344,
}

export function convertUnits(input: string): string | null {
  const match = input.match(UNIT_PATTERN)
  if (!match) return null

  const value = parseFloat(match[1])
  const srcUnit = match[2].toLowerCase()
  const destUnit = match[3].toLowerCase()

  const srcFactor = LENGTH_IN_METERS[srcUnit]
  const destFactor = LENGTH_IN_METERS[destUnit]
  if (!srcFactor || !destFactor) return null

  const result = (value * srcFactor) / destFactor
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(result)
  return `${formatted} ${match[3]}`
}
