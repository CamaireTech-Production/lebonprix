export interface Currency {
    code: string;
    symbol: string;
    name: string;
}

export const CURRENCIES: Currency[] = [
    { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA (BEAC)' },
    { code: 'XOF', symbol: 'CFA', name: 'Franc CFA (BCEAO)' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
    { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
    { code: 'RWF', symbol: 'RF', name: 'Rwandan Franc' },
    { code: 'CDF', symbol: 'FC', name: 'Congolese Franc' },
    { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham' },
    { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
    { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' },
    { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
    { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso' },
    { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
    { code: 'AED', symbol: 'د.إ', name: 'United Arab Emirates Dirham' },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
    { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
];

export const DEFAULT_CURRENCY = CURRENCIES[0]; // XAF
