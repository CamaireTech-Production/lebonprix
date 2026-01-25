/**
 * Phone number validation utilities
 */

export interface PhoneValidationResult {
  isValid: boolean;
  errors: string[];
  formatted?: string;
  countryCode?: string;
  nationalNumber?: string;
}

/**
 * Validate phone number format
 */
export function validatePhone(phone: string, countryCode?: string): PhoneValidationResult {
  const errors: string[] = [];
  
  if (!phone || typeof phone !== 'string') {
    errors.push('Phone number is required');
    return { isValid: false, errors };
  }
  
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  if (cleaned.length === 0) {
    errors.push('Phone number cannot be empty');
    return { isValid: false, errors };
  }
  
  // Basic phone number regex (international format)
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  
  if (!phoneRegex.test(cleaned)) {
    errors.push('Invalid phone number format');
    return { isValid: false, errors };
  }
  
  // Check length (international numbers are typically 7-15 digits)
  if (cleaned.length < 7 || cleaned.length > 15) {
    errors.push('Phone number must be between 7 and 15 digits');
    return { isValid: false, errors };
  }
  
  // Format the phone number
  const formatted = formatPhoneNumber(cleaned, countryCode);
  
  return {
    isValid: true,
    errors: [],
    formatted,
    countryCode: extractCountryCode(cleaned),
    nationalNumber: extractNationalNumber(cleaned)
  };
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string, countryCode?: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Add country code if missing
  if (!cleaned.startsWith('+')) {
    const code = countryCode || '+1'; // Default to US
    return `${code}${cleaned}`;
  }
  
  return cleaned;
}

/**
 * Extract country code from phone number
 */
export function extractCountryCode(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  if (cleaned.startsWith('+')) {
    // Common country codes
    if (cleaned.startsWith('+1')) return '+1';
    if (cleaned.startsWith('+33')) return '+33';
    if (cleaned.startsWith('+44')) return '+44';
    if (cleaned.startsWith('+49')) return '+49';
    if (cleaned.startsWith('+39')) return '+39';
    if (cleaned.startsWith('+34')) return '+34';
    if (cleaned.startsWith('+237')) return '+237'; // Cameroon
    if (cleaned.startsWith('+234')) return '+234'; // Nigeria
    if (cleaned.startsWith('+225')) return '+225'; // Ivory Coast
    
    // Generic extraction for other codes
    const match = cleaned.match(/^\+(\d{1,3})/);
    return match ? `+${match[1]}` : '+1';
  }
  
  return '+1'; // Default to US
}

/**
 * Extract national number (without country code)
 */
export function extractNationalNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  
  if (cleaned.startsWith('+')) {
    const countryCode = extractCountryCode(cleaned);
    return cleaned.substring(countryCode.length);
  }
  
  return cleaned;
}

/**
 * Validate multiple phone numbers
 */
export function validatePhones(phones: string[], countryCode?: string): PhoneValidationResult[] {
  return phones.map(phone => validatePhone(phone, countryCode));
}

/**
 * Check if phone number is from a specific country
 */
export function isPhoneFromCountry(phone: string, countryCode: string): boolean {
  const extractedCode = extractCountryCode(phone);
  return extractedCode === countryCode;
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }
  
  return phone.replace(/[\s\-\(\)\.]/g, '');
}

/**
 * Check if phone number is valid for WhatsApp
 */
export function isWhatsAppCompatible(phone: string): boolean {
  const result = validatePhone(phone);
  if (!result.isValid) {
    return false;
  }
  
  // WhatsApp requires international format
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return cleaned.startsWith('+');
}

