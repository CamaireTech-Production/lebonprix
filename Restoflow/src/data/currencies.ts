export const currencies = [
  { code: 'XAF', symbol: 'FCFA', label: 'Central African CFA franc (XAF)' },
  { code: 'USD', symbol: '$', label: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (GBP)' },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira (NGN)' },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling (KES)' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand (ZAR)' },
  { code: 'GHS', symbol: '₵', label: 'Ghanaian Cedi (GHS)' },
  { code: 'CAD', symbol: '$', label: 'Canadian Dollar (CAD)' },
  { code: 'AUD', symbol: '$', label: 'Australian Dollar (AUD)' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan (CNY)' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (INR)' },
];

export function getCurrencySymbol(code: string): string {
  const found = currencies.find(c => c.code === code);
  return found ? found.symbol : code;
} 