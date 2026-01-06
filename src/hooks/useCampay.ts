import { useState, useEffect, useRef } from 'react';
import { 
  getCampayConfig, 
  initializeCampayConfig,
  isCampayConfigured 
} from '@services/payment/campayService';
import { 
  processCampayPayment 
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
    const initializeCampay = async () => {
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
          setIsInitialized(true);
          ensureHiddenButton();
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

    initializeCampay();
  }, [companyId]);

  // Create hidden button for SDK
  const ensureHiddenButton = () => {
    const buttonId = hiddenButtonIdRef.current;
    let button = document.getElementById(buttonId);
    
    if (!button) {
      button = document.createElement('button');
      button.id = buttonId;
      button.style.display = 'none';
      button.setAttribute('type', 'button');
      document.body.appendChild(button);
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

    if (!isInitialized) {
      console.error('Campay not initialized');
      if (onFailCallback) {
        onFailCallback({
          status: 'error',
          reference: '',
          message: 'Campay payment is not available'
        });
      }
      return null;
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
    config
  };
};

