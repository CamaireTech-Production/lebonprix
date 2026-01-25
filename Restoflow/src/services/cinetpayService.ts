import { CinetPayConfig, CinetPayOptions, CinetPayTransaction } from '../types/cinetpay';
import { EncryptionService } from './encryptionService';
import { FirestoreService } from './firestoreService';
import { CinetPayAuditLogger } from './auditLogger';

export class CinetPayService {
  private config: CinetPayConfig | null = null;

  async initializeConfig(restaurantId: string): Promise<CinetPayConfig | null> {
    try {
      const restaurant = await FirestoreService.getRestaurant(restaurantId);
      
      if (!restaurant?.cinetpayConfig?.isActive) {
        return null;
      }

      const decryptedApiKey = EncryptionService.decrypt(restaurant.cinetpayConfig.apiKey);
      
      this.config = {
        apikey: decryptedApiKey,
        site_id: restaurant.cinetpayConfig.siteId,
        lang: 'fr'
      };
      
      this.initializeSDK();
      return this.config;
    } catch (error) {
      console.error('Failed to initialize CinetPay:', error);
      return null;
    }
  }

  private initializeSDK(): void {
    if (!this.config || !window.CinetPay) {
      throw new Error('CinetPay SDK not loaded');
    }

    window.CinetPay.setConfig(this.config);
  }

  async processPayment(options: CinetPayOptions, restaurantId: string): Promise<CinetPayTransaction> {
    return new Promise((resolve, reject) => {
      if (!this.config || !window.CinetPay) {
        reject(new Error('CinetPay not initialized'));
        return;
      }

      // Log payment initiation
      CinetPayAuditLogger.log({
        userId: restaurantId,
        action: 'cinetpay_payment_initiated',
        details: {
          restaurantId,
          transactionId: options.transaction_id,
          amount: options.amount,
          environment: 'sandbox' // Default to sandbox, will be updated when config is loaded
        }
      });

      const paymentOptions = {
        ...options,
        metadata: typeof options.metadata === 'object' 
          ? JSON.stringify(options.metadata) 
          : options.metadata || ''
      };

      window.CinetPay.getCheckout({
        ...paymentOptions,
        onSuccess: (data: Record<string, unknown>) => {
          const result = {
            transaction_id: data.transaction_id as string,
            amount: data.amount as number,
            currency: data.currency as string,
            status: data.status as string,
            payment_method: data.payment_method as string,
            customer_info: {
              name: data.customer_name as string,
              email: data.customer_email as string,
              phone: data.customer_phone as string
            }
          };

          // Log successful payment
          CinetPayAuditLogger.log({
            userId: restaurantId,
            action: 'cinetpay_payment_success',
            details: {
              restaurantId,
              transactionId: result.transaction_id,
              amount: result.amount
            }
          });

          resolve(result);
        },
        onError: (error: Record<string, unknown>) => {
          // Log failed payment
          CinetPayAuditLogger.log({
            userId: restaurantId,
            action: 'cinetpay_payment_failed',
            details: {
              restaurantId,
              transactionId: options.transaction_id,
              amount: options.amount,
              error: (error as { message?: string }).message || 'Unknown error'
            }
          });

          reject(new Error(`Payment failed: ${(error as { message?: string }).message || 'Unknown error'}`));
        }
      });
    });
  }

  isConfigured(): boolean {
    return this.config !== null;
  }
}
