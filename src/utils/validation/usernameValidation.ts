/**
 * Username validation utility
 * Validates username format and provides generation from email
 */

export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a username according to the rules:
 * - Minimum length: 3 characters
 * - Maximum length: 30 characters
 * - Allowed characters: alphanumeric, underscores, hyphens
 * - Must be unique globally (checked separately)
 * 
 * @param username - The username to validate
 * @returns Validation result with error message if invalid
 */
export const validateUsername = (username: string): UsernameValidationResult => {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'Le nom d\'utilisateur est requis' };
  }
  
  const trimmedUsername = username.trim();
  
  if (trimmedUsername.length < 3) {
    return { valid: false, error: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' };
  }
  
  if (trimmedUsername.length > 30) {
    return { valid: false, error: 'Le nom d\'utilisateur ne peut pas dépasser 30 caractères' };
  }
  
  // Only allow alphanumeric characters, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
    return { valid: false, error: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores' };
  }
  
  // Username cannot start or end with underscore or hyphen
  if (/^[_-]|[_-]$/.test(trimmedUsername)) {
    return { valid: false, error: 'Le nom d\'utilisateur ne peut pas commencer ou se terminer par un tiret ou un underscore' };
  }
  
  return { valid: true };
};

/**
 * Generates a username from an email address
 * Extracts the local part (before @) and cleans it
 * 
 * @param email - The email address to generate username from
 * @returns Generated username (max 30 characters)
 */
export const generateUsernameFromEmail = (email: string): string => {
  if (!email || !email.includes('@')) {
    // Fallback: generate a random username
    return 'user' + Date.now().toString().slice(-6);
  }
  
  const localPart = email.split('@')[0];
  // Remove all non-alphanumeric characters except underscores and hyphens
  const cleaned = localPart.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Ensure minimum length of 3
  if (cleaned.length < 3) {
    return cleaned + Date.now().toString().slice(-6);
  }
  
  // Truncate to max 30 characters
  return cleaned.substring(0, 30);
};

/**
 * Normalizes a username (trim and convert to lowercase for uniqueness checks)
 * Note: We keep the original case for display, but use lowercase for uniqueness
 * 
 * @param username - The username to normalize
 * @returns Normalized username (lowercase, trimmed)
 */
export const normalizeUsername = (username: string): string => {
  return username.trim().toLowerCase();
};

