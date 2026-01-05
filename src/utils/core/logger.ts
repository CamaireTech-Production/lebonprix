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
