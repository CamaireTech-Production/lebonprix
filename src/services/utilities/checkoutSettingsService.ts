import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../core/firebase';
import type { CheckoutSettings, CheckoutSettingsUpdate } from '../../types/checkoutSettings';
import { DEFAULT_CHECKOUT_SETTINGS } from '../../types/checkoutSettings';

const COLLECTION_NAME = 'checkout_settings';

/**
 * Get checkout settings for a company (company-oriented)
 */
export const getCheckoutSettings = async (companyId: string): Promise<CheckoutSettings | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Use Firestore data as source of truth, only fill missing fields with defaults
      // CRITICAL: enabledPaymentMethods must use Firestore data directly to preserve disabled states
      return {
        ...DEFAULT_CHECKOUT_SETTINGS,
        ...data,
        id: docSnap.id,
        userId: data.userId || companyId, // Keep userId for backward compatibility
        // CRITICAL: Use Firestore enabledPaymentMethods as source of truth
        enabledPaymentMethods: (data.enabledPaymentMethods && typeof data.enabledPaymentMethods === 'object')
          ? {
              mtnMoney: data.enabledPaymentMethods.mtnMoney !== undefined 
                ? data.enabledPaymentMethods.mtnMoney 
                : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods.mtnMoney,
              orangeMoney: data.enabledPaymentMethods.orangeMoney !== undefined 
                ? data.enabledPaymentMethods.orangeMoney 
                : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods.orangeMoney,
              visaCard: data.enabledPaymentMethods.visaCard !== undefined 
                ? data.enabledPaymentMethods.visaCard 
                : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods.visaCard,
              payOnsite: data.enabledPaymentMethods.payOnsite !== undefined 
                ? data.enabledPaymentMethods.payOnsite 
                : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods.payOnsite,
            }
          : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as CheckoutSettings;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting checkout settings:', error);
    throw error;
  }
};

/**
 * Create or update checkout settings for a company (company-oriented)
 */
export const saveCheckoutSettings = async (
  companyId: string, 
  settings: CheckoutSettingsUpdate,
  userId?: string // Optional userId for audit trail
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId);
    
    // Check if settings exist
    const existingSettings = await getCheckoutSettings(companyId);
    
    if (existingSettings) {
      // When updating, ensure enabledPaymentMethods is a complete object
      const updateData: any = {
        ...settings,
        updatedAt: serverTimestamp(),
      };
      
      // If enabledPaymentMethods is being updated, ensure it's a complete object
      if (settings.enabledPaymentMethods) {
        // Merge with existing to ensure all methods are included
        updateData.enabledPaymentMethods = {
          ...existingSettings.enabledPaymentMethods,
          ...settings.enabledPaymentMethods,
        };
      }
      
      await updateDoc(docRef, updateData);
    } else {
      // Create new settings with defaults
      const newSettings = {
        ...DEFAULT_CHECKOUT_SETTINGS,
        ...settings,
        // Ensure enabledPaymentMethods is complete
        enabledPaymentMethods: settings.enabledPaymentMethods || DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods,
        userId: userId || companyId, // Keep userId for audit trail
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(docRef, newSettings);
    }
  } catch (error) {
    console.error('Error saving checkout settings:', error);
    throw error;
  }
};

/**
 * Initialize default checkout settings for a company
 */
export const initializeCheckoutSettings = async (companyId: string, userId?: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId);
    
    const defaultSettings = {
      ...DEFAULT_CHECKOUT_SETTINGS,
      userId: userId || companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    await setDoc(docRef, defaultSettings);
  } catch (error) {
    console.error('Error initializing checkout settings:', error);
    throw error;
  }
};

/**
 * Subscribe to checkout settings changes for a company (company-oriented)
 */
export const subscribeToCheckoutSettings = (
  companyId: string,
  callback: (settings: CheckoutSettings | null) => void
): Unsubscribe => {
  const docRef = doc(db, COLLECTION_NAME, companyId);
  
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      // Use Firestore data as source of truth, only fill missing fields with defaults
      // CRITICAL: enabledPaymentMethods must use Firestore data directly to preserve disabled states
      const settings: CheckoutSettings = {
        // Spread defaults first for top-level fields
        ...DEFAULT_CHECKOUT_SETTINGS,
        // Then spread Firestore data to override defaults
        ...data,
        id: doc.id,
        userId: data.userId || companyId, // Keep userId for backward compatibility
        // CRITICAL FIX: Use Firestore enabledPaymentMethods as source of truth
        // If Firestore has enabledPaymentMethods, use it directly - don't merge with defaults
        // This ensures disabled methods (false) stay disabled
        // Only use defaults if Firestore doesn't have enabledPaymentMethods at all
        enabledPaymentMethods: (data.enabledPaymentMethods && typeof data.enabledPaymentMethods === 'object')
          ? {
              // Use Firestore values directly, fill missing with defaults
              mtnMoney: data.enabledPaymentMethods.mtnMoney !== undefined 
                ? data.enabledPaymentMethods.mtnMoney 
                : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods.mtnMoney,
              orangeMoney: data.enabledPaymentMethods.orangeMoney !== undefined 
                ? data.enabledPaymentMethods.orangeMoney 
                : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods.orangeMoney,
              visaCard: data.enabledPaymentMethods.visaCard !== undefined 
                ? data.enabledPaymentMethods.visaCard 
                : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods.visaCard,
              payOnsite: data.enabledPaymentMethods.payOnsite !== undefined 
                ? data.enabledPaymentMethods.payOnsite 
                : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods.payOnsite,
            }
          : DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as CheckoutSettings;
      callback(settings);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error subscribing to checkout settings:', error);
    callback(null);
  });
};

/**
 * Reset checkout settings to defaults for a company
 */
export const resetCheckoutSettings = async (companyId: string, userId?: string): Promise<void> => {
  try {
    await saveCheckoutSettings(companyId, DEFAULT_CHECKOUT_SETTINGS, userId);
  } catch (error) {
    console.error('Error resetting checkout settings:', error);
    throw error;
  }
};

/**
 * Get checkout settings with fallback to defaults for a company
 */
export const getCheckoutSettingsWithDefaults = async (companyId: string, userId?: string): Promise<CheckoutSettings> => {
  try {
    const settings = await getCheckoutSettings(companyId);
    
    if (settings) {
      return settings;
    }
    
    // If no settings exist, initialize with defaults
    await initializeCheckoutSettings(companyId, userId);
    
    return {
      id: companyId,
      userId: userId || companyId,
      ...DEFAULT_CHECKOUT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error getting checkout settings with defaults:', error);
    throw error;
  }
};

/**
 * Get checkout settings by companyId (for public checkout) - now directly company-oriented
 * Falls back to defaults if not found
 */
export const getCheckoutSettingsByCompanyId = async (companyId: string): Promise<CheckoutSettings> => {
  try {
    const settings = await getCheckoutSettings(companyId);
    
    if (settings) {
      return settings;
    }
    
    // If no settings found, return defaults (but don't create document automatically)
    return {
      id: companyId,
      userId: companyId,
      ...DEFAULT_CHECKOUT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error getting checkout settings by companyId:', error);
    // Return defaults on error
    return {
      id: companyId,
      userId: companyId,
      ...DEFAULT_CHECKOUT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
};

/**
 * Subscribe to checkout settings by companyId (for public checkout) - now directly company-oriented
 */
export const subscribeToCheckoutSettingsByCompanyId = (
  companyId: string,
  callback: (settings: CheckoutSettings | null) => void
): Unsubscribe => {
  return subscribeToCheckoutSettings(companyId, callback);
};