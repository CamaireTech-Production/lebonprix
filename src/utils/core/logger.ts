/**
 * Logger utility for development-only logging
 * All logs are automatically disabled in production
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Logs a message only in development mode
 * @param message - The message to log
 * @param data - Optional data to log (will be sanitized)
 */
export const devLog = (message: string, data?: any) => {
  if (isDevelopment) {
    // Sanitize sensitive data
    const sanitized = sanitizeData(data);
    console.log(`[DEV] ${message}`, sanitized);
  }
};

/**
 * Logs an error (always logged, even in production)
 * @param message - The error message
 * @param error - The error object (will be sanitized)
 */
export const logError = (message: string, error?: any) => {
  const sanitized = sanitizeError(error);
  console.error(`[ERROR] ${message}`, sanitized);
};

/**
 * Logs a warning (always logged, even in production)
 * @param message - The warning message
 * @param data - Optional data to log (will be sanitized)
 */
export const logWarning = (message: string, data?: any) => {
  const sanitized = sanitizeData(data);
  console.warn(`[WARN] ${message}`, sanitized);
};

/**
 * Sanitizes data to remove sensitive information
 */
function sanitizeData(data: any): any {
  if (!data) return data;
  
  if (typeof data !== 'object') return data;
  
  const sensitiveKeys = [
    'userId', 'user', 'uid', 'id', 'companyId', 'company', 
    'phone', 'email', 'password', 'token', 'sessionId', 
    'gsessionid', 'SID', 'AID', 'RID', 'templateId',
    'customerId', 'supplierId', 'employeeId', 'orderId',
    'saleId', 'productId', 'batchId', 'documentId'
  ];
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitizes error objects to remove sensitive information
 */
function sanitizeError(error: any): any {
  if (!error) return error;
  
  if (error instanceof Error) {
    // Keep error message but remove stack trace in production
    if (isDevelopment) {
      return error;
    }
    return {
      message: error.message,
      name: error.name
    };
  }
  
  return sanitizeData(error);
}

/**
 * Extracts Firestore index creation link from error message
 * @param error - The Firestore error object
 * @returns The index creation URL if found, null otherwise
 */
export function extractFirestoreIndexLink(error: any): string | null {
  if (!error) return null;
  
  const errorMessage = error?.message || error?.toString() || '';
  
  // Firestore errors typically contain a link like:
  // https://console.firebase.google.com/project/[PROJECT_ID]/firestore/indexes?create_composite=...
  const indexLinkRegex = /https:\/\/console\.firebase\.google\.com\/project\/[^\/]+\/firestore\/indexes[^\s\)]+/;
  const match = errorMessage.match(indexLinkRegex);
  
  if (match && match[0]) {
    return match[0];
  }
  
  // Also check if the link is in the error object itself
  if (error?.indexUrl) {
    return error.indexUrl;
  }
  
  return null;
}

/**
 * Logs Firestore index error with prominent link display
 * @param context - Context description (e.g., "subscribeToHRActors")
 * @param error - The Firestore error object
 */
export function logFirestoreIndexError(context: string, error: any): void {
  const indexLink = extractFirestoreIndexLink(error);
  
  console.error(`\n${'='.repeat(80)}`);
  console.error(`[FIRESTORE INDEX ERROR] ${context}`);
  console.error(`${'='.repeat(80)}`);
  
  if (indexLink) {
    console.error('\n🔗 MISSING FIRESTORE INDEX DETECTED!');
    console.error('\n📋 Click the link below to create the required index:');
    console.error(`\n${indexLink}\n`);
    console.error('💡 The index will be created automatically. This may take a few minutes.');
  } else {
    console.error('\n⚠️  Missing Firestore index detected, but no direct link found.');
    console.error('Please check the Firebase Console → Firestore → Indexes');
    if (error?.message) {
      console.error('\nError details:', error.message);
    }
  }
  
  console.error(`${'='.repeat(80)}\n`);
  
  // Also log the full error for debugging
  logError(`Firestore index error in ${context}`, error);
}