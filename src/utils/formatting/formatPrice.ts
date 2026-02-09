/**
 * Format a price amount with French number formatting (spaces every 3 digits)
 * @param amount - The amount to format (number, null, or undefined)
 * @returns Formatted string with spaces as thousand separators (e.g., "1 000 000")
 * 
 * @example
 * formatPrice(1000000) // Returns "1 000 000"
 * formatPrice(1234.56) // Returns "1 235" (rounded)
 * formatPrice(null) // Returns "0"
 */
// Default to XAF/FCFA behavior if no currency provided, or append/prepend based on locale/currency?
// For now, let's keep it simple: if currency is provided, append it.
export const formatPrice = (amount: number | null | undefined, currencySymbol: string = 'FCFA'): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `0 ${currencySymbol}`;
  }

  // toLocaleString uses non-breaking spaces (U+00A0) which can cause rendering issues
  // Replace them with regular spaces for better compatibility
  const formattedAmount = Math.round(amount).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).replace(/\u00A0/g, ' ');

  return `${formattedAmount} ${currencySymbol}`;
};


