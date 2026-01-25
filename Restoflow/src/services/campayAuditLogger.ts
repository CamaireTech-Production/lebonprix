import { logActivity } from './activityLogService';

export interface CampayAuditEvent {
  userId: string;
  action: 'campay_config_updated' | 'campay_payment_initiated' | 'campay_payment_success' | 'campay_payment_failed' | 'campay_payment_cancelled';
  details: {
    restaurantId: string;
    reference?: string;
    amount?: number;
    environment?: 'demo' | 'production';
    error?: string;
  };
}

export class CampayAuditLogger {
  static async log(event: CampayAuditEvent): Promise<void> {
    try {
      await logActivity({
        userId: event.userId,
        userEmail: '', // Will be populated by activityLogService
        action: event.action,
        entityType: 'payment',
        entityId: event.details.reference,
        details: event.details
      });
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw - audit logging failure shouldn't break operations
    }
  }
}

