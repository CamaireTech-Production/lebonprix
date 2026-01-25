import { logActivity } from './activityLogService';

export interface CinetPayAuditEvent {
  userId: string;
  action: 'cinetpay_config_updated' | 'cinetpay_payment_initiated' | 'cinetpay_payment_success' | 'cinetpay_payment_failed';
  details: {
    restaurantId: string;
    transactionId?: string;
    amount?: number;
    environment?: 'sandbox' | 'production';
    error?: string;
  };
}

export class CinetPayAuditLogger {
  static async log(event: CinetPayAuditEvent): Promise<void> {
    try {
      await logActivity({
        userId: event.userId,
        userEmail: '', // Will be populated by activityLogService
        action: event.action,
        entityType: 'payment',
        entityId: event.details.transactionId,
        details: event.details
      });
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw - audit logging failure shouldn't break operations
    }
  }
}
