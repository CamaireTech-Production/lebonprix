/**
 * Phone number normalization utilities
 * Centralized functions for phone number formatting and validation
 */

import { DEFAULT_COUNTRY_CODE, DEFAULT_COUNTRY_CODE_DIGITS, CAMEROON_PHONE_RULES } from '../../config/phoneConfig';

// Maximum phone number length (international standard: 15 digits)
const MAX_PHONE_DIGITS = 15;

/**
 * Normalizes a phone number to standard format with country code
 * 
 * Handles multiple input formats:
 * - +237XXXXXXXXX (already normalized)
 * - 237XXXXXXXXX (country code without +)
 * - 0XXXXXXXXX (local format with leading zero)
 * - XXXXXXXXX (9 digits, assumed Cameroon)
 * - International numbers (preserves existing country code)
 * 
 * @param phone - Phone number to normalize
 * @param defaultCountryCode - Default country code if not present (default: '+237')
 * @returns Normalized phone number in format +237XXXXXXXXX or original format if international
 */
export const normalizePhoneNumber = (
  phone: string | null | undefined,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE
): string => {
  // Handle empty/null values
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove all non-digit characters except +
  let cleaned = phone.trim();

  // If empty after cleaning, return empty
  if (!cleaned) {
    return '';
  }

  // Remove all non-digit characters
  const digitsOnly = cleaned.replace(/\D/g, '');

  // If no digits, return empty
  if (!digitsOnly) {
    return '';
  }

  // Check if it's already an international number (starts with country code)
  // Check for Cameroon first
  if (digitsOnly.startsWith(DEFAULT_COUNTRY_CODE_DIGITS)) {
    // Already has Cameroon country code
    const numberPart = digitsOnly.substring(DEFAULT_COUNTRY_CODE_DIGITS.length);
    // Remove leading zeros from number part
    const cleanNumber = numberPart.replace(/^0+/, '');
    // Validate length
    if (cleanNumber.length === CAMEROON_PHONE_RULES.numberLength) {
      return `${defaultCountryCode}${cleanNumber}`;
    }
  }

  // Enforce maximum length (15 digits is international standard)
  const MAX_PHONE_DIGITS = 15;
  if (digitsOnly.length > MAX_PHONE_DIGITS) {
    // Truncate to maximum length
    digitsOnly = digitsOnly.slice(0, MAX_PHONE_DIGITS);
  }

  // Check for other country codes (2-3 digit country codes)
  // If number is longer than 11 digits, it likely has a country code
  if (digitsOnly.length > 11) {
    // Try to detect if it's an international number
    // Common country codes: 1, 7, 20-99, 200-999
    // If it starts with a known pattern, preserve it
    if (digitsOnly.length >= 10 && digitsOnly.length <= MAX_PHONE_DIGITS) {
      // Check if it starts with a common international pattern
      // For now, if it's clearly international (starts with 1, 2-9, etc.), preserve it
      // This is a simple heuristic - can be enhanced with a country code list
      const firstDigit = digitsOnly[0];
      
      // US/Canada (+1)
      if (firstDigit === '1' && digitsOnly.length === 11) {
        return `+${digitsOnly}`;
      }
      
      // Other common patterns - if it doesn't look like a local Cameroon number, preserve
      // This is conservative - we'll normalize Cameroon numbers, preserve others
    }
  }

  // Handle local Cameroon formats
  // Remove leading zeros
  let cleanNumber = digitsOnly.replace(/^0+/, '');

  // If it's 9 digits, assume it's a Cameroon number
  if (cleanNumber.length === CAMEROON_PHONE_RULES.numberLength) {
    // Validate it starts with valid prefix
    const firstDigit = cleanNumber[0];
    if (CAMEROON_PHONE_RULES.validPrefixes.includes(firstDigit as typeof CAMEROON_PHONE_RULES.validPrefixes[number])) {
      return `${defaultCountryCode}${cleanNumber}`;
    }
  }

  // If it's less than 9 digits, might be incomplete - still normalize
  if (cleanNumber.length < CAMEROON_PHONE_RULES.numberLength) {
    return `${defaultCountryCode}${cleanNumber}`;
  }

  // If it's more than 9 digits but doesn't match international pattern,
  // assume it's a Cameroon number with extra digits (take last 9)
  // But only if total length doesn't exceed international standard
  if (cleanNumber.length > CAMEROON_PHONE_RULES.numberLength) {
    // If the number is too long, it's likely invalid - truncate to reasonable length
    if (cleanNumber.length > MAX_PHONE_DIGITS - DEFAULT_COUNTRY_CODE_DIGITS.length) {
      // Truncate to last valid 9 digits for Cameroon
      cleanNumber = cleanNumber.slice(-CAMEROON_PHONE_RULES.numberLength);
    }
    
    const lastNine = cleanNumber.slice(-CAMEROON_PHONE_RULES.numberLength);
    const firstDigit = lastNine[0];
    if (CAMEROON_PHONE_RULES.validPrefixes.includes(firstDigit as typeof CAMEROON_PHONE_RULES.validPrefixes[number])) {
      return `${defaultCountryCode}${lastNine}`;
    }
  }

  // Fallback: add country code if not present
  if (!cleanNumber.startsWith(DEFAULT_COUNTRY_CODE_DIGITS)) {
    return `${defaultCountryCode}${cleanNumber}`;
  }

  return `${defaultCountryCode}${cleanNumber}`;
};

/**
 * Formats phone number for WhatsApp URL
 * Returns digits only (no +) for wa.me URLs
 * 
 * @param phone - Phone number to format
 * @returns Phone number in format 237XXXXXXXXX (digits only)
 */
export const formatPhoneForWhatsApp = (phone: string | null | undefined): string => {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return '';
  }
  // Remove + and return digits only
  return normalized.replace(/\D/g, '');
};

/**
 * Validates if a phone number is a valid Cameroon number
 * 
 * @param phone - Phone number to validate
 * @returns true if valid Cameroon number, false otherwise
 */
export const validateCameroonPhone = (phone: string | null | undefined): boolean => {
  if (!phone) {
    return false;
  }

  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return false;
  }

  // Check if it starts with +237
  if (!normalized.startsWith(DEFAULT_COUNTRY_CODE)) {
    return false;
  }

  // Extract number part (after +237)
  const numberPart = normalized.substring(DEFAULT_COUNTRY_CODE.length);
  
  // Must be exactly 9 digits
  if (numberPart.length !== CAMEROON_PHONE_RULES.numberLength) {
    return false;
  }

  // Must start with valid prefix
  const firstDigit = numberPart[0];
  return CAMEROON_PHONE_RULES.validPrefixes.includes(firstDigit as typeof CAMEROON_PHONE_RULES.validPrefixes[number]);
};

/**
 * Formats phone number for display
 * Returns formatted string like +237 XX XX XX XX
 * 
 * @param phone - Phone number to format
 * @returns Formatted phone number for display
 */
export const getPhoneDisplayValue = (phone: string | null | undefined): string => {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return '';
  }

  // If it's a Cameroon number, format nicely
  if (normalized.startsWith(DEFAULT_COUNTRY_CODE)) {
    const numberPart = normalized.substring(DEFAULT_COUNTRY_CODE.length);
    if (numberPart.length === CAMEROON_PHONE_RULES.numberLength) {
      // Format as +237 XX XX XX XX
      const formatted = numberPart.match(/.{1,2}/g)?.join(' ') || numberPart;
      return `${DEFAULT_COUNTRY_CODE} ${formatted}`;
    }
  }

  // For other formats, return as is
  return normalized;
};

/**
 * Normalizes phone number for comparison (removes all non-digits)
 * Useful for finding duplicates or matching phone numbers
 * 
 * @param phone - Phone number to normalize for comparison
 * @returns Digits only string
 */
export const normalizePhoneForComparison = (phone: string | null | undefined): string => {
  if (!phone) {
    return '';
  }
  return phone.replace(/\D/g, '');
};

