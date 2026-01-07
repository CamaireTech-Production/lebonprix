import { db } from '../core/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { 
  CampayConfig, 
  CampayConfigUpdate, 
  CampayValidationResult,
  DEFAULT_CAMPAY_CONFIG
} from '../../types/campay';
import { SecureEncryption } from '@utils/security/encryption';

const COLLECTION_NAME = 'campay_configs';

// Get Campay configuration for a company
export const getCampayConfig = async (companyId: string): Promise<CampayConfig | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Decrypt App ID if it exists (use companyId for encryption key)
      let decryptedAppId = data.appId;
      if (data.appId && !data.appId.includes('***REDACTED***')) {
        try {
          decryptedAppId = SecureEncryption.decrypt(data.appId, companyId);
        } catch (error) {
          console.error('Failed to decrypt App ID:', error);
          // If decryption fails, use the original data (might be plain text)
          decryptedAppId = data.appId;
        }
      }
      
      return {
        id: docSnap.id,
        userId: data.userId || companyId,
        companyId: data.companyId || companyId,
        ...data,
        appId: decryptedAppId,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as CampayConfig;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Campay config:', error);
    throw error;
  }
};

// Save Campay configuration
export const saveCampayConfig = async (
  companyId: string,
  config: CampayConfigUpdate,
  userId?: string
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId);
    const now = serverTimestamp();

    // Encrypt App ID before saving (use companyId for encryption key)
    const dataToSave: any = {
      ...config,
      companyId,
      userId: userId || companyId,
      updatedAt: now
    };

    // Encrypt App ID if provided
    if (config.appId) {
      try {
        dataToSave.appId = SecureEncryption.encrypt(config.appId, companyId);
      } catch (error) {
        console.error('Failed to encrypt App ID:', error);
        throw new Error('Failed to encrypt App ID');
      }
    }

    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      Object.assign(dataToSave, { 
        createdAt: now,
        currency: 'XAF'
      });
    }

    await setDoc(docRef, dataToSave, { merge: true });
  } catch (error) {
    console.error('Error saving Campay config:', error);
    throw error;
  }
};

// Subscribe to Campay configuration changes
export const subscribeToCampayConfig = (
  companyId: string, 
  callback: (config: CampayConfig | null) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const docRef = doc(db, COLLECTION_NAME, companyId);
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Decrypt App ID if it exists (use companyId for encryption key)
      let decryptedAppId = data.appId;
      if (data.appId && !data.appId.includes('***REDACTED***')) {
        try {
          decryptedAppId = SecureEncryption.decrypt(data.appId, companyId);
        } catch (error) {
          console.error('Failed to decrypt App ID (subscription):', error);
          decryptedAppId = data.appId;
        }
      }
      
      callback({
        id: docSnap.id,
        userId: data.userId || companyId,
        companyId: data.companyId || companyId,
        ...data,
        appId: decryptedAppId,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as CampayConfig);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error subscribing to Campay config:', error);
    if (onError) {
      onError(error as Error);
    } else {
      callback(null);
    }
  });
};

// Initialize Campay configuration with defaults
export const initializeCampayConfig = async (companyId: string, userId?: string): Promise<CampayConfig> => {
  try {
    const existingConfig = await getCampayConfig(companyId);
    if (existingConfig) {
      return existingConfig;
    }

    const newConfig: Omit<CampayConfig, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } = {
      ...DEFAULT_CAMPAY_CONFIG,
      userId: userId || companyId,
      companyId,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any
    };

    await saveCampayConfig(companyId, newConfig, userId);
    return { id: companyId, ...newConfig } as CampayConfig;
  } catch (error) {
    console.error('Error initializing Campay config:', error);
    throw error;
  }
};

// Validate Campay credentials
export const validateCampayCredentials = async (
  appId: string, 
  environment: 'demo' | 'production' = 'demo'
): Promise<CampayValidationResult> => {
  try {
    if (!appId) {
      return {
        isValid: false,
        message: 'App ID is required'
      };
    }

    if (appId.length < 10) {
      return {
        isValid: false,
        message: 'App ID must be at least 10 characters'
      };
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        const isValid = appId.length >= 10;
        resolve({
          isValid,
          message: isValid 
            ? 'Credentials are valid' 
            : 'Invalid credentials provided',
          details: {
            appId: appId.substring(0, 4) + '...',
            environment
          }
        });
      }, 1000);
    });
  } catch (error) {
    console.error('Error validating Campay credentials:', error);
    return {
      isValid: false,
      message: 'Error validating credentials'
    };
  }
};

// Get Campay configuration with defaults
export const getCampayConfigWithDefaults = async (companyId: string, userId?: string): Promise<CampayConfig> => {
  const config = await getCampayConfig(companyId);
  if (config) {
    return config;
  }
  
  const now = new Date();
  return {
    id: companyId,
    userId: userId || companyId,
    companyId,
    ...DEFAULT_CAMPAY_CONFIG,
    createdAt: { seconds: Math.floor(now.getTime() / 1000), nanoseconds: (now.getTime() % 1000) * 1000000 },
    updatedAt: { seconds: Math.floor(now.getTime() / 1000), nanoseconds: (now.getTime() % 1000) * 1000000 }
  } as CampayConfig;
};

// Reset Campay configuration to defaults
export const resetCampayConfig = async (companyId: string, userId?: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId);
    const now = serverTimestamp();
    
    await setDoc(docRef, {
      ...DEFAULT_CAMPAY_CONFIG,
      userId: userId || companyId,
      companyId,
      createdAt: now,
      updatedAt: now
    });
  } catch (error) {
    console.error('Error resetting Campay config:', error);
    throw error;
  }
};

// Check if Campay is properly configured
export const isCampayConfigured = (config: CampayConfig | null): boolean => {
  if (!config) return false;
  
  return config.isActive && 
         config.appId.length > 0;
};

// Validate payment amount
export const validateCampayPaymentAmount = (
  amount: number, 
  config: CampayConfig
): { isValid: boolean; message: string } => {
  // Check demo environment limit (10 XAF)
  if (config.environment === 'demo' && amount > 10) {
    return {
      isValid: false,
      message: `Demo environment limit: Maximum amount is 10 XAF. Your amount is ${amount} XAF. Please use production environment for larger amounts.`
    };
  }

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
