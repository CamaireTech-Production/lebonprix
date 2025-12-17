import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Audit logging utility for security and compliance
 */
export class AuditLogger {
  private static readonly COLLECTION_NAME = 'auditLogs';

  /**
   * Log payment-related events
   */
  static async logPaymentEvent(
    userId: string,
    event: string,
    details: {
      orderId?: string;
      transactionId?: string;
      amount?: number;
      currency?: string;
      status?: string;
      error?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      await addDoc(collection(db, this.COLLECTION_NAME), {
        userId,
        event,
        category: 'payment',
        details: this.sanitizeDetails(details),
        timestamp: serverTimestamp(),
        ipAddress: details.ipAddress || 'unknown',
        userAgent: details.userAgent || 'unknown'
      });
    } catch (error) {
      console.error('Failed to log payment event:', error);
    }
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(
    userId: string,
    event: string,
    details: {
      action: string;
      resource?: string;
      ipAddress?: string;
      userAgent?: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<void> {
    try {
      await addDoc(collection(db, this.COLLECTION_NAME), {
        userId,
        event,
        category: 'security',
        details: this.sanitizeDetails(details),
        timestamp: serverTimestamp(),
        ipAddress: details.ipAddress || 'unknown',
        userAgent: details.userAgent || 'unknown',
        severity: details.severity
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Log configuration changes
   */
  static async logConfigChange(
    userId: string,
    event: string,
    details: {
      configType: string;
      changes: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      await addDoc(collection(db, this.COLLECTION_NAME), {
        userId,
        event,
        category: 'configuration',
        details: this.sanitizeDetails(details),
        timestamp: serverTimestamp(),
        ipAddress: details.ipAddress || 'unknown',
        userAgent: details.userAgent || 'unknown'
      });
    } catch (error) {
      console.error('Failed to log config change:', error);
    }
  }

  /**
   * Log webhook events
   */
  static async logWebhookEvent(
    event: string,
    details: {
      transactionId: string;
      siteId: string;
      status: string;
      result: string;
      amount: string;
      currency: string;
      isValid: boolean;
      ipAddress?: string;
    }
  ): Promise<void> {
    try {
      await addDoc(collection(db, this.COLLECTION_NAME), {
        userId: 'system',
        event,
        category: 'webhook',
        details: this.sanitizeDetails(details),
        timestamp: serverTimestamp(),
        ipAddress: details.ipAddress || 'unknown'
      });
    } catch (error) {
      console.error('Failed to log webhook event:', error);
    }
  }

  /**
   * Sanitize details to remove sensitive information
   */
  private static sanitizeDetails(details: any): any {
    if (typeof details !== 'object' || details === null) {
      return details;
    }

    const sensitiveFields = [
      'apiKey', 'apikey', 'password', 'token', 'secret', 'key',
      'signature', 'phone', 'email', 'address'
    ];

    const sanitized = { ...details };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Get client IP address (for server-side usage)
   */
  static getClientIP(request: any): string {
    return (
      request.headers['x-forwarded-for'] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Get user agent
   */
  static getUserAgent(request: any): string {
    return request.headers['user-agent'] || 'unknown';
  }
}
