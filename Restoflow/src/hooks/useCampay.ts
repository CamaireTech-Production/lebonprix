import { useState, useEffect, useRef } from 'react';
import { CampayService } from '../services/campayService';
import { CampayOptions, CampayTransaction, CampayResponse } from '../types/campay';
import toast from 'react-hot-toast';

export const useCampay = (restaurantId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [campayService] = useState(() => new CampayService());
  const hiddenButtonIdRef = useRef<string>(`campay-pay-button-${Date.now()}`);

  useEffect(() => {
    const initializeCampay = async () => {
      try {
        setIsScriptLoading(true);
        const config = await campayService.initializeConfig(restaurantId);
        setIsInitialized(!!config);
        
        if (config) {
          // Ensure hidden button exists in DOM
          ensureHiddenButton();
        } else {
          // Config not active or not found
          setIsInitialized(false);
        }
      } catch (error) {
        console.error('Campay initialization error:', error);
        setIsInitialized(false);
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize Campay payment system';
        
        // Provide specific error messages
        if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          toast.error('Network error: Unable to load payment system. Please check your internet connection.');
        } else if (errorMessage.includes('timeout')) {
          toast.error('Payment system loading timeout. Please refresh the page and try again.');
        } else {
          toast.error('Failed to initialize Campay payment system. Please contact support if the issue persists.');
        }
      } finally {
        setIsScriptLoading(false);
      }
    };

    if (restaurantId) {
      initializeCampay();
    }

    // Cleanup on unmount
    return () => {
      // Optionally cleanup script if needed
      // campayService.cleanup();
    };
  }, [restaurantId, campayService]);

  // Ensure hidden button exists in DOM
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
    onModalCloseCallback?: (data: CampayResponse) => void
  ): Promise<CampayTransaction | null> => {
    if (!isInitialized) {
      toast.error('Payment system not configured. Please contact the restaurant.');
      return null;
    }

    // Check network connectivity
    if (!navigator.onLine) {
      toast.error('No internet connection. Please check your network and try again.');
      return null;
    }

    setIsLoading(true);
    
    try {
      // Ensure hidden button exists
      ensureHiddenButton();
      const buttonId = hiddenButtonIdRef.current;

      // Validate payment options
      if (!options.amount || options.amount <= 0) {
        toast.error('Invalid payment amount. Please contact support.');
        return null;
      }

      // Update options with the button ID
      const paymentOptions: CampayOptions = {
        ...options,
        payButtonId: buttonId
      };

          // Set amount as data attribute on button (some SDKs read from button attributes)
          const button = document.getElementById(buttonId);
          if (button && options.amount) {
            button.setAttribute('data-amount', String(options.amount));
            button.setAttribute('data-currency', options.currency || 'XAF');
            button.setAttribute('data-description', paymentOptions.description || '');
          }

      // Set up payment promise - this configures campay.options() and sets up callbacks
      const paymentPromise = campayService.processPayment(
        paymentOptions,
        restaurantId,
        (data) => {
          if (onSuccessCallback) {
            onSuccessCallback(data);
          }
        },
        (data) => {
          if (onFailCallback) {
            onFailCallback(data);
          }
        },
        (data) => {
          if (onModalCloseCallback) {
            onModalCloseCallback(data);
          }
        }
      );

      // Trigger payment by clicking hidden button
      // Use setTimeout to ensure callbacks are fully set up before triggering
      // Pass the amount to triggerPayment so it can set it on the button
      setTimeout(() => {
        try {
          campayService.triggerPayment(buttonId, paymentOptions.amount);
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
      
      // Don't show error toast for user cancellation
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

