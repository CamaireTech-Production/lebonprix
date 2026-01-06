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
import { getCompanyById } from '../firestore/companies/companyPublic';

const COLLECTION_NAME = 'checkout_settings';

/**
 * Get checkout settings for a user
 */
export const getCheckoutSettings = async (userId: string): Promise<CheckoutSettings | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Use Firestore data as source of truth, only fill missing fields with defaults
      return {
        ...data,
        id: docSnap.id,
        userId,
        // Only use defaults for missing fields
        enabledPaymentMethods: data.enabledPaymentMethods || DEFAULT_CHECKOUT_SETTINGS.enabledPaymentMethods,
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
 * Create or update checkout settings for a user
 */
export const saveCheckoutSettings = async (
  userId: string, 
  settings: CheckoutSettingsUpdate
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    
    // Check if settings exist
    const existingSettings = await getCheckoutSettings(userId);
    
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
        userId,
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
 * Initialize default checkout settings for a new user
 */
export const initializeCheckoutSettings = async (userId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    
    const defaultSettings = {
      ...DEFAULT_CHECKOUT_SETTINGS,
      userId,
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
 * Subscribe to checkout settings changes
 */
export const subscribeToCheckoutSettings = (
  userId: string,
  callback: (settings: CheckoutSettings | null) => void
): Unsubscribe => {
  const docRef = doc(db, COLLECTION_NAME, userId);
  
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
        userId,
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
 * Reset checkout settings to defaults
 */
export const resetCheckoutSettings = async (userId: string): Promise<void> => {
  try {
    await saveCheckoutSettings(userId, DEFAULT_CHECKOUT_SETTINGS);
  } catch (error) {
    console.error('Error resetting checkout settings:', error);
    throw error;
  }
};

/**
 * Get checkout settings with fallback to defaults
 */
export const getCheckoutSettingsWithDefaults = async (userId: string): Promise<CheckoutSettings> => {
  try {
    const settings = await getCheckoutSettings(userId);
    
    if (settings) {
      return settings;
    }
    
    // If no settings exist, initialize with defaults
    await initializeCheckoutSettings(userId);
    
    return {
      id: userId,
      userId,
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
 * Get checkout settings by companyId (for public checkout)
 * Falls back to defaults if not found
 */
export const getCheckoutSettingsByCompanyId = async (companyId: string): Promise<CheckoutSettings> => {
  try {
    // Try to get company document to find userId
    const company = await getCompanyById(companyId);
    
    if (company?.userId) {
      const settings = await getCheckoutSettings(company.userId);
      if (settings) {
        return settings;
      }
    }
    
    // If no settings found, return defaults
    return {
      id: companyId,
      userId: company?.userId || companyId,
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
 * Subscribe to checkout settings by companyId (for public checkout)
 */
export const subscribeToCheckoutSettingsByCompanyId = (
  companyId: string,
  callback: (settings: CheckoutSettings) => void
): Unsubscribe => {
  let unsubscribeFn: Unsubscribe | null = null;
  
  // Try to get company and subscribe to user's settings
  getCompanyById(companyId)
    .then((company) => {
      if (company?.userId) {
        unsubscribeFn = subscribeToCheckoutSettings(company.userId, (settings) => {
          if (settings) {
            callback(settings);
          } else {
            // Return defaults if no settings
            callback({
              id: companyId,
              userId: company.userId,
              ...DEFAULT_CHECKOUT_SETTINGS,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        });
      } else {
        // Return defaults if no company found
        callback({
          id: companyId,
          userId: companyId,
          ...DEFAULT_CHECKOUT_SETTINGS,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    })
    .catch((error) => {
      console.error('Error subscribing to checkout settings by companyId:', error);
      // Return defaults on error
      callback({
        id: companyId,
        userId: companyId,
        ...DEFAULT_CHECKOUT_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  
  // Return unsubscribe function
  return () => {
    if (unsubscribeFn) {
      unsubscribeFn();
    }
  };
};