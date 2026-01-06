/**
 * Campay Payment Handler
 * 
 * This module handles the integration with Campay payment gateway, including:
 * - SDK initialization and loading
 * - Payment processing
 * - Callback handling (success, fail, cancel)
 * - Error handling and validation
 * 
 * @module campayHandler
 * @see {@link https://docs.campay.net/ Campay Documentation}
 */

import { CampayConfig, CampayOptions, CampayResponse, CampayCallbacks } from '../../types/campay';
import { SecureEncryption, PaymentValidator } from '../security/encryption';
import { AuditLogger } from './auditLogger';
import { validateCampayPaymentAmount } from '@services/payment/campayService';
import {
  validateCampayConfig,
  validateCampayPaymentData as validatePaymentDataUtil,
  checkNetworkConnectivity,
  validateSDKInitialization,
  getCampayErrorMessage,
  isRetryableError
} from '../validation/campayValidation';

// Declare global Campay object
declare global {
  interface Window {
    campay: {
      options: (options: CampayOptions) => void;
      onSuccess?: (data: CampayResponse) => void;
      onFail?: (data: CampayResponse) => void;
      onModalClose?: (data?: CampayResponse) => void;
    };
  }
}

// Campay payment result
export interface CampayPaymentResult {
  success: boolean;
  reference?: string;
  transactionId?: string;
  error?: string;
  message?: string;
}

/**
 * Initialize Campay SDK
 * 
 * Dynamically loads the Campay JavaScript SDK based on the environment.
 * The SDK is loaded from either the demo or production URL depending on the environment setting.
 * 
 * @param appId - Campay App ID (must be at least 10 characters)
 * @param environment - 'demo' or 'production'
 * @returns Promise that resolves to true when SDK is loaded, rejects on error
 * 
 * @example
 * ```typescript
 * try {
 *   await initializeCampay('your-app-id', 'demo');
 *   console.log('SDK loaded successfully');
 * } catch (error) {
 *   console.error('Failed to load SDK:', error);
 * }
 * ```
 */
export const initializeCampay = (appId: string, environment: 'demo' | 'production'): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    // Check if Campay SDK is already loaded
    const sdkCheck = validateSDKInitialization();
    if (sdkCheck.isInitialized) {
      console.log('Campay SDK already loaded');
      resolve(true);
      return;
    }

    // Check network connectivity
    const networkCheck = checkNetworkConnectivity();
    if (!networkCheck.isOnline) {
      reject(new Error(networkCheck.message));
      return;
    }

    // Validate App ID format
    const { validateAppIdFormat } = require('../validation/campayValidation');
    const appIdValidation = validateAppIdFormat(appId);
    if (!appIdValidation.isValid) {
      reject(new Error(appIdValidation.message));
      return;
    }

    console.log('Loading Campay SDK...');

    // Determine SDK URL based on environment
    const baseUrl = environment === 'demo' 
      ? 'https://demo.campay.net/sdk/js'
      : 'https://www.campay.net/sdk/js';
    
    const scriptUrl = `${baseUrl}?app-id=${encodeURIComponent(appId)}`;

    // Check if script is already loaded
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
    
    // Timeout after 10 seconds
    let timeoutId: NodeJS.Timeout;
    
    // Check if script is loaded but Campay object not available yet
    const checkCampay = () => {
      const sdkCheck = validateSDKInitialization();
      if (sdkCheck.isInitialized) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        console.log('Campay SDK loaded successfully');
        resolve(true);
      } else {
        // Retry after 100ms
        setTimeout(checkCampay, 100);
      }
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      const sdkCheck = validateSDKInitialization();
      if (!sdkCheck.isInitialized) {
        console.error('Campay SDK failed to load after 10 seconds');
        reject(new Error(sdkCheck.message));
      }
    }, 10000);

    if (existingScript) {
      console.log('Campay script already exists, waiting for object...');
      checkCampay();
      return;
    }

    // Load the SDK dynamically
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      console.log('Campay script loaded, waiting for object...');
      checkCampay();
    };
    script.onerror = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      console.error('Failed to load Campay script');
      reject(new Error('Failed to load Campay SDK. Please refresh the page and try again.'));
    };
    
    if (typeof document !== 'undefined' && document.head) {
      document.head.appendChild(script);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(new Error('Document head is not available'));
    }
  });
};

/**
 * Process Campay Payment
 * 
 * Processes a payment using the Campay SDK. This function:
 * 1. Validates configuration and payment data
 * 2. Initializes the SDK if not already loaded
 * 3. Sets up payment callbacks (onSuccess, onFail, onModalClose)
 * 4. Triggers the payment modal
 * 
 * @param config - Campay configuration (App ID, environment, limits, etc.)
 * @param paymentData - Payment details (amount, currency, description, etc.)
 * @param callbacks - Callback functions for payment events
 * @param payButtonId - ID of the hidden button element used to trigger payment
 * @returns Promise that resolves with payment result
 * 
 * @example
 * ```typescript
 * const result = await processCampayPayment(
 *   campayConfig,
 *   {
 *     amount: 1000,
 *     currency: 'XAF',
 *     description: 'Order payment',
 *     externalReference: 'ORDER_123'
 *   },
 *   {
 *     onSuccess: (data) => console.log('Payment successful:', data),
 *     onFail: (data) => console.error('Payment failed:', data),
 *     onModalClose: () => console.log('Modal closed')
 *   },
 *   'campay-pay-button'
 * );
 * ```
 * 
 * @throws {Error} If configuration is invalid, payment data is invalid, or SDK fails to load
 */
export const processCampayPayment = async (
  config: CampayConfig,
  paymentData: {
    amount: number;
    currency: string;
    description: string;
    externalReference?: string;
    redirectUrl?: string;
  },
  callbacks: CampayCallbacks,
  payButtonId: string
): Promise<CampayPaymentResult> => {
  try {
    // Check network connectivity
    const networkCheck = checkNetworkConnectivity();
    if (!networkCheck.isOnline) {
      throw new Error(networkCheck.message);
    }

    // Validate configuration
    const configValidation = validateCampayConfig(config);
    if (!configValidation.isValid) {
      throw new Error(`Configuration error: ${configValidation.errors.join(', ')}`);
    }

    // Validate payment data
    const paymentValidation = validatePaymentDataUtil(paymentData, config);
    if (!paymentValidation.isValid) {
      throw new Error(paymentValidation.errors.join(', '));
    }

    // Initialize Campay SDK
    await initializeCampay(config.appId, config.environment);

    // Validate SDK initialization after loading
    const sdkValidation = validateSDKInitialization();
    if (!sdkValidation.isInitialized) {
      throw new Error(sdkValidation.message);
    }

    // Sanitize input data
    const sanitizedPaymentData = PaymentValidator.sanitizeInput(paymentData);

    // Log payment initiation
    await AuditLogger.logPaymentEvent(config.userId, 'campay_payment_initiated', {
      orderId: paymentData.externalReference || 'unknown',
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'initiated'
    });

    // Process payment using Campay SDK
    return new Promise((resolve, reject) => {
      try {
        // Validate SDK initialization
        const sdkValidation = validateSDKInitialization();
        if (!sdkValidation.isInitialized) {
          throw new Error(sdkValidation.message);
        }

        // Convert amount to string (Campay requirement)
        const amountString = String(paymentData.amount);

        // Prepare Campay options
        const campayOptions: CampayOptions = {
          payButtonId: payButtonId,
          description: sanitizedPaymentData.description || 'Order payment',
          amount: amountString, // CRITICAL: Must be string, not number
          currency: sanitizedPaymentData.currency || 'XAF',
          externalReference: sanitizedPaymentData.externalReference,
          redirectUrl: sanitizedPaymentData.redirectUrl
        };

        // Log configuration without sensitive data
        console.log('Initializing Campay payment with config:', {
          description: campayOptions.description,
          amount: campayOptions.amount,
          currency: campayOptions.currency,
          externalReference: campayOptions.externalReference,
          environment: config.environment
        });

        // Set up callbacks BEFORE calling options()
        window.campay.onSuccess = (data: CampayResponse) => {
          console.log('Campay payment successful:', data);
          
          const successResult: CampayPaymentResult = {
            success: true,
            reference: data.reference,
            transactionId: data.transactionId,
            message: 'Payment completed successfully'
          };
          
          resolve(successResult);
          
          // Log successful payment
          AuditLogger.logPaymentEvent(config.userId, 'campay_payment_success', {
            orderId: paymentData.externalReference || 'unknown',
            transactionId: data.transactionId || data.reference,
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: 'success'
          });
          
          if (callbacks.onSuccess) {
            callbacks.onSuccess(data);
          }
        };

        window.campay.onFail = (data: CampayResponse) => {
          console.error('Campay payment failed:', data);
          
          // Get user-friendly error message
          const errorMessage = getCampayErrorMessage(data.message || 'Payment failed', config.environment);
          const isRetryable = isRetryableError(errorMessage);
          
          const errorResult: CampayPaymentResult = {
            success: false,
            error: errorMessage,
            message: isRetryable 
              ? `${errorMessage} You can try again.`
              : errorMessage
          };
          
          resolve(errorResult);
          
          // Log failed payment
          AuditLogger.logPaymentEvent(config.userId, 'campay_payment_failed', {
            orderId: paymentData.externalReference || 'unknown',
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: 'failed',
            error: errorMessage,
            isRetryable
          });
          
          if (callbacks.onFail) {
            callbacks.onFail(data);
          }
        };

        window.campay.onModalClose = (data?: CampayResponse) => {
          console.log('Campay payment modal closed:', data);
          
          const cancelledResult: CampayPaymentResult = {
            success: false,
            error: 'Payment cancelled',
            message: 'Payment was cancelled by user'
          };
          
          resolve(cancelledResult);
          
          // Log cancelled payment
          AuditLogger.logPaymentEvent(config.userId, 'campay_payment_cancelled', {
            orderId: paymentData.externalReference || 'unknown',
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: 'cancelled'
          });
          
          if (callbacks.onModalClose) {
            callbacks.onModalClose(data);
          }
        };

        // Configure Campay SDK with payment options
        window.campay.options(campayOptions);

        // Get the button element and trigger payment
        const button = document.getElementById(payButtonId);
        if (!button) {
          throw new Error(`Payment button with ID "${payButtonId}" not found`);
        }

        // Trigger payment by clicking the button
        button.click();

      } catch (error) {
        console.error('Error initializing Campay payment:', error);
        const errorMessage = error instanceof Error 
          ? getCampayErrorMessage(error.message, config.environment)
          : 'Failed to initialize payment';
        
        reject({
          success: false,
          error: errorMessage,
          message: 'Payment system error'
        });
      }
    });

  } catch (error) {
    console.error('Error processing Campay payment:', error);
    const errorMessage = error instanceof Error 
      ? getCampayErrorMessage(error.message, config.environment)
      : 'Unknown error occurred';
    
    // Log error
    AuditLogger.logPaymentEvent(config.userId, 'campay_payment_error', {
      orderId: paymentData.externalReference || 'unknown',
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'error',
      error: errorMessage
    });
    
    return {
      success: false,
      error: errorMessage,
      message: 'Payment processing failed'
    };
  }
};

/**
 * Validate Payment Data
 * 
 * Validates payment data before processing. Checks:
 * - Amount is greater than 0
 * - Currency is provided
 * - Description is provided
 * 
 * @param paymentData - Payment data to validate
 * @returns Validation result with isValid flag and array of error messages
 * 
 * @deprecated Use validateCampayPaymentData from @utils/validation/campayValidation instead
 * This function is kept for backward compatibility but will be removed in a future version.
 */
export const validateCampayPaymentData = (
  paymentData: {
    amount: number;
    currency: string;
    description: string;
    externalReference?: string;
  }
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!paymentData.amount || paymentData.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!paymentData.currency) {
    errors.push('Currency is required');
  }

  if (!paymentData.description) {
    errors.push('Description is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

