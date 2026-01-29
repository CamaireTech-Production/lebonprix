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
      // Use Firestore data as source of truth, but apply new defaults for contact fields
      // This ensures that updated defaults (email/newsletter disabled) are applied
      // CRITICAL: enabledPaymentMethods must use Firestore data directly to preserve disabled states
      const settings = {
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
      
      // Apply new defaults for contact fields (migrate old settings)
      // If settings have old defaults (email/newsletter enabled) or missing new fields, update them
      const needsMigration = 
        settings.showEmail === true || 
        settings.showNewsletter === true ||
        settings.showName === undefined ||
        settings.showQuarter === undefined ||
        settings.showDeliveryName === undefined ||
        settings.showDeliveryAddressLine1 === undefined;
      
      if (needsMigration) {
        // Migrate to new defaults asynchronously (don't block)
        migrateCheckoutSettingsToNewDefaults(companyId, data.userId).catch(err => {
          console.error('Error migrating checkout settings:', err);
        });
        // Return settings with new defaults applied
        return {
          ...settings,
          showName: DEFAULT_CHECKOUT_SETTINGS.showName,
          showPhone: DEFAULT_CHECKOUT_SETTINGS.showPhone,
          showQuarter: DEFAULT_CHECKOUT_SETTINGS.showQuarter,
          showEmail: DEFAULT_CHECKOUT_SETTINGS.showEmail,
          showNewsletter: DEFAULT_CHECKOUT_SETTINGS.showNewsletter,
          showDeliveryName: DEFAULT_CHECKOUT_SETTINGS.showDeliveryName,
          showDeliveryPhone: DEFAULT_CHECKOUT_SETTINGS.showDeliveryPhone,
          showDeliveryAddressLine1: DEFAULT_CHECKOUT_SETTINGS.showDeliveryAddressLine1,
          showDeliveryAddressLine2: DEFAULT_CHECKOUT_SETTINGS.showDeliveryAddressLine2,
          showDeliveryQuarter: DEFAULT_CHECKOUT_SETTINGS.showDeliveryQuarter,
          showDeliveryCity: DEFAULT_CHECKOUT_SETTINGS.showDeliveryCity,
          showDeliveryInstructions: DEFAULT_CHECKOUT_SETTINGS.showDeliveryInstructions,
          showCountry: DEFAULT_CHECKOUT_SETTINGS.showCountry,
        };
      }
      
      return settings;
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
      // Use Firestore data as source of truth, but apply new defaults for contact fields
      // This ensures that updated defaults (email/newsletter disabled) are applied
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
      
      // Apply new defaults for contact fields (migrate old settings)
      // If settings have old defaults (email/newsletter enabled) or missing new fields, update them
      const needsMigration = 
        settings.showEmail === true || 
        settings.showNewsletter === true ||
        settings.showName === undefined ||
        settings.showQuarter === undefined ||
        settings.showDeliveryName === undefined ||
        settings.showDeliveryAddressLine1 === undefined;
      
      if (needsMigration) {
        // Migrate to new defaults asynchronously (don't block)
        migrateCheckoutSettingsToNewDefaults(companyId, data.userId).catch(err => {
          console.error('Error migrating checkout settings:', err);
        });
        // Return settings with new defaults applied
        const migratedSettings = {
          ...settings,
          showName: DEFAULT_CHECKOUT_SETTINGS.showName,
          showPhone: DEFAULT_CHECKOUT_SETTINGS.showPhone,
          showQuarter: DEFAULT_CHECKOUT_SETTINGS.showQuarter,
          showEmail: DEFAULT_CHECKOUT_SETTINGS.showEmail,
          showNewsletter: DEFAULT_CHECKOUT_SETTINGS.showNewsletter,
          showDeliveryName: DEFAULT_CHECKOUT_SETTINGS.showDeliveryName,
          showDeliveryPhone: DEFAULT_CHECKOUT_SETTINGS.showDeliveryPhone,
          showDeliveryAddressLine1: DEFAULT_CHECKOUT_SETTINGS.showDeliveryAddressLine1,
          showDeliveryAddressLine2: DEFAULT_CHECKOUT_SETTINGS.showDeliveryAddressLine2,
          showDeliveryQuarter: DEFAULT_CHECKOUT_SETTINGS.showDeliveryQuarter,
          showDeliveryCity: DEFAULT_CHECKOUT_SETTINGS.showDeliveryCity,
          showDeliveryInstructions: DEFAULT_CHECKOUT_SETTINGS.showDeliveryInstructions,
          showCountry: DEFAULT_CHECKOUT_SETTINGS.showCountry,
        };
        callback(migratedSettings);
      } else {
        callback(settings);
      }
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

/**
 * Migrate existing checkout settings to use new defaults (email and newsletter disabled)
 * This should be called once to update existing settings
 */
export const migrateCheckoutSettingsToNewDefaults = async (
  companyId: string,
  userId?: string
): Promise<void> => {
  try {
    const existingSettings = await getCheckoutSettings(companyId);
    if (!existingSettings) {
      return; // No settings to migrate
    }

    // Update settings with new defaults for contact and delivery fields
    const updates: CheckoutSettingsUpdate = {
      // Contact fields - new structure
      showName: DEFAULT_CHECKOUT_SETTINGS.showName, // true
      showPhone: DEFAULT_CHECKOUT_SETTINGS.showPhone, // true
      showQuarter: DEFAULT_CHECKOUT_SETTINGS.showQuarter, // true
      showEmail: DEFAULT_CHECKOUT_SETTINGS.showEmail, // false
      showNewsletter: DEFAULT_CHECKOUT_SETTINGS.showNewsletter, // false
      // Delivery fields - new structure
      showDeliveryName: DEFAULT_CHECKOUT_SETTINGS.showDeliveryName, // true
      showDeliveryPhone: DEFAULT_CHECKOUT_SETTINGS.showDeliveryPhone, // true
      showDeliveryAddressLine1: DEFAULT_CHECKOUT_SETTINGS.showDeliveryAddressLine1, // false (désactivé par défaut)
      showDeliveryAddressLine2: DEFAULT_CHECKOUT_SETTINGS.showDeliveryAddressLine2, // false (désactivé par défaut)
      showDeliveryQuarter: DEFAULT_CHECKOUT_SETTINGS.showDeliveryQuarter, // true
      showDeliveryCity: DEFAULT_CHECKOUT_SETTINGS.showDeliveryCity, // false (désactivé par défaut)
      showDeliveryInstructions: DEFAULT_CHECKOUT_SETTINGS.showDeliveryInstructions, // true
      showCountry: DEFAULT_CHECKOUT_SETTINGS.showCountry, // false
    };

    await saveCheckoutSettings(companyId, updates, userId);
  } catch (error) {
    console.error('Error migrating checkout settings:', error);
    throw error;
  }
};