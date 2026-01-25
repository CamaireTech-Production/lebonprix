import { CampayOptions, CampayTransaction, CampayResponse } from '../types/campay';
import { EncryptionService } from './encryptionService';
import { FirestoreService } from './firestoreService';
import { CampayAuditLogger } from './campayAuditLogger';

export class CampayService {
  private appId: string | null = null;
  private environment: 'demo' | 'production' = 'demo';
  private scriptLoaded: boolean = false;
  private scriptLoading: boolean = false;
  private scriptLoadPromise: Promise<void> | null = null;

  async initializeConfig(restaurantId: string): Promise<{ appId: string; environment: 'demo' | 'production' } | null> {
    try {
      const restaurant = await FirestoreService.getRestaurant(restaurantId);
      
      if (!restaurant?.campayConfig?.isActive) {
        return null;
      }

      const decryptedAppId = EncryptionService.decrypt(restaurant.campayConfig.appId);
      
      this.appId = decryptedAppId;
      this.environment = restaurant.campayConfig.environment || 'demo';
      
      // Load script if not already loaded
      await this.loadScript();
      
      return {
        appId: this.appId,
        environment: this.environment
      };
    } catch (error) {
      console.error('Failed to initialize Campay:', error);
      return null;
    }
  }


  async loadScript(): Promise<void> {
    // If script is already loaded, return immediately
    if (this.scriptLoaded && window.campay) {
      return Promise.resolve();
    }

    // If script is currently loading, return the existing promise
    if (this.scriptLoading && this.scriptLoadPromise) {
      return this.scriptLoadPromise;
    }

    // If no app ID, cannot load script
    if (!this.appId) {
      throw new Error('Campay App ID not configured');
    }

    // Check if script already exists in DOM
    const existingScript = document.querySelector(`script[src*="campay.net/sdk/js"]`);
    if (existingScript && window.campay) {
      this.scriptLoaded = true;
      return Promise.resolve();
    }

    // Check network connectivity
    if (!navigator.onLine) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    // Start loading script
    this.scriptLoading = true;
    this.scriptLoadPromise = new Promise((resolve, reject) => {
      // Generate script URL based on environment
      const scriptUrl = this.getScriptUrl();
      
      // Create script element
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      
      let checkInterval: NodeJS.Timeout | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      
      // Handle script load success
      script.onload = () => {
        // Wait for campay object to be available
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max (50 * 100ms)
        
        checkInterval = setInterval(() => {
          attempts++;
          if (window.campay) {
            if (checkInterval) clearInterval(checkInterval);
            if (timeoutId) clearTimeout(timeoutId);
            this.scriptLoaded = true;
            this.scriptLoading = false;
            this.scriptLoadPromise = null;
            resolve();
          } else if (attempts >= maxAttempts) {
            if (checkInterval) clearInterval(checkInterval);
            if (timeoutId) clearTimeout(timeoutId);
            this.scriptLoading = false;
            this.scriptLoadPromise = null;
            reject(new Error('Campay SDK loaded but initialization timed out. Please refresh and try again.'));
          }
        }, 100);

        // Additional timeout safety net
        timeoutId = setTimeout(() => {
          if (checkInterval) clearInterval(checkInterval);
          if (!window.campay) {
            this.scriptLoading = false;
            this.scriptLoadPromise = null;
            reject(new Error('Campay SDK initialization timeout. Please check your connection and try again.'));
          }
        }, 6000);
      };

      // Handle script load error
      script.onerror = () => {
        if (checkInterval) clearInterval(checkInterval);
        if (timeoutId) clearTimeout(timeoutId);
        this.scriptLoading = false;
        this.scriptLoadPromise = null;
        
        // Check if it's a network error
        if (!navigator.onLine) {
          reject(new Error('Network error: No internet connection. Please check your network and try again.'));
        } else {
          reject(new Error('Failed to load Campay SDK. Please check your internet connection and try again.'));
        }
      };

      // Append script to document head
      try {
        document.head.appendChild(script);
      } catch (error) {
        this.scriptLoading = false;
        this.scriptLoadPromise = null;
        reject(new Error('Failed to inject Campay SDK script. Please refresh the page and try again.'));
      }
    });

    return this.scriptLoadPromise;
  }

  private getScriptUrl(): string {
    if (!this.appId) {
      throw new Error('App ID is required to generate script URL');
    }

    const baseUrl = this.environment === 'demo' 
      ? 'https://demo.campay.net/sdk/js'
      : 'https://www.campay.net/sdk/js';
    
    return `${baseUrl}?app-id=${encodeURIComponent(this.appId)}`;
  }

  async processPayment(
    options: CampayOptions,
    restaurantId: string,
    onSuccessCallback?: (data: CampayResponse) => void,
    onFailCallback?: (data: CampayResponse) => void,
    onModalCloseCallback?: (data: CampayResponse) => void
  ): Promise<CampayTransaction> {
    return new Promise((resolve, reject) => {
      // Validate options
      if (!options.payButtonId) {
        reject(new Error('Payment button ID is required'));
        return;
      }
      
      const amountValue = typeof options.amount === 'string' ? Number(options.amount) : options.amount;
      if (!amountValue || amountValue <= 0) {
        reject(new Error('Invalid payment amount'));
        return;
      }
      
      if (!options.currency) {
        reject(new Error('Currency is required'));
        return;
      }

      // Ensure script is loaded
      if (!this.scriptLoaded || !window.campay) {
        reject(new Error('Campay SDK not loaded. Please refresh the page and try again.'));
        return;
      }

      // Check network connectivity
      if (!navigator.onLine) {
        reject(new Error('No internet connection. Please check your network and try again.'));
        return;
      }

      // Log payment initiation
      CampayAuditLogger.log({
        userId: restaurantId,
        action: 'campay_payment_initiated',
        details: {
          restaurantId,
          reference: options.externalReference || '',
          amount: amountValue,
          environment: this.environment
        }
      });

      // Set up callbacks
      window.campay.onSuccess = (data: CampayResponse) => {
        const transaction: CampayTransaction = {
          reference: data.reference,
          status: data.status,
          amount: data.amount || 0,
          currency: data.currency || 'XAF',
          transactionId: data.transactionId,
          paymentMethod: data.paymentMethod,
          timestamp: new Date().toISOString()
        };

        // Log successful payment
        CampayAuditLogger.log({
          userId: restaurantId,
          action: 'campay_payment_success',
          details: {
            restaurantId,
            reference: data.reference,
            amount: data.amount,
            environment: this.environment
          }
        });

        // Call custom callback if provided
        if (onSuccessCallback) {
          onSuccessCallback(data);
        }

        resolve(transaction);
      };

      window.campay.onFail = (data: CampayResponse) => {
        // Log failed payment
        CampayAuditLogger.log({
          userId: restaurantId,
          action: 'campay_payment_failed',
          details: {
            restaurantId,
            reference: data.reference || options.externalReference || '',
            amount: amountValue,
            environment: this.environment,
            error: data.message || 'Payment failed'
          }
        });

        // Check for demo amount limit error
        const errorMessage = data.message || '';
        if (this.environment === 'demo' && (errorMessage.includes('Maximum amount') || errorMessage.includes('ER201'))) {
          const demoError = `Demo environment limit: Maximum amount is 10 XAF. Your order total is ${typeof options.amount === 'string' ? options.amount : String(options.amount)} XAF. Please use production environment for larger amounts.`;
          
          // Call custom callback if provided
          if (onFailCallback) {
            onFailCallback(data);
          }
          
          reject(new Error(demoError));
          return;
        }

        // Call custom callback if provided
        if (onFailCallback) {
          onFailCallback(data);
        }

        reject(new Error(data.message || 'Payment failed'));
      };

      window.campay.onModalClose = (data: CampayResponse) => {
        // Log modal close
        CampayAuditLogger.log({
          userId: restaurantId,
          action: 'campay_payment_cancelled',
          details: {
            restaurantId,
            reference: data.reference || options.externalReference || '',
            environment: this.environment
          }
        });

        // Call custom callback if provided
        if (onModalCloseCallback) {
          onModalCloseCallback(data);
        }

        // Don't reject on modal close - user cancelled, not an error
        reject(new Error('Payment cancelled by user'));
      };

      // Configure Campay options
      // CRITICAL: Campay SDK expects amount as STRING, not number (based on working test file)
      const paymentAmount = options.amount ? Math.round(Number(options.amount)) : 0;
      
      if (!paymentAmount || paymentAmount <= 0) {
        reject(new Error('Invalid payment amount. Amount must be greater than 0.'));
        return;
      }
      
      // Campay SDK expects amount as STRING (see test file: amount: "10")
      const campayOptions: CampayOptions = {
        payButtonId: options.payButtonId,
        description: options.description || 'Order payment',
        amount: String(paymentAmount), // Convert to STRING - this is the key fix!
        currency: options.currency || 'XAF',
        externalReference: options.externalReference,
        redirectUrl: options.redirectUrl
      };
      
      // Call Campay SDK options method - SIMPLE approach like the test file
      try {
        window.campay.options(campayOptions);
      } catch (error) {
        reject(new Error(`Failed to configure Campay: ${error instanceof Error ? error.message : 'Unknown error'}`));
        return;
      }
    });
  }

  isConfigured(): boolean {
    return this.appId !== null && this.scriptLoaded && !!window.campay;
  }

  // Method to trigger payment by clicking hidden button
  // SIMPLIFIED - just click the button, amount should be pre-filled from options()
  triggerPayment(buttonId: string, amount?: number): void {
    if (!this.isConfigured()) {
      throw new Error('Campay not initialized. Please ensure the payment system is properly configured.');
    }

    if (!navigator.onLine) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    const button = document.getElementById(buttonId);
    
    if (!button) {
      throw new Error(`Payment button not found. Please refresh the page and try again.`);
    }

    try {
      // Simply click the button - amount should already be set via options()
      button.click();
    } catch (error) {
      throw new Error(`Failed to trigger payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Cleanup method to remove script (useful for testing or environment switching)
  cleanup(): void {
    const script = document.querySelector(`script[src*="campay.net/sdk/js"]`);
    if (script) {
      script.remove();
    }
    this.scriptLoaded = false;
    this.scriptLoading = false;
    this.scriptLoadPromise = null;
  }

  /**
   * Test connection with a specific App ID and environment
   * This method temporarily sets the appId and environment, loads the script,
   * and verifies that the Campay SDK is available and functional.
   */
  async testConnection(appId: string, environment: 'demo' | 'production'): Promise<boolean> {
    // Check network connectivity first
    if (!navigator.onLine) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    // Validate App ID format (basic check - should not be empty)
    if (!appId || appId.trim().length === 0) {
      throw new Error('Invalid App ID. Please check your App ID and try again.');
    }

    // Store original values
    const originalAppId = this.appId;
    const originalEnvironment = this.environment;
    const wasScriptLoaded = this.scriptLoaded;

    try {
      // Set test values
      this.appId = appId.trim();
      this.environment = environment;
      this.scriptLoaded = false; // Force reload for test

      // Try to load the script
      await this.loadScript();

      // Verify that window.campay is available and has required methods
      if (!window.campay) {
        throw new Error('Campay SDK loaded but window.campay object is not available.');
      }

      // Check if required methods exist
      const requiredMethods = ['options', 'onSuccess', 'onFail', 'onModalClose'];
      const missingMethods = requiredMethods.filter(method => typeof window.campay[method as keyof typeof window.campay] !== 'function');

      if (missingMethods.length > 0) {
        throw new Error(`Campay SDK is missing required methods: ${missingMethods.join(', ')}`);
      }

      // Connection test successful
      return true;
    } catch (error) {
      // Re-throw with more context if needed
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Connection test failed. Please check your App ID and try again.');
    } finally {
      // Restore original values
      this.appId = originalAppId;
      this.environment = originalEnvironment;
      
      // If script wasn't loaded before, clean up the test script
      if (!wasScriptLoaded) {
        this.cleanup();
        this.scriptLoaded = false;
      } else {
        // If it was loaded before, restore the scriptLoaded state
        this.scriptLoaded = wasScriptLoaded;
      }
    }
  }
}

