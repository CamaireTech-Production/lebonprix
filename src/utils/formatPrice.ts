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
export const formatPrice = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0';
  }
  
  return Math.round(amount).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};


