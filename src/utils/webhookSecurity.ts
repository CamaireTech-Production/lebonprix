import { SecureEncryption } from './encryption';
import { CinetPayWebhookPayload } from '../types/cinetpay';

/**
 * Webhook security utilities for CinetPay integration
 */
export class WebhookSecurity {
  /**
   * Verify CinetPay webhook signature
   */
  static verifyCinetPaySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      return SecureEncryption.verifyHmacSignature(payload, signature, secret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Validate webhook payload structure
   */
  static validateWebhookPayload(payload: any): payload is CinetPayWebhookPayload {
    const requiredFields = [
      'cpm_trans_id',
      'cpm_site_id',
      'cpm_amount',
      'cpm_currency',
      'cpm_result',
      'cpm_trans_status',
      'cpm_signature'
    ];

    for (const field of requiredFields) {
      if (!payload[field] || typeof payload[field] !== 'string') {
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitize webhook payload for logging
   */
  static sanitizeWebhookPayload(payload: CinetPayWebhookPayload): any {
    return {
      cpm_trans_id: payload.cpm_trans_id,
      cpm_site_id: payload.cpm_site_id,
      cpm_amount: payload.cpm_amount,
      cpm_currency: payload.cpm_currency,
      cpm_result: payload.cpm_result,
      cpm_trans_status: payload.cpm_trans_status,
      cpm_payment_date: payload.cpm_payment_date,
      cpm_payment_time: payload.cpm_payment_time,
      cpm_phone_prefixe: payload.cpm_phone_prefixe,
      cpm_phone: payload.cpm_phone ? '***REDACTED***' : undefined,
      cpm_designation: payload.cpm_designation,
      cpm_custom: payload.cpm_custom,
      cpm_signature: '***REDACTED***'
    };
  }

  /**
   * Validate transaction amount matches expected amount
   */
  static validateTransactionAmount(
    webhookAmount: string,
    expectedAmount: number,
    currency: string = 'XAF'
  ): boolean {
    try {
      const webhookAmountNum = parseFloat(webhookAmount);
      const expectedAmountNum = expectedAmount;
      
      // Allow for small floating point differences
      const tolerance = 0.01;
      const difference = Math.abs(webhookAmountNum - expectedAmountNum);
      
      return difference <= tolerance;
    } catch (error) {
      console.error('Amount validation failed:', error);
      return false;
    }
  }

  /**
   * Check if webhook is from a trusted source
   */
  static isTrustedSource(
    payload: CinetPayWebhookPayload,
    allowedSiteIds: string[]
  ): boolean {
    return allowedSiteIds.includes(payload.cpm_site_id);
  }

  /**
   * Validate webhook timestamp (prevent replay attacks)
   */
  static validateTimestamp(
    paymentDate: string,
    paymentTime: string,
    maxAgeMinutes: number = 30
  ): boolean {
    try {
      const paymentDateTime = new Date(`${paymentDate} ${paymentTime}`);
      const now = new Date();
      const ageMinutes = (now.getTime() - paymentDateTime.getTime()) / (1000 * 60);
      
      return ageMinutes <= maxAgeMinutes && ageMinutes >= 0;
    } catch (error) {
      console.error('Timestamp validation failed:', error);
      return false;
    }
  }

  /**
   * Comprehensive webhook validation
   */
  static validateWebhook(
    payload: any,
    signature: string,
    secret: string,
    expectedAmount: number,
    allowedSiteIds: string[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Verify signature
    if (!this.verifyCinetPaySignature(JSON.stringify(payload), signature, secret)) {
      errors.push('Invalid webhook signature');
    }

    // Validate payload structure
    if (!this.validateWebhookPayload(payload)) {
      errors.push('Invalid webhook payload structure');
    }

    // Validate amount
    if (!this.validateTransactionAmount(payload.cpm_amount, expectedAmount)) {
      errors.push('Transaction amount mismatch');
    }

    // Check trusted source
    if (!this.isTrustedSource(payload, allowedSiteIds)) {
      errors.push('Untrusted webhook source');
    }

    // Validate timestamp
    if (!this.validateTimestamp(payload.cpm_payment_date, payload.cpm_payment_time)) {
      errors.push('Webhook timestamp validation failed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Log webhook event securely
   */
  static logWebhookEvent(
    event: string,
    payload: CinetPayWebhookPayload,
    isValid: boolean
  ): void {
    const sanitizedPayload = this.sanitizeWebhookPayload(payload);
    
    console.log(`Webhook Event: ${event}`, {
      timestamp: new Date().toISOString(),
      isValid,
      transactionId: payload.cpm_trans_id,
      siteId: payload.cpm_site_id,
      status: payload.cpm_trans_status,
      result: payload.cpm_result,
      amount: payload.cpm_amount,
      currency: payload.cpm_currency
    });
  }
}
