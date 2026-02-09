import { useAuth } from '@contexts/AuthContext';
import { CURRENCIES, DEFAULT_CURRENCY } from '@constants/currencies';
import { formatPrice } from '@utils/formatting/formatPrice';

export const useCurrency = (providedCurrencyCode?: string) => {
    const { company } = useAuth();

    const currencyCode = providedCurrencyCode || company?.currency || DEFAULT_CURRENCY.code;
    const currency = CURRENCIES.find(c => c.code === currencyCode) || DEFAULT_CURRENCY;

    /**
     * Formats a price with the current company currency
     * @param amount The amount to format
     * @returns Formatted string with currency symbol
     */
    const format = (amount: number | null | undefined) => {
        return formatPrice(amount, currency.symbol);
    };

    return {
        currency,
        format,
        symbol: currency.symbol
    };
};
