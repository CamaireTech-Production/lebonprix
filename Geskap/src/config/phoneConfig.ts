/**
 * Phone number configuration
 * Centralized configuration for phone number handling
 */

export const DEFAULT_COUNTRY_CODE = '+237';
export const DEFAULT_COUNTRY_CODE_DIGITS = '237';

/**
 * Cameroon phone number validation rules
 */
export const CAMEROON_PHONE_RULES = {
  // Valid prefixes for Cameroon mobile numbers
  validPrefixes: ['6', '7', '8', '9'],
  // Length after country code
  numberLength: 9,
  // Full length with country code
  fullLength: 12, // +237 + 9 digits
} as const;

