export type CurrencyPosition = 'prefix' | 'suffix'
export type AmountSignDisplay = 'auto' | 'always' | 'never'

export interface FormatMoneyOptions {
    value: number
    decimals?: number
    currency?: string
    currencyPosition?: CurrencyPosition
    showCurrency?: boolean
    useGrouping?: boolean
    absolute?: boolean
    signDisplay?: AmountSignDisplay
}

export function formatNumber(
    value: number,
    decimals: number = 2,
    useGrouping: boolean = true,
): string {
    return new Intl.NumberFormat('en-US', {
        useGrouping,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value)
}

export function formatMoney({
    value,
    decimals = 2,
    currency = '',
    currencyPosition = 'suffix',
    showCurrency = true,
    useGrouping = true,
    absolute = false,
    signDisplay = 'auto',
}: FormatMoneyOptions): string {
    const normalizedValue = absolute ? Math.abs(value) : value
    const numberText = formatNumber(Math.abs(normalizedValue), decimals, useGrouping)
    const showSign = signDisplay !== 'never'
    const sign =
        showSign && value < 0 ? '-' : signDisplay === 'always' ? '+' : ''
    const currencyText = showCurrency && currency ? currency.trim() : ''

    if (!currencyText) return `${sign}${numberText}`

    if (currencyPosition === 'prefix') {
        return `${sign}${currencyText} ${numberText}`
    }

    return `${sign}${numberText} ${currencyText}`
}
