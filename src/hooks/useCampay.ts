import { useState, useEffect, useRef } from 'react';
import { 
  getCampayConfig, 
  initializeCampayConfig,
  isCampayConfigured 
} from '@services/payment/campayService';
import { 
  processCampayPayment,
  initializeCampay as initializeCampaySDK
} from '@utils/core/campayHandler';
import type { 
  CampayConfig, 
  CampayOptions, 
  CampayResponse,
  CampayCallbacks 
} from '../types/campay';

export interface UseCampayReturn {
  processPayment: (
    options: CampayOptions,
    onSuccessCallback?: (data: CampayResponse) => void,
    onFailCallback?: (data: CampayResponse) => void,
    onModalCloseCallback?: (data?: CampayResponse) => void
  ) => Promise<CampayResponse | null>;
  isLoading: boolean;
  isInitialized: boolean;
  hiddenButtonId: string;
  config: CampayConfig | null;
}

/**
 * React hook for Campay payment integration
 * 
 * @param companyId - The company ID to load Campay configuration for
 * @returns Object containing payment processing function and state
 */
export const useCampay = (companyId: string | null): UseCampayReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [config, setConfig] = useState<CampayConfig | null>(null);
  const hiddenButtonIdRef = useRef<string>(`campay-pay-button-${Date.now()}`);

  // Initialize Campay configuration on mount
  useEffect(() => {
    const initializeConfig = async () => {
      if (!companyId) {
        setIsInitialized(false);
        setConfig(null);
        return;
      }

      try {
        setIsLoading(true);
        
        // Try to get existing config
        let campayConfig = await getCampayConfig(companyId);
        
        // If no config exists, initialize with defaults
        if (!campayConfig) {
          campayConfig = await initializeCampayConfig(companyId);
        }

        // Check if Campay is properly configured
        const configured = isCampayConfigured(campayConfig);
        
        if (configured && campayConfig) {
          setConfig(campayConfig);
          // Ensure hidden button exists in DOM (like RestoFlow)
          ensureHiddenButton();
          
          // Preload SDK immediately when config is ready (like working sample)
          try {
            await initializeCampaySDK(campayConfig.appId, campayConfig.environment);
            setIsInitialized(true);
            console.log('Campay SDK preloaded and ready');
          } catch (error) {
            console.error('Campay SDK preload failed:', error);
            setIsInitialized(false);
          }
        } else {
          setConfig(campayConfig);
          setIsInitialized(false);
        }
      } catch (error) {
        console.error('Error initializing Campay:', error);
        setConfig(null);
        setIsInitialized(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeConfig();
  }, [companyId]);

  // Ensure hidden button exists in DOM (like RestoFlow)
  // This creates the button programmatically to ensure it's always available
  const ensureHiddenButton = () => {
    const buttonId = hiddenButtonIdRef.current;
    let button = document.getElementById(buttonId);
    
    if (!button) {
      button = document.createElement('button');
      button.id = buttonId;
      button.style.display = 'none';
      button.setAttribute('type', 'button');
      button.setAttribute('aria-hidden', 'true');
      document.body.appendChild(button);
      console.log('Campay hidden button created programmatically:', buttonId);
    }
  };

  // Process payment
  const processPayment = async (
    options: CampayOptions,
    onSuccessCallback?: (data: CampayResponse) => void,
    onFailCallback?: (data: CampayResponse) => void,
    onModalCloseCallback?: (data?: CampayResponse) => void
  ): Promise<CampayResponse | null> => {
    if (!companyId || !config) {
      console.error('Campay not initialized or company ID missing');
      if (onFailCallback) {
        onFailCallback({
          status: 'error',
          reference: '',
          message: 'Campay is not properly configured'
        });
      }
      return null;
    }

    // If not initialized, try to initialize on-demand
    if (!isInitialized) {
      console.warn('Campay SDK not initialized, attempting to initialize on-demand...');
      
      if (!config) {
        console.error('Campay config not available');
        if (onFailCallback) {
          onFailCallback({
            status: 'error',
            reference: '',
            message: 'Campay payment is not configured'
          });
        }
        return null;
      }
      
      try {
        // Try to initialize SDK on-demand
        const { initializeCampay: initSDK } = await import('@utils/core/campayHandler');
        await initSDK(config.appId, config.environment);
        
        // Like RestoFlow: Only check if window.campay exists after loading
        if (!window.campay) {
          throw new Error('Campay SDK loaded but window.campay object is not available.');
        }
        
        console.log('Campay SDK initialized on-demand and ready');
      } catch (error) {
        console.error('Failed to initialize Campay SDK on-demand:', error);
        if (onFailCallback) {
          onFailCallback({
            status: 'error',
            reference: '',
            message: error instanceof Error ? error.message : 'Failed to initialize payment system. Please try again.'
          });
        }
        return null;
      }
    }

    // Ensure hidden button exists
    ensureHiddenButton();

    try {
      setIsLoading(true);

      // Prepare payment data
      const paymentData = {
        amount: typeof options.amount === 'string' ? Number(options.amount) : options.amount,
        currency: options.currency || 'XAF',
        description: options.description || 'Order payment',
        externalReference: options.externalReference,
        redirectUrl: options.redirectUrl
      };

      // Set up callbacks
      const callbacks: CampayCallbacks = {
        onSuccess: (data) => {
          setIsLoading(false);
          if (onSuccessCallback) {
            onSuccessCallback(data);
          }
        },
        onFail: (data) => {
          setIsLoading(false);
          if (onFailCallback) {
            onFailCallback(data);
          }
        },
        onModalClose: (data) => {
          setIsLoading(false);
          if (onModalCloseCallback) {
            onModalCloseCallback(data);
          }
        }
      };

      // Process payment
      const result = await processCampayPayment(
        config,
        paymentData,
        callbacks,
        hiddenButtonIdRef.current
      );

      // If payment was cancelled or failed, call appropriate callback
      if (!result.success) {
        if (result.error?.includes('cancelled')) {
          if (onModalCloseCallback) {
            onModalCloseCallback();
          }
        } else if (onFailCallback) {
          onFailCallback({
            status: 'failed',
            reference: result.reference || '',
            message: result.error || result.message || 'Payment failed'
          });
        }
      }

      return result.success ? {
        status: 'success',
        reference: result.reference || '',
        transactionId: result.transactionId,
        amount: paymentData.amount,
        currency: paymentData.currency
      } : null;

    } catch (error) {
      console.error('Error processing Campay payment:', error);
      setIsLoading(false);
      
      if (onFailCallback) {
        onFailCallback({
          status: 'error',
          reference: '',
          message: error instanceof Error ? error.message : 'Payment processing failed'
        });
      }
      
      return null;
    }
  };

  return {
    processPayment,
    isLoading,
    isInitialized,
    hiddenButtonId: hiddenButtonIdRef.current,
    config // Expose config so component can use it
  };
};

