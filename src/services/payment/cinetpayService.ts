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
  CinetPayConfig, 
  CinetPayConfigUpdate, 
  CinetPayValidationResult,
  DEFAULT_CINETPAY_CONFIG
} from '../../types/cinetpay';
import { SecureEncryption } from '@utils/security/encryption';

const COLLECTION_NAME = 'cinetpay_configs';

// Get CinetPay configuration for a company
export const getCinetPayConfig = async (companyId: string): Promise<CinetPayConfig | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Decrypt API key if it exists (use companyId for encryption key)
      let decryptedApiKey = data.apiKey;
      if (data.apiKey && !data.apiKey.includes('***REDACTED***')) {
        try {
          decryptedApiKey = SecureEncryption.decrypt(data.apiKey, companyId);
          console.log('API key decrypted successfully');
        } catch (error) {
          console.error('Failed to decrypt API key:', error);
          // If decryption fails, use the original data (might be plain text)
          decryptedApiKey = data.apiKey;
          console.log('Using original API key as fallback');
        }
      }
      
      return {
        id: docSnap.id,
        userId: data.userId || companyId, // Keep userId for backward compatibility
        companyId: data.companyId || companyId,
        ...data,
        apiKey: decryptedApiKey,
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
  companyId: string,
  config: CinetPayConfigUpdate,
  userId?: string // Optional userId for audit trail
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId); // Use companyId as document ID
    const now = serverTimestamp();

    // Encrypt API key before saving (use companyId for encryption key)
    const dataToSave: any = {
      ...config,
      companyId, // Ensure companyId is set
      userId: userId || companyId, // Keep userId for audit trail
      updatedAt: now
    };

    // Encrypt API key if provided
    if (config.apiKey) {
      try {
        dataToSave.apiKey = SecureEncryption.encrypt(config.apiKey, companyId);
      } catch (error) {
        console.error('Failed to encrypt API key:', error);
        throw new Error('Failed to encrypt API key');
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
    console.error('Error saving CinetPay config:', error);
    throw error;
  }
};

// Subscribe to CinetPay configuration changes
export const subscribeToCinetPayConfig = (
  companyId: string, 
  callback: (config: CinetPayConfig | null) => void
): Unsubscribe => {
  const docRef = doc(db, COLLECTION_NAME, companyId); // Use companyId as document ID
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Decrypt API key if it exists (use companyId for encryption key)
      let decryptedApiKey = data.apiKey;
      if (data.apiKey && !data.apiKey.includes('***REDACTED***')) {
        try {
          decryptedApiKey = SecureEncryption.decrypt(data.apiKey, companyId);
          console.log('API key decrypted successfully');
        } catch (error) {
          console.error('Failed to decrypt API key:', error);
          // If decryption fails, use the original data (might be plain text)
          decryptedApiKey = data.apiKey;
          console.log('Using original API key as fallback');
        }
      }
      
      callback({
        id: docSnap.id,
        userId: data.userId || companyId, // Keep userId for backward compatibility
        companyId: data.companyId || companyId,
        ...data,
        apiKey: decryptedApiKey,
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
export const initializeCinetPayConfig = async (companyId: string, userId?: string): Promise<CinetPayConfig> => {
  try {
    const existingConfig = await getCinetPayConfig(companyId);
    if (existingConfig) {
      // Check if API key needs migration (is plain text)
      if (existingConfig.apiKey && !existingConfig.apiKey.includes('=') && !existingConfig.apiKey.includes('/')) {
        console.log('Migrating plain text API key to encrypted format');
        try {
          // Re-save the config to encrypt the API key
          await saveCinetPayConfig(companyId, {
            apiKey: existingConfig.apiKey,
            isActive: existingConfig.isActive,
            testMode: existingConfig.testMode,
            enabledChannels: existingConfig.enabledChannels
          }, userId);
          console.log('API key migration completed');
        } catch (error) {
          console.error('Failed to migrate API key:', error);
        }
      }
      return existingConfig;
    }

    const newConfig: Omit<CinetPayConfig, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } = {
      ...DEFAULT_CINETPAY_CONFIG,
      userId: userId || companyId, // Keep userId for audit trail
      companyId,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any
    };

    await saveCinetPayConfig(companyId, newConfig, userId);
    return { id: companyId, ...newConfig } as CinetPayConfig;
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
export const getCinetPayConfigWithDefaults = async (companyId: string, userId?: string): Promise<CinetPayConfig> => {
  const config = await getCinetPayConfig(companyId);
  if (config) {
    return config;
  }
  
  return {
    id: companyId,
    userId: userId || companyId,
    companyId,
    ...DEFAULT_CINETPAY_CONFIG,
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any
  } as CinetPayConfig;
};

// Reset CinetPay configuration to defaults
export const resetCinetPayConfig = async (companyId: string, userId?: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, companyId); // Use companyId as document ID
    const now = serverTimestamp();
    
    await setDoc(docRef, {
      ...DEFAULT_CINETPAY_CONFIG,
      userId: userId || companyId, // Keep userId for audit trail
      companyId, // Ensure companyId is set
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