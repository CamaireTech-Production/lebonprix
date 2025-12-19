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
 * Get checkout settings for a user
 */
export const getCheckoutSettings = async (userId: string): Promise<CheckoutSettings | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId,
        ...data,
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
      // Update existing settings
      await updateDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new settings with defaults
      const newSettings = {
        ...DEFAULT_CHECKOUT_SETTINGS,
        ...settings,
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
      const settings: CheckoutSettings = {
        ...DEFAULT_CHECKOUT_SETTINGS,
        ...data,
        id: doc.id,
        userId,
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
