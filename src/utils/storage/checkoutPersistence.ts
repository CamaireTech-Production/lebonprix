/**
 * Checkout Form Persistence Utilities
 * Handles localStorage management for checkout form data with company-specific storage
 */

export interface CheckoutFormData {
  // Contact Information
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  
  // Delivery Information
  address: string;
  city: string;
  country: string;
  zipCode?: string;
  
  // Payment Information
  selectedPaymentMethod: string;
  selectedPaymentOption?: string;
  
  // Cart Data
  cartItems: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    category: string;
    selectedColor?: string;
    selectedSize?: string;
    variations?: {
      color?: string;
      size?: string;
    };
  }>;
  
  // Metadata
  lastSaved: string;
  companyId: string;
}

export interface CheckoutPersistenceData {
  formData: CheckoutFormData;
  cartItems: any[];
  cartTotal: number;
  timestamp: number;
  expiresAt: number;
}

export interface PersistedCheckoutData {
  data: CheckoutFormData;
  timestamp: number;
  expiresAt: number;
}

const STORAGE_KEY_PREFIX = 'checkout_data';
const EXPIRY_HOURS = 24; // Data expires after 24 hours

/**
 * Generate storage key for company-specific checkout data
 */
const getStorageKey = (companyId: string): string => {
  return `${STORAGE_KEY_PREFIX}_${companyId}`;
};

/**
 * Save checkout data to localStorage with expiry
 */
export const saveCheckoutData = (companyId: string, data: CheckoutFormData): void => {
  try {
    const key = getStorageKey(companyId);
    const payload: PersistedCheckoutData = {
      data: {
        ...data,
        lastSaved: new Date().toISOString(),
        companyId
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + (EXPIRY_HOURS * 60 * 60 * 1000) // 24 hours from now
    };
    
    localStorage.setItem(key, JSON.stringify(payload));
    console.log('Checkout data saved to localStorage:', { companyId, timestamp: payload.timestamp });
  } catch (error) {
    console.error('Error saving checkout data to localStorage:', error);
  }
};

/**
 * Save comprehensive checkout data including cart
 */
export const saveCheckoutDataWithCart = (
  companyId: string, 
  formData: CheckoutFormData, 
  cartItems: any[], 
  cartTotal: number
): void => {
  try {
    const key = getStorageKey(companyId);
    const payload: CheckoutPersistenceData = {
      formData: {
        ...formData,
        lastSaved: new Date().toISOString(),
        companyId
      },
      cartItems,
      cartTotal,
      timestamp: Date.now(),
      expiresAt: Date.now() + (EXPIRY_HOURS * 60 * 60 * 1000) // 24 hours from now
    };
    
    localStorage.setItem(key, JSON.stringify(payload));
    console.log('Checkout data with cart saved to localStorage:', { 
      companyId, 
      timestamp: payload.timestamp,
      cartItems: cartItems.length,
      cartTotal 
    });
  } catch (error) {
    console.error('Error saving checkout data with cart to localStorage:', error);
  }
};

/**
 * Load checkout data from localStorage
 */
export const loadCheckoutData = (companyId: string): CheckoutFormData | null => {
  try {
    const key = getStorageKey(companyId);
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      console.log('No checkout data found for company:', companyId);
      return null;
    }
    
    const payload = JSON.parse(stored);
    
    // Check if data has expired
    if (Date.now() > payload.expiresAt) {
      console.log('Checkout data expired for company:', companyId);
      localStorage.removeItem(key);
      return null;
    }
    
    // Handle both old and new data formats
    if (payload.data) {
      // Old format (PersistedCheckoutData)
      console.log('Checkout data loaded from localStorage (old format):', { 
        companyId, 
        age: Date.now() - payload.timestamp,
        lastSaved: payload.data.lastSaved 
      });
      return payload.data;
    } else if (payload.formData) {
      // New format (CheckoutPersistenceData)
      console.log('Checkout data loaded from localStorage (new format):', { 
        companyId, 
        age: Date.now() - payload.timestamp,
        lastSaved: payload.formData.lastSaved 
      });
      return payload.formData;
    }
    
    return null;
  } catch (error) {
    console.error('Error loading checkout data from localStorage:', error);
    return null;
  }
};

/**
 * Load comprehensive checkout data including cart
 */
export const loadCheckoutDataWithCart = (companyId: string): CheckoutPersistenceData | null => {
  try {
    const key = getStorageKey(companyId);
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      console.log('No checkout data found for company:', companyId);
      return null;
    }
    
    const payload = JSON.parse(stored);
    
    // Check if data has expired
    if (Date.now() > payload.expiresAt) {
      console.log('Checkout data expired for company:', companyId);
      localStorage.removeItem(key);
      return null;
    }
    
    // Handle both old and new data formats
    if (payload.formData && payload.cartItems !== undefined) {
      // New format (CheckoutPersistenceData)
      console.log('Checkout data with cart loaded from localStorage:', { 
        companyId, 
        age: Date.now() - payload.timestamp,
        lastSaved: payload.formData.lastSaved,
        cartItems: payload.cartItems.length,
        cartTotal: payload.cartTotal
      });
      return payload;
    } else if (payload.data) {
      // Old format - convert to new format
      console.log('Checkout data loaded from localStorage (converted from old format):', { 
        companyId, 
        age: Date.now() - payload.timestamp,
        lastSaved: payload.data.lastSaved 
      });
      return {
        formData: payload.data,
        cartItems: payload.data.cartItems || [],
        cartTotal: 0, // Will be recalculated
        timestamp: payload.timestamp,
        expiresAt: payload.expiresAt
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error loading checkout data from localStorage:', error);
    return null;
  }
};

/**
 * Load cart data only
 */
export const loadCartData = (companyId: string): { cartItems: any[]; cartTotal: number } | null => {
  try {
    const data = loadCheckoutDataWithCart(companyId);
    if (data) {
      return {
        cartItems: data.cartItems,
        cartTotal: data.cartTotal
      };
    }
    return null;
  } catch (error) {
    console.error('Error loading cart data from localStorage:', error);
    return null;
  }
};

/**
 * Clear checkout data for a specific company
 */
export const clearCheckoutData = (companyId: string): void => {
  try {
    const key = getStorageKey(companyId);
    localStorage.removeItem(key);
    console.log('Checkout data cleared for company:', companyId);
  } catch (error) {
    console.error('Error clearing checkout data:', error);
  }
};

/**
 * Clear all expired checkout data
 */
export const cleanupExpiredData = (): void => {
  try {
    const keys = Object.keys(localStorage);
    const checkoutKeys = keys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));
    
    checkoutKeys.forEach(key => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const payload: PersistedCheckoutData = JSON.parse(stored);
          if (Date.now() > payload.expiresAt) {
            localStorage.removeItem(key);
            console.log('Expired checkout data cleaned up:', key);
          }
        }
      } catch (error) {
        // If we can't parse the data, remove it
        localStorage.removeItem(key);
        console.log('Invalid checkout data cleaned up:', key);
      }
    });
  } catch (error) {
    console.error('Error cleaning up expired checkout data:', error);
  }
};

/**
 * Get data freshness information
 */
export const getDataFreshness = (companyId: string): { 
  isFresh: boolean; 
  age: number; 
  lastSaved: string | null 
} => {
  try {
    // Validate companyId
    if (!companyId || typeof companyId !== 'string') {
      console.warn('Invalid companyId provided to getDataFreshness:', companyId);
      return { isFresh: false, age: 0, lastSaved: null };
    }

    const key = getStorageKey(companyId);
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      return { isFresh: false, age: 0, lastSaved: null };
    }
    
    const payload = JSON.parse(stored);
    
    // Validate payload structure
    if (!payload || typeof payload !== 'object') {
      console.warn('Invalid payload structure in localStorage:', payload);
      return { isFresh: false, age: 0, lastSaved: null };
    }
    
    // Validate timestamp
    if (!payload.timestamp || typeof payload.timestamp !== 'number') {
      console.warn('Invalid timestamp in payload:', payload.timestamp);
      return { isFresh: false, age: 0, lastSaved: null };
    }
    
    const age = Date.now() - payload.timestamp;
    const isFresh = age < (EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Handle both old and new data formats
    let lastSaved = null;
    if (payload.data && payload.data.lastSaved) {
      // Old format (PersistedCheckoutData)
      lastSaved = payload.data.lastSaved;
    } else if (payload.formData && payload.formData.lastSaved) {
      // New format (CheckoutPersistenceData)
      lastSaved = payload.formData.lastSaved;
    }
    
    return {
      isFresh,
      age,
      lastSaved
    };
  } catch (error) {
    console.error('Error getting data freshness:', error);
    return { isFresh: false, age: 0, lastSaved: null };
  }
};

/**
 * Check if checkout data exists for a company
 */
export const hasCheckoutData = (companyId: string): boolean => {
  try {
    const key = getStorageKey(companyId);
    const stored = localStorage.getItem(key);
    
    if (!stored) return false;
    
    const payload: PersistedCheckoutData = JSON.parse(stored);
    return Date.now() <= payload.expiresAt;
  } catch (error) {
    return false;
  }
};

/**
 * Get all companies with checkout data
 */
export const getCompaniesWithCheckoutData = (): string[] => {
  try {
    const keys = Object.keys(localStorage);
    const checkoutKeys = keys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));
    
    return checkoutKeys.map(key => {
      const companyId = key.replace(`${STORAGE_KEY_PREFIX}_`, '');
      return companyId;
    }).filter(companyId => hasCheckoutData(companyId));
  } catch (error) {
    console.error('Error getting companies with checkout data:', error);
    return [];
  }
};

// Auto-cleanup on module load
if (typeof window !== 'undefined') {
  cleanupExpiredData();
}