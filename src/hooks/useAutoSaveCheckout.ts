/**
 * Auto-Save Checkout Hook
 * Provides real-time auto-save functionality for checkout form data
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  saveCheckoutData, 
  loadCheckoutData, 
  clearCheckoutData,
  getDataFreshness,
  type CheckoutFormData 
} from '../utils/checkoutPersistence';

export interface UseAutoSaveCheckoutOptions {
  companyId: string;
  autoSaveInterval?: number; // milliseconds, default 2000
  enableAutoSave?: boolean; // default true
  onSave?: (data: CheckoutFormData) => void;
  onLoad?: (data: CheckoutFormData) => void;
  onError?: (error: Error) => void;
}

export interface UseAutoSaveCheckoutReturn {
  // Form data
  formData: CheckoutFormData;
  setFormData: (data: CheckoutFormData | ((prev: CheckoutFormData) => CheckoutFormData)) => void;
  
  // Auto-save state
  isSaving: boolean;
  lastSaved: string | null;
  hasUnsavedChanges: boolean;
  
  // Data freshness
  isDataFresh: boolean;
  dataAge: number;
  
  // Actions
  saveNow: () => void;
  clearData: () => void;
  loadData: () => CheckoutFormData | null;
  
  // Status
  hasExistingData: boolean;
}

export const useAutoSaveCheckout = (options: UseAutoSaveCheckoutOptions): UseAutoSaveCheckoutReturn => {
  const {
    companyId,
    autoSaveInterval = 2000,
    enableAutoSave = true,
    onSave,
    onLoad,
    onError
  } = options;

  // State
  const [formData, setFormData] = useState<CheckoutFormData>(() => {
    // Initialize with empty data structure
    return {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      country: 'Cameroon',
      zipCode: '',
      selectedPaymentMethod: '',
      selectedPaymentOption: '',
      cartItems: [],
      lastSaved: '',
      companyId
    };
  });

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDataFresh, setIsDataFresh] = useState(false);
  const [dataAge, setDataAge] = useState(0);
  const [hasExistingData, setHasExistingData] = useState(false);

  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');

  // Load existing data on mount
  useEffect(() => {
    if (!companyId) return;

    try {
      const existingData = loadCheckoutData(companyId);
      if (existingData) {
        setFormData(existingData);
        setLastSaved(existingData.lastSaved);
        setHasExistingData(true);
        onLoad?.(existingData);
        console.log('Checkout data loaded from localStorage');
      }

      // Check data freshness
      const freshness = getDataFreshness(companyId);
      setIsDataFresh(freshness.isFresh);
      setDataAge(freshness.age);
    } catch (error) {
      console.error('Error loading checkout data:', error);
      onError?.(error as Error);
    }
  }, [companyId, onLoad, onError]);

  // Auto-save function
  const saveNow = useCallback(() => {
    if (!companyId || !enableAutoSave) return;

    try {
      setIsSaving(true);
      saveCheckoutData(companyId, formData);
      setLastSaved(new Date().toISOString());
      setHasUnsavedChanges(false);
      lastSavedDataRef.current = JSON.stringify(formData);
      onSave?.(formData);
      console.log('Checkout data auto-saved');
    } catch (error) {
      console.error('Error auto-saving checkout data:', error);
      onError?.(error as Error);
    } finally {
      setIsSaving(false);
    }
  }, [companyId, formData, enableAutoSave, onSave, onError]);

  // Auto-save effect
  useEffect(() => {
    if (!enableAutoSave || !companyId) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Check if data has changed
    const currentDataString = JSON.stringify(formData);
    const hasChanged = currentDataString !== lastSavedDataRef.current;
    
    if (hasChanged) {
      setHasUnsavedChanges(true);
      
      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveNow();
      }, autoSaveInterval);
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, autoSaveInterval, enableAutoSave, saveNow]);

  // Manual save function
  const saveNowManual = useCallback(() => {
    if (!companyId) return;
    saveNow();
  }, [companyId, saveNow]);

  // Clear data function
  const clearData = useCallback(() => {
    if (!companyId) return;
    
    try {
      clearCheckoutData(companyId);
      setFormData({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        country: 'Cameroon',
        zipCode: '',
        selectedPaymentMethod: '',
        selectedPaymentOption: '',
        cartItems: [],
        lastSaved: '',
        companyId
      });
      setLastSaved(null);
      setHasUnsavedChanges(false);
      setHasExistingData(false);
      console.log('Checkout data cleared');
    } catch (error) {
      console.error('Error clearing checkout data:', error);
      onError?.(error as Error);
    }
  }, [companyId, onError]);

  // Load data function
  const loadData = useCallback((): CheckoutFormData | null => {
    if (!companyId) return null;
    
    try {
      const data = loadCheckoutData(companyId);
      if (data) {
        setFormData(data);
        setLastSaved(data.lastSaved);
        setHasExistingData(true);
        onLoad?.(data);
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error loading checkout data:', error);
      onError?.(error as Error);
      return null;
    }
  }, [companyId, onLoad, onError]);

  // Update data freshness periodically
  useEffect(() => {
    if (!companyId) return;

    const updateFreshness = () => {
      const freshness = getDataFreshness(companyId);
      setIsDataFresh(freshness.isFresh);
      setDataAge(freshness.age);
    };

    updateFreshness();
    const interval = setInterval(updateFreshness, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [companyId]);

  return {
    formData,
    setFormData,
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    isDataFresh,
    dataAge,
    saveNow: saveNowManual,
    clearData,
    loadData,
    hasExistingData
  };
};
