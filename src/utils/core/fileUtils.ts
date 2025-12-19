/**
 * Utility functions for file name sanitization and generation
 */

/**
 * Sanitizes a string to be used as a filename
 * - Normalizes Unicode characters (removes accents)
 * - Removes invalid filesystem characters
 * - Keeps spaces (does not replace with hyphens)
 * - Converts to lowercase for consistency
 * - Trims leading/trailing spaces
 * 
 * @param text - The text to sanitize
 * @returns Sanitized filename-safe string with spaces
 */
export const sanitizeFileName = (text: string): string => {
  if (!text) return '';
  
  return text
    .normalize('NFD') // Normalize Unicode characters (é → e + ́)
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filesystem characters
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .toLowerCase() // Convert to lowercase for consistency
    .trim(); // Trim leading/trailing spaces
};

/**
 * Generates a formatted invoice filename
 * Format: "merci à {customerName} d'avoir commandé chez {companyName}.pdf"
 * 
 * @param customerName - Name of the customer
 * @param companyName - Name of the company
 * @returns Formatted and sanitized filename with .pdf extension
 */
export const generateInvoiceFileName = (
  customerName: string,
  companyName: string
): string => {
  // Handle empty/null values with fallbacks
  const safeCustomerName = customerName?.trim() || 'Client';
  const safeCompanyName = companyName?.trim() || 'Notre Entreprise';
  
  // Sanitize both names
  const sanitizedCustomer = sanitizeFileName(safeCustomerName);
  const sanitizedCompany = sanitizeFileName(safeCompanyName);
  
  // Generate the filename with spaces instead of hyphens
  const filename = `merci à ${sanitizedCustomer} d'avoir commandé chez ${sanitizedCompany}`;
  
  // Limit filename length (max 200 chars including extension)
  const maxLength = 200 - 4; // 4 for ".pdf"
  const truncatedFilename = filename.length > maxLength 
    ? filename.substring(0, maxLength) 
    : filename;
  
  return `${truncatedFilename}.pdf`;
};

