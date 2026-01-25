/**
 * Email validation utilities
 */

export interface EmailValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions?: string[];
}

/**
 * Validate email address format
 */
export function validateEmail(email: string): EmailValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
    return { isValid: false, errors, suggestions };
  }
  
  const trimmedEmail = email.trim();
  
  if (trimmedEmail.length === 0) {
    errors.push('Email cannot be empty');
    return { isValid: false, errors, suggestions };
  }
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmedEmail)) {
    errors.push('Invalid email format');
    
    // Provide suggestions for common mistakes
    if (trimmedEmail.includes(' ')) {
      suggestions.push('Remove spaces from email address');
    }
    if (!trimmedEmail.includes('@')) {
      suggestions.push('Email must contain @ symbol');
    }
    if (!trimmedEmail.includes('.')) {
      suggestions.push('Email must contain a domain (e.g., .com)');
    }
    if (trimmedEmail.includes('..')) {
      suggestions.push('Remove consecutive dots');
    }
    
    return { isValid: false, errors, suggestions };
  }
  
  // Check for common typos in popular domains
  const domain = trimmedEmail.split('@')[1]?.toLowerCase();
  const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  const commonTypos: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com'
  };
  
  if (domain && commonTypos[domain]) {
    suggestions.push(`Did you mean ${commonTypos[domain]}?`);
  }
  
  // Check for suspicious patterns
  if (trimmedEmail.length > 254) {
    errors.push('Email address is too long');
  }
  
  if (trimmedEmail.includes('..')) {
    errors.push('Email cannot contain consecutive dots');
  }
  
  if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) {
    errors.push('Email cannot start or end with a dot');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
}

/**
 * Validate multiple email addresses
 */
export function validateEmails(emails: string[]): EmailValidationResult[] {
  return emails.map(validateEmail);
}

/**
 * Check if email domain is valid (has MX record)
 * Note: This is a client-side check and doesn't actually verify MX records
 */
export function validateEmailDomain(email: string): boolean {
  const domain = email.split('@')[1];
  if (!domain) return false;
  
  // Basic domain validation
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain);
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  
  return email.trim().toLowerCase();
}

/**
 * Extract domain from email
 */
export function extractEmailDomain(email: string): string | null {
  const result = validateEmail(email);
  if (!result.isValid) {
    return null;
  }
  
  return email.split('@')[1]?.toLowerCase() || null;
}

