import { CinetPayConfig, CinetPaySDKOptions, CinetPayCallbacks } from '../types/cinetpay';

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
      phone: string;
      email: string;
      address: string;
      city: string;
      country: string;
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

    // Get enabled channels
    const enabledChannels = getEnabledChannels(config);
    if (enabledChannels.length === 0) {
      throw new Error('No payment channels are enabled');
    }

    // Prepare payment options
    const paymentOptions: CinetPaySDKOptions = {
      apikey: config.apiKey,
      site_id: config.siteId,
      notify_url: paymentData.notifyUrl,
      return_url: paymentData.returnUrl,
      transaction_id: paymentData.transactionId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      channels: enabledChannels.join(','),
      description: paymentData.description,
      customer_name: paymentData.customerInfo.name.split(' ')[0] || '',
      customer_surname: paymentData.customerInfo.name.split(' ').slice(1).join(' ') || '',
      customer_phone: paymentData.customerInfo.phone,
      customer_email: paymentData.customerInfo.email,
      customer_address: paymentData.customerInfo.address,
      customer_city: paymentData.customerInfo.city,
      customer_country: paymentData.customerInfo.country,
      customer_zip_code: paymentData.customerInfo.zipCode || '',
      metadata: {
        testMode: config.testMode,
        userId: config.userId
      }
    };

    // Process payment using CinetPay SDK
    return new Promise((resolve, reject) => {
      try {
        // Check if CinetPay SDK is loaded
        if (!window.CinetPay || typeof window.CinetPay.setConfig !== 'function' || typeof window.CinetPay.getCheckout !== 'function') {
          throw new Error('CinetPay SDK not loaded or not available');
        }

        console.log('Initializing CinetPay payment with config:', {
          apikey: paymentOptions.apikey,
          site_id: paymentOptions.site_id,
          notify_url: paymentData.notifyUrl,
          return_url: paymentData.returnUrl
        });

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
          const errorResult: CinetPayPaymentResult = {
            success: false,
            error: (error as Error)?.message || 'Payment failed',
            message: 'Payment could not be processed'
          };
          
          resolve(errorResult);
          
          if (callbacks.onError) {
            callbacks.onError({
              code: (errorObj?.code as string) || 'UNKNOWN_ERROR',
              message: (error as Error)?.message || 'Unknown error occurred',
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
      phone: string;
      email: string;
      address: string;
      city: string;
      country: string;
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

  if (!paymentData.customerInfo.address) {
    errors.push('Customer address is required');
  }

  if (!paymentData.customerInfo.city) {
    errors.push('Customer city is required');
  }

  if (!paymentData.customerInfo.country) {
    errors.push('Customer country is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Format phone number for CinetPay
export const formatPhoneForCinetPay = (phone: string, countryCode: string = '237'): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If phone starts with country code, use as is
  if (cleaned.startsWith(countryCode)) {
    return cleaned;
  }
  
  // If phone starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    return countryCode + cleaned.substring(1);
  }
  
  // Otherwise, prepend country code
  return countryCode + cleaned;
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