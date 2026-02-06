/**
 * Phone number normalization utilities
 * Centralized functions for phone number formatting and validation
 */

import { DEFAULT_COUNTRY, COUNTRIES, Country } from '../../config/phoneConfig';

/**
 * Helper to find country from a phone number string (e.g. +237...)
 */
export const getCountryFromPhone = (phone: string | null | undefined): Country => {
  if (!phone) return DEFAULT_COUNTRY;
  const cleaned = phone.trim();

  // Check exact country code match
  const found = COUNTRIES.find(c => cleaned.startsWith(c.code));
  if (found) return found;

  // If no + prefix, maybe it starts with 237 directly?
  const foundWithoutPlus = COUNTRIES.find(c => cleaned.startsWith(c.code.substring(1)));
  if (foundWithoutPlus) return foundWithoutPlus;

  return DEFAULT_COUNTRY;
};

/**
 * Formats a number string based on the country format mask.
 * @param numberDigits - The digits of the LOCAL number (without country code)
 * @param country - The country object
 */
export const formatPhoneDigits = (numberDigits: string, country: Country = DEFAULT_COUNTRY): string => {
  let formatted = '';
  let digitIndex = 0;

  for (let i = 0; i < country.format.length; i++) {
    if (digitIndex >= numberDigits.length) break;

    if (country.format[i] === '#') {
      formatted += numberDigits[digitIndex];
      digitIndex++;
    } else {
      // It's a separator (space, dash, etc)
      // Only add separator if we have more digits coming
      if (digitIndex < numberDigits.length) {
        formatted += country.format[i];
      }
    }
  }
  return formatted;
};

/**
 * Normalizes a phone number to standard format with country code
 * @returns Normalized E.164-like format (e.g. +237699887766)
 */
export const normalizePhoneNumber = (
  phone: string | null | undefined,
  defaultCountryCode: string = DEFAULT_COUNTRY.code
): string => {
  if (!phone || typeof phone !== 'string') return '';

  let cleaned = phone.trim();
  if (!cleaned) return '';

  // Return empty if no digits
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (!digitsOnly) return '';

  // Check if it already has a country code from our supported list
  // try to match with + first
  if (cleaned.startsWith('+')) {
    const matchedCountry = COUNTRIES.find(c => cleaned.startsWith(c.code));
    if (matchedCountry) {
      // It's a valid supported international number
      // We should just clean it up (remove spaces/dashes)
      // Keep the + and the country code, then the rest digits
      const codeDigits = matchedCountry.code.replace('+', '');
      // Remove the code digits from the start of digitsOnly to get the local part
      // But wait, digitsOnly includes the code digits.
      if (digitsOnly.startsWith(codeDigits)) {
        return `+${digitsOnly}`;
      }
    }
    // If + but not in our list, just return +digits
    return `+${digitsOnly}`;
  }

  // If no +, check if it starts with digits of a known country code (heuristic)
  // e.g. 237xxxxxxxxx
  // Only do this if length is sufficient (> numberLength + codeLength)
  // Simple heuristic: check default country code first.
  const defaultCountry = COUNTRIES.find(c => c.code === defaultCountryCode) || DEFAULT_COUNTRY;
  const defaultCodeDigits = defaultCountry.code.replace('+', '');

  if (digitsOnly.startsWith(defaultCodeDigits)) {
    // If the length without code matches valid length
    const localPart = digitsOnly.substring(defaultCodeDigits.length).replace(/^0+/, ''); // also strip potential leading zero if user typed 23706...
    if (defaultCountry.digits.includes(localPart.length)) {
      return `${defaultCountry.code}${localPart}`;
    }
  }

  // Assume local number and prepend default country code
  // Strip leading zero first (common in French countries: 06...)
  const localPart = digitsOnly.replace(/^0+/, '');
  return `${defaultCountryCode}${localPart}`;
};

/**
 * Validates a phone number based on its country rules or provided country.
 */
export const validatePhoneNumber = (phone: string, country: Country): boolean => {
  if (!phone) return false;

  // Normalize to digits only
  const allDigits = phone.replace(/\D/g, '');
  const codeDigits = country.code.replace(/\D/g, '');

  let localDigits = allDigits;

  // If starts with country code, strip it
  if (allDigits.startsWith(codeDigits)) {
    localDigits = allDigits.substring(codeDigits.length);
  }

  // Check length against supported lengths (local part)
  if (!country.digits.includes(localDigits.length)) {
    return false;
  }

  // Check prefix if defined
  if (country.prefixes && country.prefixes.length > 0) {
    return country.prefixes.some(prefix => localDigits.startsWith(prefix));
  }

  return true;
};

/**
 * Validates if the phone number starts with a valid prefix for the country
 * @param phone - The local phone digits
 * @param country - The country configuration
 */
export const validatePhonePrefix = (phone: string, country: Country): boolean => {
  if (!phone || !country.prefixes || country.prefixes.length === 0) return true;

  // Normalize to digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return true; // Allow empty or partial

  // Should strict check? 
  // If digits length is less than prefix length (e.g. typed "6"), we can check if any prefix starts with it
  // But usually prefixes are short (1-2 chars).
  // If user typed "6", and prefixes are "6" or "2", it matches.
  // If user typed "5", it doesn't match.

  // Logic: Check if the current digits START with one of the prefixes OR if one of the prefixes STARTS with current digits (partial match)
  return country.prefixes.some(prefix => {
    return digits.startsWith(prefix) || prefix.startsWith(digits);
  });
};


/**
 * @deprecated Use validatePhoneNumber with appropriate country instead
 * Kept for backward compatibility
 */
export const validateCameroonPhone = (phone: string | null | undefined): boolean => {
  if (!phone) return false;
  const normalized = normalizePhoneNumber(phone, '+237');
  if (!normalized.startsWith('+237')) return false;

  const localPart = normalized.substring(4);
  const cameroon = COUNTRIES.find(c => c.code === '+237');
  return !!cameroon?.digits.includes(localPart.length);
};

export const formatPhoneForWhatsApp = (phone: string | null | undefined): string => {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';
  return normalized.replace(/\D/g, '');
};

export const getPhoneDisplayValue = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const normalized = normalizePhoneNumber(phone);
  const country = getCountryFromPhone(normalized);

  // Remove country code from normalized string
  const codeDigits = country.code.replace('+', '');
  const digitsOnly = normalized.replace(/\D/g, '');

  if (digitsOnly.startsWith(codeDigits)) {
    const localDigits = digitsOnly.substring(codeDigits.length);
    return `${country.code} ${formatPhoneDigits(localDigits, country)}`;
  }

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
