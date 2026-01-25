import { getCampayConfig } from './campayService';
import { SecureEncryption } from '@utils/security/encryption';
import { AuditLogger } from '@utils/core/auditLogger';
import type { CampayConfig, CampayOptions, CampayResponse } from '../../types/campay';

// Declare global Campay object
declare global {
  interface Window {
    campay: {
      options: (config: CampayOptions) => void;
      onSuccess?: (data: CampayResponse) => void;
      onFail?: (data: CampayResponse) => void;
      onModalClose?: (data?: CampayResponse) => void;
    };
  }
}

/**
 * CampayService - Manages Campay payment gateway integration
 * 
 * This service handles:
 * - Loading and initializing the Campay SDK
 * - Processing payments
 * - Managing payment callbacks
 * 
 * Pattern matches RestoFlow implementation for consistency
 */
export class CampayService {
  private companyId: string | null = null;
  private config: CampayConfig | null = null;
  private appId: string | null = null; // Store appId separately (matching RestoFlow)
  private scriptLoaded = false;
  private scriptLoading = false;
  private scriptLoadPromise: Promise<boolean> | null = null;

  /**
   * Initialize Campay configuration for a company
   * Decrypts the App ID and prepares the service for use
   * Loads the SDK script during initialization (matching RestoFlow)
   */
  async initializeConfig(companyId: string): Promise<void> {
    try {
      this.companyId = companyId;

      // Get Campay configuration from Firestore
      const campayConfig = await getCampayConfig(companyId);

      if (!campayConfig) {
        throw new Error('Campay configuration not found');
      }

      // Decrypt App ID using companyId as encryption key
      let decryptedAppId = campayConfig.appId;
      if (campayConfig.appId && !campayConfig.appId.includes('***REDACTED***')) {
        try {
          decryptedAppId = SecureEncryption.decrypt(campayConfig.appId, companyId);
        } catch (error) {
          console.error('Failed to decrypt App ID:', error);
          // If decryption fails, use the original (might be plain text)
          decryptedAppId = campayConfig.appId;
        }
      }

      // Store config with decrypted App ID
      this.config = {
        ...campayConfig,
        appId: decryptedAppId
      };

      // Store appId separately (matching RestoFlow pattern)
      this.appId = decryptedAppId;

      console.log('CampayService: Config initialized for company:', companyId);

      // Load script if not already loaded (matching RestoFlow - loads during initialization)
      await this.loadScript();
    } catch (error) {
      console.error('CampayService: Failed to initialize config:', error);
      this.config = null;
      throw error;
    }
  }

  /**
   * Load Campay SDK script dynamically
   * Matches RestoFlow's implementation exactly
   * Waits for window.campay.options to be available (not just window.campay)
   */
  private async loadScript(): Promise<boolean> {
    // If already loaded and SDK is ready, return immediately (matching RestoFlow)
    if (this.scriptLoaded && window.campay && typeof window.campay.options === 'function') {
      return true;
    }

    // If currently loading, return the existing promise
    if (this.scriptLoading && this.scriptLoadPromise) {
      return this.scriptLoadPromise;
    }

    // If no app ID, cannot load script (matching RestoFlow)
    if (!this.appId) {
      throw new Error('Campay App ID not configured');
    }

    this.scriptLoading = true;

    this.scriptLoadPromise = new Promise((resolve, reject) => {
      // Check if script already exists in DOM (matching RestoFlow - checks both script and window.campay)
      const existingScript = document.querySelector('script[src*="campay.net"]');
      if (existingScript && window.campay) {
        console.log('CampayService: Script already exists in DOM, waiting for options method...');
        
        // Wait for window.campay.options to be available (not just window.campay)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.campay && typeof window.campay.options === 'function') {
            clearInterval(checkInterval);
            this.scriptLoaded = true;
            this.scriptLoading = false;
            console.log('CampayService: SDK ready (from existing script)');
            resolve(true);
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            this.scriptLoading = false;
            reject(new Error('Campay SDK failed to initialize - options method not available after 5 seconds'));
          }
        }, 100);
        return;
      }

      // Build script URL based on environment
      const environment = this.config?.environment || 'demo';
      const baseUrl = environment === 'demo'
        ? 'https://demo.campay.net/sdk/js'
        : 'https://www.campay.net/sdk/js';

      const appId = this.appId || this.config?.appId || '';
      const scriptUrl = `${baseUrl}?app-id=${encodeURIComponent(appId)}`;
      console.log('CampayService: Loading script from:', scriptUrl.replace(appId, '***'));

      // Create and append script
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log('CampayService: Script loaded, waiting for window.campay.options...');
        
        // Wait for window.campay.options to be available (not just window.campay)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds
        const checkInterval = setInterval(() => {
          attempts++;
          // Check if window.campay exists AND options is a function
          if (window.campay && typeof window.campay.options === 'function') {
            clearInterval(checkInterval);
            this.scriptLoaded = true;
            this.scriptLoading = false;
            console.log('CampayService: SDK ready (options method available)');
            resolve(true);
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            this.scriptLoading = false;
            const debugInfo = window.campay 
              ? 'window.campay exists but options is not a function'
              : 'window.campay does not exist';
            reject(new Error(`Campay SDK failed to initialize after 5 seconds. ${debugInfo}`));
          }
        }, 100);
      };

      script.onerror = (error) => {
        console.error('CampayService: Failed to load script:', error);
        this.scriptLoading = false;
        reject(new Error('Failed to load Campay SDK script'));
      };

      document.head.appendChild(script);
    });

    return this.scriptLoadPromise;
  }

  /**
   * Process a Campay payment
   * Matches RestoFlow's implementation exactly
   */
  async processPayment(
    options: CampayOptions,
    callbacks: {
      onSuccess?: (data: CampayResponse) => void;
      onFail?: (data: CampayResponse) => void;
      onModalClose?: (data?: CampayResponse) => void;
    }
  ): Promise<CampayResponse> {
    if (!this.config || !this.companyId) {
      throw new Error('Campay config not initialized. Call initializeConfig first.');
    }

    // Load SDK if not already loaded
    await this.loadScript();

    // Verify window.campay exists and options is a function (matching RestoFlow validation)
    if (!this.scriptLoaded || !window.campay) {
      throw new Error('Campay SDK not loaded. Please refresh the page and try again.');
    }

    // Additional validation: ensure options method is available
    if (typeof window.campay.options !== 'function') {
      throw new Error('Campay SDK is not fully initialized. The options method is not available. Please refresh the page and try again.');
    }

    // Validate options
    const amountValue = typeof options.amount === 'string' ? Number(options.amount) : options.amount;
    if (!amountValue || amountValue <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Log payment initiation
    AuditLogger.logPaymentEvent(this.config.userId, 'campay_payment_initiated', {
      orderId: options.externalReference || 'unknown',
      amount: amountValue,
      currency: options.currency || 'XAF',
      status: 'initiated'
    }).catch(err => {
      console.warn('Audit log failed (non-critical):', err);
    });

    // Return promise that resolves/rejects based on callbacks (matching RestoFlow)
    return new Promise((resolve, reject) => {
      // Set up callbacks BEFORE calling options() (matching RestoFlow)
      window.campay.onSuccess = (data: CampayResponse) => {
        // Log successful payment
        AuditLogger.logPaymentEvent(this.config!.userId, 'campay_payment_success', {
          orderId: options.externalReference || 'unknown',
          transactionId: data.transactionId || data.reference,
          amount: data.amount || amountValue,
          currency: data.currency || options.currency || 'XAF',
          status: 'success'
        }).catch(err => {
          console.warn('Audit log failed (non-critical):', err);
        });

        // Call custom callback if provided
        if (callbacks.onSuccess) {
          callbacks.onSuccess(data);
        }

        resolve(data);
      };

      window.campay.onFail = (data: CampayResponse) => {
        // Log failed payment
        AuditLogger.logPaymentEvent(this.config!.userId, 'campay_payment_failed', {
          orderId: options.externalReference || 'unknown',
          amount: amountValue,
          currency: options.currency || 'XAF',
          status: 'failed',
          error: data.message || 'Payment failed'
        }).catch(err => {
          console.warn('Audit log failed (non-critical):', err);
        });

        // Call custom callback if provided
        if (callbacks.onFail) {
          callbacks.onFail(data);
        }

        reject(new Error(data.message || 'Payment failed'));
      };

      window.campay.onModalClose = (data?: CampayResponse) => {
        // Log modal close
        AuditLogger.logPaymentEvent(this.config!.userId, 'campay_payment_cancelled', {
          orderId: options.externalReference || 'unknown',
          amount: amountValue,
          currency: options.currency || 'XAF',
          status: 'cancelled'
        }).catch(err => {
          console.warn('Audit log failed (non-critical):', err);
        });

        // Call custom callback if provided
        if (callbacks.onModalClose) {
          callbacks.onModalClose(data);
        }

        // Don't reject on modal close - user cancelled, not an error
        reject(new Error('Payment cancelled by user'));
      };

      // Prepare Campay options - amount must be STRING (matching RestoFlow)
      const campayOptions: CampayOptions = {
        payButtonId: options.payButtonId,
        description: options.description || 'Order payment',
        amount: String(Math.round(amountValue)), // Convert to STRING - critical!
        currency: options.currency || 'XAF',
        externalReference: options.externalReference,
        redirectUrl: options.redirectUrl
      };

      // Call Campay SDK options method (matching RestoFlow)
      try {
        window.campay.options(campayOptions);
        console.log('CampayService: Payment options configured');
      } catch (error) {
        console.error('CampayService: Failed to configure payment:', error);
        reject(new Error(`Failed to configure Campay: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Trigger payment by clicking the hidden button
   */
  triggerPayment(buttonId: string): void {
    const button = document.getElementById(buttonId);
    if (!button) {
      throw new Error(`Payment button with ID "${buttonId}" not found`);
    }

    // Small delay to ensure SDK is ready (matching RestoFlow)
    setTimeout(() => {
      button.click();
    }, 50);
  }

  /**
   * Check if Campay is configured
   * Matches RestoFlow: checks scriptLoaded and window.campay
   */
  isConfigured(): boolean {
    return this.appId !== null && 
           this.scriptLoaded && 
           !!window.campay &&
           typeof window.campay.options === 'function';
  }

  /**
   * Get current configuration
   */
  getConfig(): CampayConfig | null {
    return this.config;
  }

  /**
   * Cleanup - remove script and reset state
   */
  cleanup(): void {
    const script = document.querySelector('script[src*="campay.net"]');
    if (script) {
      script.remove();
    }
    this.scriptLoaded = false;
    this.scriptLoading = false;
    this.scriptLoadPromise = null;
    this.config = null;
    this.companyId = null;
  }

  /**
   * Test connection to Campay (for settings page)
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.config || !this.companyId) {
        return {
          success: false,
          message: 'Campay config not initialized'
        };
      }

      await this.loadScript();

      if (!window.campay) {
        return {
          success: false,
          message: 'Campay SDK failed to load'
        };
      }

      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}

