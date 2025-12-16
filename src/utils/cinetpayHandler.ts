import { CinetPayConfig, CinetPaySDKOptions, CinetPayCallbacks } from '../types/cinetpay';
import { SecureEncryption, PaymentValidator } from './encryption';
import { AuditLogger } from './auditLogger';
import { normalizePhoneNumber } from './phoneUtils';

// Declare global CinetPay object
declare global {
  interface Window {
    CinetPay: {
      setConfig: (config: Record<string, unknown>) => void;
      getCheckout: (data: Record<string, unknown>) => void;
      waitResponse: (callback: (data: unknown) => void) => void;
      onError?: (callback: (error: unknown) => void) => void;
    };
  }
}

// CinetPay SDK initialization options
export interface CinetPayInitOptions {
  apikey: string;
  site_id: string;
  notify_url: string;
  return_url: string;
  transaction_id: string;
  amount: number;
  currency: string;
  channels: string;
  description: string;
  customer_name: string;
  customer_surname: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  customer_city: string;
  customer_country: string;
  customer_zip_code: string;
  metadata?: Record<string, unknown>;
}

// CinetPay payment result
export interface CinetPayPaymentResult {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  error?: string;
  message?: string;
}

// Initialize CinetPay SDK
export const initializeCinetPay = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    // Check if CinetPay SDK is already loaded
    if (window.CinetPay && typeof window.CinetPay.setConfig === 'function' && typeof window.CinetPay.getCheckout === 'function') {
      console.log('CinetPay SDK already loaded');
      resolve(true);
      return;
    }

    console.log('Waiting for CinetPay SDK to load...');
    console.log('window.CinetPay:', window.CinetPay);
    console.log('Available methods:', window.CinetPay ? Object.keys(window.CinetPay) : 'Not available');

    // Try to load the SDK dynamically if not available
    if (!window.CinetPay) {
      console.log('CinetPay SDK not found, attempting to load dynamically...');
      
      const script = document.createElement('script');
      script.src = 'https://cdn.cinetpay.com/seamless/main.js';
      script.async = true;
      script.onload = () => {
        console.log('CinetPay script loaded, waiting for object...');
        checkCinetPay();
      };
      script.onerror = () => {
        console.error('Failed to load CinetPay script');
        reject(new Error('Failed to load CinetPay script'));
      };
      document.head.appendChild(script);
    }

    // Check if script is loaded but CinetPay object not available yet
    const checkCinetPay = () => {
      if (window.CinetPay && typeof window.CinetPay.setConfig === 'function' && typeof window.CinetPay.getCheckout === 'function') {
        console.log('CinetPay SDK loaded successfully');
        resolve(true);
      } else {
        setTimeout(checkCinetPay, 100);
      }
    };

    // Start checking for CinetPay object
    if (window.CinetPay) {
      checkCinetPay();
    }

    // Timeout after 10 seconds
    setTimeout(() => {
      console.error('CinetPay SDK failed to load after 10 seconds');
      console.error('window.CinetPay:', window.CinetPay);
      reject(new Error('CinetPay SDK failed to load'));
    }, 10000);
  });
};

// Process CinetPay payment
export const processCinetPayPayment = async (
  config: CinetPayConfig,
  paymentData: {
    amount: number;
    currency: string;
    transactionId: string;
    description: string;
    customerInfo: {
      name: string;
      surname?: string;
      phone: string;
      email: string;
      address?: string;
      city?: string;
      country?: string;
      zipCode?: string;
    };
    returnUrl: string;
    notifyUrl: string;
  },
  callbacks: CinetPayCallbacks
): Promise<CinetPayPaymentResult> => {
  try {
    // Initialize CinetPay SDK
    await initializeCinetPay();

    // Validate configuration
    if (!config.isActive || !config.siteId || !config.apiKey) {
      throw new Error('CinetPay is not properly configured');
    }

    // Validate payment data
    const validation = PaymentValidator.validatePaymentData(paymentData);
    if (!validation.isValid) {
      throw new Error(`Invalid payment data: ${validation.errors.join(', ')}`);
    }

    // Sanitize input data
    const sanitizedPaymentData = PaymentValidator.sanitizeInput(paymentData);

    // Log payment initiation
    await AuditLogger.logPaymentEvent(config.userId, 'payment_initiated', {
      orderId: paymentData.transactionId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'initiated'
    });

    // Get enabled channels
    const enabledChannels = getEnabledChannels(config);
    if (enabledChannels.length === 0) {
      throw new Error('No payment channels are enabled');
    }

    // Prepare payment options with sanitized data
    const paymentOptions: CinetPaySDKOptions = {
      apikey: config.apiKey,
      site_id: config.siteId,
      notify_url: sanitizedPaymentData.notifyUrl,
      return_url: sanitizedPaymentData.returnUrl,
      transaction_id: sanitizedPaymentData.transactionId,
      amount: sanitizedPaymentData.amount,
      currency: sanitizedPaymentData.currency,
      channels: enabledChannels.join(','),
      description: sanitizedPaymentData.description,
      customer_name: sanitizedPaymentData.customerInfo.name,
      customer_surname: sanitizedPaymentData.customerInfo.surname || 'Customer',
      customer_phone: sanitizedPaymentData.customerInfo.phone,
      customer_email: sanitizedPaymentData.customerInfo.email,
      customer_address: sanitizedPaymentData.customerInfo.address || sanitizedPaymentData.customerInfo.location || 'Not provided',
      customer_city: sanitizedPaymentData.customerInfo.city || 'Not provided',
      customer_country: sanitizedPaymentData.customerInfo.country || 'Cameroon',
      customer_zip_code: sanitizedPaymentData.customerInfo.zipCode || '',
      metadata: {
        testMode: config.testMode,
        userId: SecureEncryption.hash(config.userId) // Hash user ID for privacy
      }
    };

    // Process payment using CinetPay SDK
    return new Promise((resolve, reject) => {
      try {
        // Check if CinetPay SDK is loaded
        if (!window.CinetPay || typeof window.CinetPay.setConfig !== 'function' || typeof window.CinetPay.getCheckout !== 'function') {
          throw new Error('CinetPay SDK not loaded or not available');
        }

        // Log configuration without sensitive data
        console.log('Initializing CinetPay payment with config:', SecureEncryption.sanitizeForLogging({
          site_id: paymentOptions.site_id,
          notify_url: paymentData.notifyUrl,
          return_url: paymentData.returnUrl,
          amount: paymentOptions.amount,
          currency: paymentOptions.currency
        }));

        // Set up CinetPay configuration
        window.CinetPay.setConfig({
          apikey: paymentOptions.apikey,
          site_id: paymentOptions.site_id,
          notify_url: paymentData.notifyUrl,
          return_url: paymentData.returnUrl,
          mode: config.testMode ? 'TEST' : 'PRODUCTION'
        });

        // Set up error handler
        if (window.CinetPay.onError) {
          window.CinetPay.onError((error: unknown) => {
          console.error('CinetPay payment error:', error);
          const errorObj = error as Record<string, unknown>;
          
          // Check for specific error types
          let errorCode = (errorObj?.code as string) || 'UNKNOWN_ERROR';
          let errorMessage = (error as Error)?.message || 'Unknown error occurred';
          
          // Handle amount too low error specifically
          if (errorObj?.message === 'ERROR_AMOUNT_TOO_LOW' || 
              (errorObj?.details as Record<string, unknown>)?.message === 'ERROR_AMOUNT_TOO_LOW') {
            errorCode = 'UNKNOWN_ERROR';
            errorMessage = 'ERROR_AMOUNT_TOO_LOW';
          }
          
          const errorResult: CinetPayPaymentResult = {
            success: false,
            error: errorMessage,
            message: 'Payment could not be processed'
          };
          
          resolve(errorResult);
          
          if (callbacks.onError) {
            callbacks.onError({
              code: errorCode,
              message: errorMessage,
              details: error as Record<string, unknown>
            });
          }
          });
        }

        // Set up response handler
        window.CinetPay.waitResponse((data: unknown) => {
          console.log('CinetPay payment response:', data);
          const dataObj = data as Record<string, unknown>;
          
          if (dataObj?.status === 'ACCEPTED') {
            const successResult: CinetPayPaymentResult = {
              success: true,
              transactionId: (dataObj?.transaction_id || dataObj?.transactionId) as string,
              paymentUrl: (dataObj?.payment_url || dataObj?.paymentUrl) as string,
              message: 'Payment completed successfully'
            };
            
            resolve(successResult);
            
            // Log successful payment
            AuditLogger.logPaymentEvent(config.userId, 'payment_success', {
              orderId: paymentOptions.transaction_id,
              transactionId: (dataObj?.transaction_id || dataObj?.transactionId) as string,
              amount: paymentOptions.amount,
              currency: paymentOptions.currency,
              status: 'accepted'
            });
            
            if (callbacks.onSuccess) {
              // Create a basic transaction object from the response
              const transactionData = {
                id: (dataObj?.transaction_id || dataObj?.transactionId) as string || '',
                orderId: paymentOptions.transaction_id,
                userId: config.userId,
                transactionId: (dataObj?.transaction_id || dataObj?.transactionId) as string || '',
                amount: paymentOptions.amount,
                currency: paymentOptions.currency,
                status: 'ACCEPTED' as const,
                channel: 'MOBILE_MONEY' as const,
                paymentUrl: (dataObj?.payment_url || dataObj?.paymentUrl) as string,
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: paymentOptions.metadata
              };
              callbacks.onSuccess(transactionData);
            }
          } else if (dataObj?.status === 'REFUSED') {
            const errorResult: CinetPayPaymentResult = {
              success: false,
              error: 'Payment was refused',
              message: 'Payment was declined'
            };
            
            resolve(errorResult);
            
            // Log failed payment
            AuditLogger.logPaymentEvent(config.userId, 'payment_failed', {
              orderId: paymentOptions.transaction_id,
              amount: paymentOptions.amount,
              currency: paymentOptions.currency,
              status: 'refused',
              error: 'Payment was declined by the payment provider'
            });
            
            if (callbacks.onError) {
              callbacks.onError({
                code: 'PAYMENT_REFUSED',
                message: 'Payment was declined by the payment provider',
                details: data as Record<string, unknown>
              });
            }
          } else {
            // Handle other statuses (PENDING, etc.)
            const pendingResult: CinetPayPaymentResult = {
              success: true,
              transactionId: (dataObj?.transaction_id || dataObj?.transactionId) as string,
              paymentUrl: (dataObj?.payment_url || dataObj?.paymentUrl) as string,
              message: 'Payment is being processed'
            };
            
            resolve(pendingResult);
          }
        });

        // Initialize payment with checkout data
        window.CinetPay.getCheckout({
          transaction_id: paymentOptions.transaction_id,
          amount: paymentOptions.amount,
          currency: paymentOptions.currency,
          channels: paymentOptions.channels,
          description: paymentOptions.description,
          customer_name: paymentOptions.customer_name,
          customer_surname: paymentOptions.customer_surname,
          customer_phone_number: paymentOptions.customer_phone,
          customer_email: paymentOptions.customer_email,
          customer_address: paymentOptions.customer_address,
          customer_city: paymentOptions.customer_city,
          customer_country: paymentOptions.customer_country,
          customer_zip_code: paymentOptions.customer_zip_code,
          metadata: paymentOptions.metadata ? JSON.stringify(paymentOptions.metadata) : ''
        });

      } catch (error) {
        console.error('Error initializing CinetPay payment:', error);
        reject({
          success: false,
          error: 'Failed to initialize payment',
          message: 'Payment system error'
        });
      }
    });

  } catch (error) {
    console.error('Error processing CinetPay payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Payment processing failed'
    };
  }
};

// Get enabled channels from config
const getEnabledChannels = (config: CinetPayConfig): string[] => {
  const channels: string[] = [];
  
  if (config.enabledChannels.mobileMoney) {
    channels.push('MOBILE_MONEY');
  }
  
  if (config.enabledChannels.creditCard) {
    channels.push('CREDIT_CARD');
  }
  
  if (config.enabledChannels.wallet) {
    channels.push('WALLET');
  }
  
  return channels;
};

// Validate payment data
export const validatePaymentData = (
  paymentData: {
    amount: number;
    currency: string;
    transactionId: string;
    description: string;
    customerInfo: {
      name: string;
      surname?: string;
      phone: string;
      email: string;
      address?: string;
      city?: string;
      country?: string;
      zipCode?: string;
    };
  }
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!paymentData.amount || paymentData.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!paymentData.currency) {
    errors.push('Currency is required');
  }

  if (!paymentData.transactionId) {
    errors.push('Transaction ID is required');
  }

  if (!paymentData.description) {
    errors.push('Description is required');
  }

  if (!paymentData.customerInfo.name) {
    errors.push('Customer name is required');
  }

  if (!paymentData.customerInfo.phone) {
    errors.push('Customer phone is required');
  }

  if (!paymentData.customerInfo.email) {
    errors.push('Customer email is required');
  }

  // Address, city, and country are optional as we provide fallback values

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Format phone number for CinetPay
export const formatPhoneForCinetPay = (phone: string, countryCode: string = '237'): string => {
  // Use centralized normalization utility
  const normalized = normalizePhoneNumber(phone, `+${countryCode}`);
  
  // Return digits only (no +) for CinetPay
  return normalized.replace(/\D/g, '');
};

// Get payment method display name
export const getPaymentMethodDisplayName = (channel: string): string => {
  const channelMap: Record<string, string> = {
    'MOBILE_MONEY': 'Mobile Money',
    'CREDIT_CARD': 'Credit Card',
    'WALLET': 'Wallet',
    'MTN_MOBILE_MONEY': 'MTN Mobile Money',
    'ORANGE_MONEY': 'Orange Money',
    'VISA_CARD': 'Visa Card',
    'MASTERCARD': 'Mastercard'
  };
  
  return channelMap[channel] || channel;
};