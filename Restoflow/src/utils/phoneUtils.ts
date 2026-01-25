// Phone utilities for Restoflow

/**
 * Normalize a phone number by removing spaces and special characters
 */
export const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return '';

  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');

  // Handle Cameroon numbers
  if (normalized.startsWith('237')) {
    normalized = '+' + normalized;
  } else if (normalized.startsWith('6') && normalized.length === 9) {
    // Cameroon mobile without country code
    normalized = '+237' + normalized;
  } else if (normalized.length === 9 && /^\d{9}$/.test(normalized)) {
    // Assume Cameroon if 9 digits
    normalized = '+237' + normalized;
  } else if (!normalized.startsWith('+') && normalized.length > 9) {
    // Add + if missing for international numbers
    normalized = '+' + normalized;
  }

  return normalized;
};

/**
 * Format a phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';

  const normalized = normalizePhoneNumber(phone);

  // Format Cameroon numbers: +237 6XX XXX XXX
  if (normalized.startsWith('+237')) {
    const local = normalized.slice(4);
    if (local.length === 9) {
      return `+237 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
    }
  }

  // Return as-is for other formats
  return normalized;
};

/**
 * Validate a phone number
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  if (!phone) return false;

  const normalized = normalizePhoneNumber(phone);

  // Check Cameroon format
  if (normalized.startsWith('+237')) {
    const local = normalized.slice(4);
    // Cameroon mobile numbers start with 6 and have 9 digits
    return /^6\d{8}$/.test(local);
  }

  // Basic international format validation
  return /^\+\d{10,15}$/.test(normalized);
};

/**
 * Get country code from phone number
 */
export const getCountryCode = (phone: string): string | null => {
  const normalized = normalizePhoneNumber(phone);

  if (normalized.startsWith('+237')) return 'CM';
  if (normalized.startsWith('+33')) return 'FR';
  if (normalized.startsWith('+1')) return 'US';
  if (normalized.startsWith('+44')) return 'GB';

  return null;
};

/**
 * Compare two phone numbers for equality
 */
export const phoneNumbersEqual = (phone1: string, phone2: string): boolean => {
  return normalizePhoneNumber(phone1) === normalizePhoneNumber(phone2);
};

/**
 * Extract local number without country code
 */
export const getLocalNumber = (phone: string): string => {
  const normalized = normalizePhoneNumber(phone);

  if (normalized.startsWith('+237')) {
    return normalized.slice(4);
  }

  // Remove + and first 1-3 digits for other country codes
  return normalized.replace(/^\+\d{1,3}/, '');
};

/**
 * Generate a WhatsApp link for a phone number
 */
export const getWhatsAppLink = (phone: string, message?: string): string => {
  const normalized = normalizePhoneNumber(phone).replace('+', '');
  const baseUrl = `https://wa.me/${normalized}`;

  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }

  return baseUrl;
};

/**
 * Generate a tel: link for a phone number
 */
export const getTelLink = (phone: string): string => {
  return `tel:${normalizePhoneNumber(phone)}`;
};
