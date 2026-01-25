import { useState, useEffect } from 'react';
import { CinetPayService } from '../services/cinetpayService';
import { CinetPayOptions, CinetPayTransaction } from '../types/cinetpay';
import toast from 'react-hot-toast';

export const useCinetPay = (restaurantId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cinetpayService] = useState(() => new CinetPayService());

  useEffect(() => {
    const initializeCinetPay = async () => {
      try {
        const config = await cinetpayService.initializeConfig(restaurantId);
        setIsInitialized(!!config);
      } catch (error) {
        console.error('CinetPay initialization error:', error);
        setIsInitialized(false);
      }
    };

    if (restaurantId) {
      initializeCinetPay();
    }
  }, [restaurantId, cinetpayService]);

  const processPayment = async (options: CinetPayOptions): Promise<CinetPayTransaction | null> => {
    if (!isInitialized) {
      toast.error('Payment system not configured');
      return null;
    }

    setIsLoading(true);
    
    try {
      const result = await cinetpayService.processPayment(options, restaurantId);
      toast.success('Payment successful!');
      return result;
    } catch (error: unknown) {
      console.error('Payment error:', error);
      toast.error((error as Error).message || 'Payment failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    processPayment,
    isLoading,
    isInitialized
  };
};
