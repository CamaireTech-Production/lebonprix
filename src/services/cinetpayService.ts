import { db } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { 
  CinetPayConfig, 
  CinetPayConfigUpdate, 
  CinetPayValidationResult,
  DEFAULT_CINETPAY_CONFIG
} from '../types/cinetpay';

const COLLECTION_NAME = 'cinetpay_configs';

// Get CinetPay configuration for a user
export const getCinetPayConfig = async (userId: string): Promise<CinetPayConfig | null> => {
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
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as CinetPayConfig;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting CinetPay config:', error);
    throw error;
  }
};

// Save CinetPay configuration
export const saveCinetPayConfig = async (
  userId: string, 
  config: CinetPayConfigUpdate
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const now = serverTimestamp();

    const dataToSave = {
      ...config,
      userId,
      updatedAt: now
    };

    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      Object.assign(dataToSave, { 
        createdAt: now,
        currency: 'XAF'
      });
    }

    await setDoc(docRef, dataToSave, { merge: true });
  } catch (error) {
    console.error('Error saving CinetPay config:', error);
    throw error;
  }
};

// Subscribe to CinetPay configuration changes
export const subscribeToCinetPayConfig = (
  userId: string, 
  callback: (config: CinetPayConfig | null) => void
): Unsubscribe => {
  const docRef = doc(db, COLLECTION_NAME, userId);
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback({
        id: docSnap.id,
        userId,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as CinetPayConfig);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error subscribing to CinetPay config:', error);
    callback(null);
  });
};

// Initialize CinetPay configuration with defaults
export const initializeCinetPayConfig = async (userId: string): Promise<CinetPayConfig> => {
  try {
    const existingConfig = await getCinetPayConfig(userId);
    if (existingConfig) {
      return existingConfig;
    }

    const newConfig: Omit<CinetPayConfig, 'id'> = {
      ...DEFAULT_CINETPAY_CONFIG,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await saveCinetPayConfig(userId, newConfig);
    return { id: userId, ...newConfig } as CinetPayConfig;
  } catch (error) {
    console.error('Error initializing CinetPay config:', error);
    throw error;
  }
};

// Validate CinetPay credentials
export const validateCinetPayCredentials = async (
  siteId: string, 
  apiKey: string, 
  testMode: boolean = true
): Promise<CinetPayValidationResult> => {
  try {
    // Basic validation
    if (!siteId || !apiKey) {
      return {
        isValid: false,
        message: 'Site ID and API Key are required'
      };
    }

    if (siteId.length < 3) {
      return {
        isValid: false,
        message: 'Site ID must be at least 3 characters'
      };
    }

    if (apiKey.length < 10) {
      return {
        isValid: false,
        message: 'API Key must be at least 10 characters'
      };
    }

    // In a real implementation, you would make an API call to CinetPay
    // to validate the credentials. For now, we'll simulate validation
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate API validation
        const isValid = siteId.length >= 3 && apiKey.length >= 10;
        resolve({
          isValid,
          message: isValid 
            ? 'Credentials are valid' 
            : 'Invalid credentials provided',
          details: {
            siteId,
            apiKey: apiKey.substring(0, 4) + '...', // Masked for security
            testMode
          }
        });
      }, 1000); // Simulate network delay
    });
  } catch (error) {
    console.error('Error validating CinetPay credentials:', error);
    return {
      isValid: false,
      message: 'Error validating credentials'
    };
  }
};

// Get CinetPay configuration with defaults
export const getCinetPayConfigWithDefaults = async (userId: string): Promise<CinetPayConfig> => {
  const config = await getCinetPayConfig(userId);
  if (config) {
    return config;
  }
  
  return {
    id: userId,
    userId,
    ...DEFAULT_CINETPAY_CONFIG,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
};

// Reset CinetPay configuration to defaults
export const resetCinetPayConfig = async (userId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const now = serverTimestamp();
    
    await setDoc(docRef, {
      ...DEFAULT_CINETPAY_CONFIG,
      userId,
      createdAt: now,
      updatedAt: now
    });
  } catch (error) {
    console.error('Error resetting CinetPay config:', error);
    throw error;
  }
};

// Check if CinetPay is properly configured
export const isCinetPayConfigured = (config: CinetPayConfig | null): boolean => {
  if (!config) return false;
  
  return config.isActive && 
         config.siteId.length > 0 && 
         config.apiKey.length > 0;
};

// Get enabled channels as array
export const getEnabledChannels = (config: CinetPayConfig): string[] => {
  const channels: string[] = [];
  
  if (config.enabledChannels.mobileMoney) {
    channels.push('MOBILE_MONEY');
  }
  
  if (config.enabledChannels.creditCard) {
    channels.push('CREDIT_CARD');
  }
  
  if (config.enabledChannels.wallet) {
    channels.push('WALLET');
  }
  
  return channels;
};

// Validate payment amount
export const validatePaymentAmount = (
  amount: number, 
  config: CinetPayConfig
): { isValid: boolean; message: string } => {
  if (amount < config.minAmount) {
    return {
      isValid: false,
      message: `Minimum payment amount is ${config.minAmount} ${config.currency}`
    };
  }
  
  if (amount > config.maxAmount) {
    return {
      isValid: false,
      message: `Maximum payment amount is ${config.maxAmount} ${config.currency}`
    };
  }
  
  return {
    isValid: true,
    message: 'Amount is valid'
  };
};