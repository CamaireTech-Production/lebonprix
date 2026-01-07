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
import { PaymentValidator } from '../security/encryption';
import { AuditLogger } from './auditLogger';
import {
  validateCampayConfig,
  validateCampayPaymentData as validatePaymentDataUtil,
  checkNetworkConnectivity,
  getCampayErrorMessage,
  isRetryableError,
  validateAppIdFormat
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
    // Log App ID info (masked for security)
    const maskedAppId = appId.length > 10 
      ? `${appId.substring(0, 4)}...${appId.substring(appId.length - 4)}` 
      : '***';
    console.log('Initializing Campay SDK with:', { 
      environment, 
      appIdLength: appId.length,
      appIdPreview: maskedAppId,
      appIdFirstChars: appId.substring(0, 10)
    });

    // Check if Campay SDK is already loaded (like RestoFlow - only check object existence)
    if (window.campay) {
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
    const appIdValidation = validateAppIdFormat(appId);
    if (!appIdValidation.isValid) {
      console.error('App ID validation failed:', appIdValidation.message);
      reject(new Error(appIdValidation.message));
      return;
    }

    console.log('Loading Campay SDK...', { environment, appIdLength: appId.length });

    // Determine SDK URL based on environment
    // Note: Campay SDK URLs might vary - trying common patterns
    const baseUrl = environment === 'demo' 
      ? 'https://demo.campay.net/sdk/js'
      : 'https://www.campay.net/sdk/js';
    
    const scriptUrl = `${baseUrl}?app-id=${encodeURIComponent(appId)}`;
    console.log('Campay SDK URL:', scriptUrl.replace(appId, '***'));

    // Check if script is already loaded (check by URL pattern, not exact match)
    const existingScript = document.querySelector(`script[src*="campay.net"]`);
    
    // Use setInterval for polling (like RestoFlow)
    let checkInterval: NodeJS.Timeout | null = null;
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds (50 attempts × 100ms)
    
    // Check if script is loaded but Campay object not available yet
    // Use setInterval like RestoFlow - only check if window.campay exists
    const startChecking = () => {
      checkInterval = setInterval(() => {
        attempts++;
        
        // Like RestoFlow: Only check if window.campay exists (not methods)
        if (window.campay) {
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          console.log('Campay SDK loaded and ready');
          resolve(true);
        } else if (attempts >= maxAttempts) {
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          console.error('Campay SDK failed to initialize after 5 seconds');
          reject(new Error('Campay SDK loaded but initialization timed out. Please refresh and try again.'));
        }
      }, 100); // Check every 100ms (like RestoFlow)
    };

    if (existingScript) {
      console.log('Campay script already exists, waiting for object...', {
        scriptSrc: existingScript.getAttribute('src')?.replace(appId, '***')
      });
      startChecking();
      return;
    }

    // Load the SDK dynamically
    // Note: Do NOT add crossOrigin attribute - it causes CORS errors
    // Campay SDK should be loaded as a normal script tag (like in their documentation)
    // Match working sample: async = true AND defer = true
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.defer = true; // ADD THIS - matches working sample
    
    script.onload = () => {
      console.log('Campay script loaded successfully, waiting for window.campay object...');
      // Start checking with setInterval (like working sample)
      startChecking();
    };
    
    script.onerror = (error) => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      console.error('Failed to load Campay script:', error);
      console.error('Script URL:', scriptUrl.replace(appId, '***'));
      console.error('Possible causes:');
      console.error('1. Invalid App ID');
      console.error('2. Network connectivity issues');
      console.error('3. CORS policy blocking the script');
      console.error('4. Content Security Policy restrictions');
      reject(new Error('Failed to load Campay SDK script. Please check: 1) App ID is correct, 2) Network connection, 3) Browser console for CORS/CSP errors.'));
    };
    
    // Add error event listener for better debugging
    script.addEventListener('error', (event) => {
      console.error('Script error event:', event);
    }, true);
    
    if (typeof document !== 'undefined' && document.head) {
      console.log('Appending Campay script to document head...');
      document.head.appendChild(script);
    } else {
      if (checkInterval) {
        clearInterval(checkInterval);
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

    // Like RestoFlow: Only check if window.campay exists, not methods
    // Methods will be checked when we actually use them

    // Sanitize input data
    const sanitizedPaymentData = PaymentValidator.sanitizeInput(paymentData);

    // Log payment initiation (non-blocking)
    AuditLogger.logPaymentEvent(config.userId, 'campay_payment_initiated', {
      orderId: paymentData.externalReference || 'unknown',
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'initiated'
    }).catch(err => {
      // Silently handle audit logging errors - don't break payment flow
      console.warn('Audit log failed (non-critical):', err);
    });

    // Process payment using Campay SDK
    return new Promise((resolve, reject) => {
      try {
        // Like RestoFlow: Only check if window.campay exists
        if (!window.campay) {
          throw new Error('Campay SDK is not loaded. Please refresh the page and try again.');
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

        // Set up callbacks BEFORE calling options() (like RestoFlow)
        window.campay.onSuccess = (data: CampayResponse) => {
          console.log('Campay payment successful:', data);
          
          const successResult: CampayPaymentResult = {
            success: true,
            reference: data.reference,
            transactionId: data.transactionId,
            message: 'Payment completed successfully'
          };
          
          resolve(successResult);
          
          // Log successful payment (non-blocking)
          AuditLogger.logPaymentEvent(config.userId, 'campay_payment_success', {
            orderId: paymentData.externalReference || 'unknown',
            transactionId: data.transactionId || data.reference,
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: 'success'
          }).catch(err => {
            // Silently handle audit logging errors - don't break payment flow
            console.warn('Audit log failed (non-critical):', err);
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
          
          // Log failed payment (non-blocking)
          AuditLogger.logPaymentEvent(config.userId, 'campay_payment_failed', {
            orderId: paymentData.externalReference || 'unknown',
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: 'failed',
            error: errorMessage
          }).catch(err => {
            // Silently handle audit logging errors - don't break payment flow
            console.warn('Audit log failed (non-critical):', err);
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
          
          // Log cancelled payment (non-blocking)
          AuditLogger.logPaymentEvent(config.userId, 'campay_payment_cancelled', {
            orderId: paymentData.externalReference || 'unknown',
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: 'cancelled'
          }).catch(err => {
            // Silently handle audit logging errors - don't break payment flow
            console.warn('Audit log failed (non-critical):', err);
          });
          
          if (callbacks.onModalClose) {
            callbacks.onModalClose(data);
          }
        };

        // Configure Campay SDK with payment options (like RestoFlow - call directly)
        try {
          window.campay.options(campayOptions);
        } catch (error) {
          throw new Error(`Failed to configure Campay: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Get the button element and validate it exists
        const button = document.getElementById(payButtonId);
        if (!button) {
          console.error('Campay payment button not found:', {
            buttonId: payButtonId,
            allButtons: Array.from(document.querySelectorAll('button')).map(b => b.id).filter(Boolean),
            bodyChildren: Array.from(document.body.children).map(el => el.tagName + (el.id ? `#${el.id}` : ''))
          });
          throw new Error(`Payment button with ID "${payButtonId}" not found in DOM. Please ensure the button is rendered in the component JSX.`);
        }

        // Validate button is a button element
        if (button.tagName !== 'BUTTON') {
          console.error('Element with button ID is not a button:', button.tagName);
          throw new Error(`Element with ID "${payButtonId}" is not a button element`);
        }

        // Wait 50ms before clicking button (like working sample)
        // This ensures callbacks are fully registered before modal opens
        setTimeout(() => {
          // Double-check button still exists before clicking
          const buttonToClick = document.getElementById(payButtonId);
          if (!buttonToClick) {
            console.error('Button disappeared before click:', payButtonId);
            throw new Error('Payment button was removed from DOM before payment could be triggered');
          }
          
          // Trigger payment by clicking the button (this opens the modal)
          try {
            buttonToClick.click();
            console.log('Campay payment button clicked successfully');
          } catch (clickError) {
            console.error('Error clicking Campay button:', clickError);
            throw new Error(`Failed to trigger payment: ${clickError instanceof Error ? clickError.message : 'Unknown error'}`);
          }
        }, 50);

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
    
    // Log error (non-blocking)
    AuditLogger.logPaymentEvent(config.userId, 'campay_payment_error', {
      orderId: paymentData.externalReference || 'unknown',
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: 'error',
      error: errorMessage
    }).catch(err => {
      // Silently handle audit logging errors - don't break payment flow
      console.warn('Audit log failed (non-critical):', err);
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

