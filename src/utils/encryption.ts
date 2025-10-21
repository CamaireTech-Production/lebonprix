import CryptoJS from 'crypto-js';

// Encryption utility for sensitive data
export class SecureEncryption {
  private static readonly ALGORITHM = 'AES';
  private static readonly KEY_SIZE = 256;
  
  /**
   * Generate a secure encryption key based on user ID and environment
   */
  private static generateKey(userId: string): string {
    const baseKey = process.env.REACT_APP_ENCRYPTION_KEY || 'default-encryption-key';
    const userKey = `${userId}-${baseKey}`;
    return CryptoJS.SHA256(userKey).toString();
  }

  /**
   * Encrypt sensitive data (API keys, tokens, etc.)
   */
  static encrypt(data: string, userId: string): string {
    try {
      const key = this.generateKey(userId);
      const encrypted = CryptoJS.AES.encrypt(data, key).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string, userId: string): string {
    try {
      // Check if data is already decrypted (plain text)
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data');
      }

      // Check if data looks like it's already plain text (not base64 encoded)
      if (!encryptedData.includes('=') && !encryptedData.includes('/') && !encryptedData.includes('+')) {
        console.log('Data appears to be plain text, returning as-is');
        return encryptedData;
      }

      const key = this.generateKey(userId);
      const bytes = CryptoJS.AES.decrypt(encryptedData, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        // If decryption fails, check if it's already plain text
        console.log('Decryption failed, checking if data is already plain text');
        return encryptedData;
      }
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      // If decryption fails, return the original data (might be plain text)
      console.log('Returning original data as fallback');
      return encryptedData;
    }
  }

  /**
   * Hash data for verification (one-way)
   */
  static hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  static generateHmacSignature(payload: string, secret: string): string {
    return CryptoJS.HmacSHA256(payload, secret).toString();
  }

  /**
   * Verify HMAC signature
   */
  static verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = this.generateHmacSignature(payload, secret);
      return CryptoJS.timingSafeEqual(
        CryptoJS.enc.Hex.parse(signature),
        CryptoJS.enc.Hex.parse(expectedSignature)
      );
    } catch (error) {
      console.error('HMAC verification failed:', error);
      return false;
    }
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   */
  static sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveFields = ['apiKey', 'apikey', 'password', 'token', 'secret', 'key'];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}

// Input validation utility
export class PaymentValidator {
  /**
   * Validate payment amount
   */
  static validateAmount(amount: number): boolean {
    return (
      typeof amount === 'number' &&
      !isNaN(amount) &&
      amount > 0 &&
      amount <= 1000000 && // Max 1,000,000 XAF
      Number.isInteger(amount * 100) // Ensure no more than 2 decimal places
    );
  }

  /**
   * Validate currency code
   */
  static validateCurrency(currency: string): boolean {
    const allowedCurrencies = ['XAF'];
    return allowedCurrencies.includes(currency);
  }

  /**
   * Validate transaction ID
   */
  static validateTransactionId(transactionId: string): boolean {
    return (
      typeof transactionId === 'string' &&
      transactionId.length > 0 &&
      transactionId.length <= 100 &&
      /^[a-zA-Z0-9_-]+$/.test(transactionId) // Alphanumeric, underscore, hyphen only
    );
  }

  /**
   * Validate customer information
   */
  static validateCustomerInfo(customerInfo: any): boolean {
    if (!customerInfo || typeof customerInfo !== 'object') {
      return false;
    }

    const requiredFields = ['name', 'phone', 'email', 'address', 'city', 'country'];
    
    for (const field of requiredFields) {
      if (!customerInfo[field] || typeof customerInfo[field] !== 'string') {
        return false;
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      return false;
    }

    // Validate phone format (basic international format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(customerInfo.phone)) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize input data
   */
  static sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      // Remove potentially dangerous characters
      return data.replace(/[<>\"'&]/g, '');
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Validate complete payment data
   */
  static validatePaymentData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validateAmount(data.amount)) {
      errors.push('Invalid payment amount');
    }

    if (!this.validateCurrency(data.currency)) {
      errors.push('Invalid currency code');
    }

    if (!this.validateTransactionId(data.transactionId)) {
      errors.push('Invalid transaction ID');
    }

    if (!this.validateCustomerInfo(data.customerInfo)) {
      errors.push('Invalid customer information');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
