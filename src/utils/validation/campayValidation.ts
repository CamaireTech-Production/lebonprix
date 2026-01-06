import type { CampayConfig } from '../../types/campay';

/**
 * Validation utility for Campay integration
 */

// App ID validation patterns
const APP_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;

/**
 * Validate Campay App ID format
 */
export const validateAppIdFormat = (appId: string): { isValid: boolean; message: string } => {
  if (!appId || appId.trim().length === 0) {
    return {
      isValid: false,
      message: 'App ID is required'
    };
  }

  if (appId.length < 10) {
    return {
      isValid: false,
      message: 'App ID must be at least 10 characters long'
    };
  }

  if (appId.length > 100) {
    return {
      isValid: false,
      message: 'App ID must not exceed 100 characters'
    };
  }

  // Check for valid characters (alphanumeric, underscore, hyphen)
  if (!APP_ID_PATTERN.test(appId)) {
    return {
      isValid: false,
      message: 'App ID contains invalid characters. Only letters, numbers, underscores, and hyphens are allowed'
    };
  }

  return {
    isValid: true,
    message: 'App ID format is valid'
  };
};

/**
 * Validate amount range
 */
export const validateAmountRange = (
  amount: number,
  minAmount: number,
  maxAmount: number
): { isValid: boolean; message: string } => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return {
      isValid: false,
      message: 'Amount must be a valid number'
    };
  }

  if (amount <= 0) {
    return {
      isValid: false,
      message: 'Amount must be greater than 0'
    };
  }

  if (amount < minAmount) {
    return {
      isValid: false,
      message: `Minimum payment amount is ${minAmount} XAF`
    };
  }

  if (amount > maxAmount) {
    return {
      isValid: false,
      message: `Maximum payment amount is ${maxAmount.toLocaleString()} XAF`
    };
  }

  // Check for decimal places (XAF doesn't use decimals typically)
  if (amount % 1 !== 0) {
    return {
      isValid: false,
      message: 'Amount must be a whole number (no decimals)'
    };
  }

  return {
    isValid: true,
    message: 'Amount is valid'
  };
};

/**
 * Validate environment settings
 */
export const validateEnvironmentSettings = (
  environment: 'demo' | 'production',
  amount: number
): { isValid: boolean; message: string } => {
  if (environment === 'demo') {
    const DEMO_MAX_AMOUNT = 10;
    if (amount > DEMO_MAX_AMOUNT) {
      return {
        isValid: false,
        message: `Demo environment limit: Maximum amount is ${DEMO_MAX_AMOUNT} XAF. Your amount is ${amount} XAF. Please use production environment for larger amounts.`
      };
    }
  }

  return {
    isValid: true,
    message: 'Environment settings are valid'
  };
};

/**
 * Validate Campay configuration
 */
export const validateCampayConfig = (config: CampayConfig | null): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config) {
    errors.push('Campay configuration is not available');
    return { isValid: false, errors };
  }

  if (!config.isActive) {
    errors.push('Campay is not active');
  }

  if (!config.appId || config.appId.trim().length === 0) {
    errors.push('App ID is required');
  } else {
    const appIdValidation = validateAppIdFormat(config.appId);
    if (!appIdValidation.isValid) {
      errors.push(appIdValidation.message);
    }
  }

  if (config.minAmount < 0) {
    errors.push('Minimum amount cannot be negative');
  }

  if (config.maxAmount <= 0) {
    errors.push('Maximum amount must be greater than 0');
  }

  if (config.minAmount > config.maxAmount) {
    errors.push('Minimum amount cannot be greater than maximum amount');
  }

  if (config.currency !== 'XAF') {
    errors.push('Only XAF currency is supported');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate payment data before processing
 */
export const validateCampayPaymentData = (
  paymentData: {
    amount: number;
    currency: string;
    description: string;
    externalReference?: string;
  },
  config: CampayConfig
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate amount
  if (!paymentData.amount || paymentData.amount <= 0) {
    errors.push('Amount must be greater than 0');
  } else {
    const amountValidation = validateAmountRange(paymentData.amount, config.minAmount, config.maxAmount);
    if (!amountValidation.isValid) {
      errors.push(amountValidation.message);
    }

    // Validate environment limits
    const envValidation = validateEnvironmentSettings(config.environment, paymentData.amount);
    if (!envValidation.isValid) {
      errors.push(envValidation.message);
    }
  }

  // Validate currency
  if (!paymentData.currency || paymentData.currency !== 'XAF') {
    errors.push('Currency must be XAF');
  }

  // Validate description
  if (!paymentData.description || paymentData.description.trim().length === 0) {
    errors.push('Description is required');
  }

  if (paymentData.description && paymentData.description.length > 200) {
    errors.push('Description must not exceed 200 characters');
  }

  // Validate external reference (optional but if provided, should be valid)
  if (paymentData.externalReference) {
    if (paymentData.externalReference.length > 100) {
      errors.push('External reference must not exceed 100 characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Check network connectivity
 */
export const checkNetworkConnectivity = (): { isOnline: boolean; message: string } => {
  if (typeof navigator === 'undefined') {
    return {
      isOnline: false,
      message: 'Network status cannot be determined'
    };
  }

  if (!navigator.onLine) {
    return {
      isOnline: false,
      message: 'No internet connection. Please check your network and try again.'
    };
  }

  return {
    isOnline: true,
    message: 'Network connection is available'
  };
};

/**
 * Validate SDK initialization
 */
export const validateSDKInitialization = (): { isInitialized: boolean; message: string } => {
  if (typeof window === 'undefined') {
    return {
      isInitialized: false,
      message: 'Window object is not available'
    };
  }

  if (!window.campay) {
    return {
      isInitialized: false,
      message: 'Campay SDK is not loaded. Please refresh the page and try again.'
    };
  }

  if (typeof window.campay.options !== 'function') {
    return {
      isInitialized: false,
      message: 'Campay SDK is not properly initialized'
    };
  }

  return {
    isInitialized: true,
    message: 'Campay SDK is initialized'
  };
};

/**
 * Get user-friendly error message from Campay error
 */
export const getCampayErrorMessage = (
  error: string | Error | unknown,
  environment: 'demo' | 'production'
): string => {
  if (typeof error === 'string') {
    // Check for specific error patterns
    if (error.includes('Maximum amount') || error.includes('ER201')) {
      if (environment === 'demo') {
        return 'Demo environment limit: Maximum amount is 10 XAF. Please use production environment for larger amounts.';
      }
      return 'Payment amount exceeds the maximum allowed limit.';
    }

    if (error.includes('Minimum amount') || error.includes('ER202')) {
      return 'Payment amount is below the minimum allowed limit.';
    }

    if (error.includes('network') || error.includes('connection')) {
      return 'Network error. Please check your internet connection and try again.';
    }

    if (error.includes('timeout')) {
      return 'Payment request timed out. Please try again.';
    }

    if (error.includes('cancelled') || error.includes('cancel')) {
      return 'Payment was cancelled by user.';
    }

    return error;
  }

  if (error instanceof Error) {
    return getCampayErrorMessage(error.message, environment);
  }

  return 'An unexpected error occurred. Please try again.';
};

/**
 * Check if error is retryable
 */
export const isRetryableError = (error: string | Error | unknown): boolean => {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? error.message 
      : String(error);

  const retryablePatterns = [
    'network',
    'connection',
    'timeout',
    'temporary',
    'server error',
    '503',
    '502',
    '504'
  ];

  return retryablePatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern)
  );
};

