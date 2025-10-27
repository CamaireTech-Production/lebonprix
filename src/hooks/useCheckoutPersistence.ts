import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  saveCheckoutDataWithCart,
  loadCheckoutData,
  loadCheckoutDataWithCart,
  loadCartData,
  clearCheckoutData,
  getDataFreshness,
  type CheckoutFormData,
  type CheckoutPersistenceData
} from '../utils/checkoutPersistence';

interface UseCheckoutPersistenceOptions {
  companyId: string | null;
  autoSave?: boolean;
  saveDelay?: number; // milliseconds
}

interface UseCheckoutPersistenceReturn {
  saveData: (formData: CheckoutFormData, cartItems: any[], cartTotal: number) => void;
  loadData: () => CheckoutPersistenceData | null;
  loadCartOnly: () => { cartItems: any[]; cartTotal: number } | null;
  clearData: () => void;
  isDataAvailable: boolean;
  dataFreshness: {
    isFresh: boolean;
    savedAt: Date | null;
    expiresAt: Date | null;
  };
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
}

export const useCheckoutPersistence = ({
  companyId
}: UseCheckoutPersistenceOptions): UseCheckoutPersistenceReturn => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDataAvailable, setIsDataAvailable] = useState(false);

  // Check if data is available for this company
  useEffect(() => {
    if (companyId) {
      const data = loadCheckoutData(companyId);
      setIsDataAvailable(!!data);
    } else {
      setIsDataAvailable(false);
    }
  }, [companyId]);

  // Get data freshness info (memoized to prevent continuous execution)
  const dataFreshness = useMemo(() => {
    if (!companyId) {
      return {
        isFresh: false,
        age: 0,
        lastSaved: null
      };
    }
    
    try {
      return getDataFreshness(companyId);
    } catch (error) {
      console.error('Error getting data freshness:', error);
      return {
        isFresh: false,
        age: 0,
        lastSaved: null
      };
    }
  }, [companyId]); // Only recalculate when companyId changes

  // Save data function
  const saveData = useCallback((
    formData: CheckoutFormData,
    cartItems: any[],
    cartTotal: number
  ) => {
    if (!companyId) return;

    try {
      saveCheckoutDataWithCart(companyId, formData, cartItems, cartTotal);
      setHasUnsavedChanges(false);
      setIsDataAvailable(true);
    } catch (error) {
      console.error('Error saving checkout data:', error);
    }
  }, [companyId]);

  // Load data function
  const loadData = useCallback((): CheckoutPersistenceData | null => {
    if (!companyId) return null;

    try {
      const data = loadCheckoutDataWithCart(companyId);
      if (data) {
        setIsDataAvailable(true);
        setHasUnsavedChanges(false);
      }
      return data;
    } catch (error) {
      console.error('Error loading checkout data:', error);
      return null;
    }
  }, [companyId]);

  // Load cart only function
  const loadCartOnly = useCallback(() => {
    if (!companyId) return null;

    try {
      const cartData = loadCartData(companyId);
      if (cartData) {
        setIsDataAvailable(true);
      }
      return cartData;
    } catch (error) {
      console.error('Error loading cart data:', error);
      return null;
    }
  }, [companyId]);

  // Clear data function
  const clearData = useCallback(() => {
    if (!companyId) return;

    try {
      clearCheckoutData(companyId);
      setIsDataAvailable(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error clearing checkout data:', error);
    }
  }, [companyId]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Any cleanup if needed
    };
  }, []);

  return {
    saveData,
    loadData,
    loadCartOnly,
    clearData,
    isDataAvailable,
    dataFreshness,
    hasUnsavedChanges,
    setHasUnsavedChanges
  };
};

/**
 * Hook for auto-saving checkout data with debouncing
 */
export const useAutoSaveCheckout = (
  companyId: string | null,
  formData: CheckoutFormData,
  cartItems: any[],
  cartTotal: number,
  options: { 
    enabled?: boolean; 
    delay?: number;
    onSave?: () => void;
    onSaving?: () => void;
    onError?: (error: Error) => void;
  } = {}
) => {
  const { enabled = true, delay = 1000, onSave, onSaving, onError } = options;
  const { saveData, setHasUnsavedChanges } = useCheckoutPersistence({
    companyId,
    autoSave: false // We'll handle auto-save manually
  });

  // Memoize the data to prevent unnecessary re-runs
  const formDataKey = useMemo(() => JSON.stringify({
    customerInfo: formData.customerInfo,
    selectedPaymentMethod: formData.selectedPaymentMethod,
    selectedPaymentOption: formData.selectedPaymentOption,
    paymentFormData: formData.paymentFormData
  }), [formData.customerInfo, formData.selectedPaymentMethod, formData.selectedPaymentOption, formData.paymentFormData]);

  const cartItemsKey = useMemo(() => {
    return cartItems.map(item => `${item.id}-${item.quantity}`).join(',');
  }, [cartItems]);

  const memoizedFormData = useMemo(() => formData, [formDataKey]);
  const memoizedCartItems = useMemo(() => cartItems, [cartItemsKey]);

  const memoizedCartTotal = useMemo(() => cartTotal, [cartTotal]);

  useEffect(() => {
    if (!enabled || !companyId) return;

    setHasUnsavedChanges(true);
    onSaving?.();

    const timeoutId = setTimeout(() => {
      try {
        saveData(memoizedFormData, memoizedCartItems, memoizedCartTotal);
        onSave?.();
      } catch (error) {
        onError?.(error as Error);
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [memoizedFormData, memoizedCartItems, memoizedCartTotal, companyId, enabled, delay, saveData, setHasUnsavedChanges, onSave, onSaving, onError]);
};
