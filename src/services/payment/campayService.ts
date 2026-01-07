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
          // Removed verbose logging - only log on errors
        } catch (error) {
          console.error('Failed to decrypt App ID:', error);
          // If decryption fails, use the original data (might be plain text)
          decryptedAppId = data.appId;
          // Removed verbose logging - only log on errors
        }
      }
      
      return {
        id: docSnap.id,
        userId: data.userId || companyId, // Keep userId for backward compatibility
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
  userId?: string // Optional userId for audit trail
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId); // Use companyId as document ID
    const now = serverTimestamp();

    // Encrypt App ID before saving (use companyId for encryption key)
    const dataToSave: any = {
      ...config,
      companyId, // Ensure companyId is set
      userId: userId || companyId, // Keep userId for audit trail
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
  const docRef = doc(db, COLLECTION_NAME, companyId); // Use companyId as document ID
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Decrypt App ID if it exists (use companyId for encryption key)
      let decryptedAppId = data.appId;
      if (data.appId && !data.appId.includes('***REDACTED***')) {
        try {
          decryptedAppId = SecureEncryption.decrypt(data.appId, companyId);
          // Removed verbose logging - subscription fires repeatedly, only log on errors
        } catch (error) {
          console.error('Failed to decrypt App ID (subscription):', error);
          // If decryption fails, use the original data (might be plain text)
          decryptedAppId = data.appId;
          // Removed verbose logging - subscription fires repeatedly, only log on errors
        }
      }
      
      callback({
        id: docSnap.id,
        userId: data.userId || companyId, // Keep userId for backward compatibility
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
      // Check if App ID needs migration (is plain text)
      // Plain text App IDs typically don't contain encryption markers
      if (existingConfig.appId && !existingConfig.appId.includes('U2FsdGVkX1')) {
        console.log('Migrating plain text App ID to encrypted format');
        try {
          // Re-save the config to encrypt the App ID
          await saveCampayConfig(companyId, {
            appId: existingConfig.appId,
            isActive: existingConfig.isActive,
            environment: existingConfig.environment,
            minAmount: existingConfig.minAmount,
            maxAmount: existingConfig.maxAmount,
            supportedMethods: existingConfig.supportedMethods
          }, userId);
          console.log('App ID migration completed');
        } catch (error) {
          console.error('Failed to migrate App ID:', error);
        }
      }
      return existingConfig;
    }

    const newConfig: Omit<CampayConfig, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } = {
      ...DEFAULT_CAMPAY_CONFIG,
      userId: userId || companyId, // Keep userId for audit trail
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
    // Basic validation
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

    // In a real implementation, you would make an API call to Campay
    // to validate the credentials. For now, we'll simulate validation
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate API validation
        const isValid = appId.length >= 10;
        resolve({
          isValid,
          message: isValid 
            ? 'Credentials are valid' 
            : 'Invalid credentials provided',
          details: {
            appId: appId.substring(0, 4) + '...', // Masked for security
            environment
          }
        });
      }, 1000); // Simulate network delay
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
  
  return {
    id: companyId,
    userId: userId || companyId,
    companyId,
    ...DEFAULT_CAMPAY_CONFIG,
    createdAt: new Date(),
    updatedAt: new Date()
  } as CampayConfig;
};

// Reset Campay configuration to defaults
export const resetCampayConfig = async (companyId: string, userId?: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId); // Use companyId as document ID
    const now = serverTimestamp();
    
    await setDoc(docRef, {
      ...DEFAULT_CAMPAY_CONFIG,
      userId: userId || companyId, // Keep userId for audit trail
      companyId, // Ensure companyId is set
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

