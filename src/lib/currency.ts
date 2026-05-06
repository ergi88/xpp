import type { Account, AccountType, Currency } from '@/types'

export const ASSET_ACCOUNT_TYPES: AccountType[] = ['bank', 'cash', 'crypto']

export function isAssetAccountType(type: AccountType): boolean {
    return ASSET_ACCOUNT_TYPES.includes(type)
}

export function getCurrencyMap(currencies: Currency[]): Map<string, Currency> {
    return new Map(currencies.map((currency) => [currency.id, currency]))
}

export function getBaseCurrency(currencies: Currency[]): Currency | undefined {
    return currencies.find((currency) => currency.isBase) ?? currencies[0]
}

export function enrichAccountWithCurrency(
    account: Account,
    currencyMap: Map<string, Currency>,
): Account {
    return {
        ...account,
        currency: currencyMap.get(account.currencyId),
    }
}

export function enrichAccountsWithCurrencies(
    accounts: Account[],
    currencies: Currency[],
): Account[] {
    const currencyMap = getCurrencyMap(currencies)
    return accounts.map((account) => enrichAccountWithCurrency(account, currencyMap))
}

export function isBaseCurrencyAccount(
    account: Pick<Account, 'currencyId'>,
    baseCurrency?: Pick<Currency, 'id'>,
): boolean {
    return !!baseCurrency && account.currencyId === baseCurrency.id
}
