import { useState, useEffect, useRef } from 'react';
import { CampayService } from '@services/payment/CampayPaymentService';
import { CampayOptions, CampayResponse } from '../types/campay';
import toast from 'react-hot-toast';

export interface UseCampayReturn {
  processPayment: (
    options: CampayOptions,
    onSuccessCallback?: (data: CampayResponse) => void,
    onFailCallback?: (data: CampayResponse) => void,
    onModalCloseCallback?: (data?: CampayResponse) => void
  ) => Promise<CampayResponse | null>;
  isLoading: boolean;
  isInitialized: boolean;
  isScriptLoading: boolean;
  hiddenButtonId: string;
}

/**
 * React hook for Campay payment integration
 * Matches RestoFlow's implementation pattern
 * 
 * @param companyId - The company ID to load Campay configuration for
 * @returns Object containing payment processing function and state
 */
export const useCampay = (companyId: string | null): UseCampayReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [campayService] = useState(() => new CampayService());
  const hiddenButtonIdRef = useRef<string>(`campay-pay-button-${Date.now()}`);

  useEffect(() => {
    const initializeCampay = async () => {
      if (!companyId) {
        setIsInitialized(false);
        return;
      }

      try {
        setIsScriptLoading(true);
        await campayService.initializeConfig(companyId);
        const isConfigured = campayService.isConfigured();
        setIsInitialized(isConfigured);
        
        if (isConfigured) {
          // Ensure hidden button exists in DOM (matching RestoFlow)
          ensureHiddenButton();
        } else {
          setIsInitialized(false);
          // Campay is not configured - this is normal, no error needed
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Campay payment system';
        
        // Only log and show errors if Campay was configured but failed to initialize
        // If config was not found, that's normal and should be handled silently
        if (errorMessage.includes('configuration not found')) {
          // Campay is not configured - this is normal, handle silently
          setIsInitialized(false);
        } else {
          // Actual error occurred - log and show notification
          console.error('Campay initialization error:', error);
          setIsInitialized(false);
          
          // Provide specific error messages (matching RestoFlow)
          if (errorMessage.includes('network') || errorMessage.includes('connection')) {
            toast.error('Network error: Unable to load payment system. Please check your internet connection.');
          } else if (errorMessage.includes('timeout')) {
            toast.error('Payment system loading timeout. Please refresh the page and try again.');
          } else {
            toast.error('Failed to initialize Campay payment system. Please contact support if the issue persists.');
          }
        }
      } finally {
        setIsScriptLoading(false);
      }
    };

    if (companyId) {
      initializeCampay();
    }

    // Cleanup on unmount (matching RestoFlow)
    return () => {
      // Optionally cleanup script if needed
      // campayService.cleanup();
    };
  }, [companyId, campayService]);

  // Ensure hidden button exists in DOM (matching RestoFlow)
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

  const processPayment = async (
    options: CampayOptions,
    onSuccessCallback?: (data: CampayResponse) => void,
    onFailCallback?: (data: CampayResponse) => void,
    onModalCloseCallback?: (data?: CampayResponse) => void
  ): Promise<CampayResponse | null> => {
    if (!isInitialized) {
      toast.error('Payment system not configured. Please contact the company.');
      return null;
    }

    // Check network connectivity (matching RestoFlow)
    if (!navigator.onLine) {
      toast.error('No internet connection. Please check your network and try again.');
      return null;
    }

    setIsLoading(true);
    
    try {
      // Ensure hidden button exists
      ensureHiddenButton();
      const buttonId = hiddenButtonIdRef.current;

      // Validate payment options (matching RestoFlow)
      const amountValue = typeof options.amount === 'string' ? Number(options.amount) : options.amount;
      if (!amountValue || amountValue <= 0) {
        toast.error('Invalid payment amount. Please contact support.');
        return null;
      }

      // Update options with the button ID
      const paymentOptions: CampayOptions = {
        ...options,
        payButtonId: buttonId
      };

      // Set amount as data attribute on button (matching RestoFlow)
      const button = document.getElementById(buttonId);
      if (button && options.amount) {
        button.setAttribute('data-amount', String(options.amount));
        button.setAttribute('data-currency', options.currency || 'XAF');
        button.setAttribute('data-description', paymentOptions.description || '');
      }

      // Set up payment promise - this configures campay.options() and sets up callbacks
      const paymentPromise = campayService.processPayment(
        paymentOptions,
        {
          onSuccess: (data) => {
            if (onSuccessCallback) {
              onSuccessCallback(data);
            }
          },
          onFail: (data) => {
            if (onFailCallback) {
              onFailCallback(data);
            }
          },
          onModalClose: (data) => {
            if (onModalCloseCallback) {
              onModalCloseCallback(data);
            }
          }
        }
      );

      // Trigger payment by clicking hidden button (matching RestoFlow)
      // Use setTimeout to ensure callbacks are fully set up before triggering
      setTimeout(() => {
        try {
          campayService.triggerPayment(buttonId);
        } catch (error) {
          console.error('Failed to trigger payment:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to trigger payment';
          toast.error(errorMessage);
        }
      }, 50);

      // Wait for payment result from callbacks
      const result = await paymentPromise;
      return result;
    } catch (error: unknown) {
      console.error('Payment error:', error);
      const errorMessage = (error as Error).message || 'Payment failed';
      
      // Don't show error toast for user cancellation (matching RestoFlow)
      if (!errorMessage.includes('cancelled') && !errorMessage.includes('cancellation')) {
        // Provide user-friendly error messages
        if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          toast.error('Network error. Please check your internet connection and try again.');
        } else if (errorMessage.includes('timeout')) {
          toast.error('Payment request timed out. Please try again.');
        } else if (errorMessage.includes('not loaded') || errorMessage.includes('not initialized')) {
          toast.error('Payment system error. Please refresh the page and try again.');
        } else {
          toast.error(errorMessage);
        }
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    processPayment,
    isLoading,
    isInitialized,
    isScriptLoading,
    hiddenButtonId: hiddenButtonIdRef.current
  };
};

