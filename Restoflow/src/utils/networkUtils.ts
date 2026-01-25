// Network connectivity utilities
export const checkInternetConnection = async (): Promise<boolean> => {
  try {
    // Try to fetch a small resource to test connectivity
    return true;
  } catch (error) {
    return false;
  }
};

export const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  
  // Check for common network error patterns
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  // Firebase network errors
  if (errorCode.includes('network') || errorCode.includes('unavailable')) {
    return true;
  }
  
  // Common network error messages
  const networkErrorPatterns = [
    'network',
    'connection',
    'timeout',
    'offline',
    'unreachable',
    'failed to fetch',
    'network error',
    'connection refused',
    'no internet',
    'check your connection'
  ];
  
  return networkErrorPatterns.some(pattern => 
    errorMessage.includes(pattern)
  );
};

export const getNetworkErrorMessage = (error: any): string => {
  if (isNetworkError(error)) {
    return 'No internet connection. Please check your network and try again.';
  }
  
  // Firebase specific errors
  if (error.code) {
    switch (error.code) {
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection and try again.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait a moment and try again.';
      case 'auth/user-not-found':
        return 'No account found with these credentials.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/operation-not-allowed':
        return 'This operation is not allowed. Please contact support.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
  
  return 'An unexpected error occurred. Please try again.';
};

export const retryWithNetworkCheck = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check internet connection before attempting operation
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        throw new Error('No internet connection detected');
      }
      
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // If it's a network error and we have retries left, wait and retry
      if (isNetworkError(error) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If it's not a network error or we're out of retries, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}; 