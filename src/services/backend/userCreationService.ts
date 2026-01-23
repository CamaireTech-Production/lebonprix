/**
 * Service to create users via backend API
 */

// Backend API URL - can be configured via environment variable
// CRITICAL: Force HTTP for IP addresses - HTTPS doesn't work with IPs
// This function ALWAYS returns HTTP when an IP address is detected
const getBackendApiUrl = (): string => {
  let url = import.meta.env.VITE_BACKEND_API_URL || 'http://93.127.203.115:8888';
  
  // ENFORCE HTTP: If URL contains ANY IP address pattern, force HTTP
  // Match IP address pattern anywhere in the URL (e.g., 93.127.203.115)
  const ipPattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
  
  if (ipPattern.test(url)) {
    // If URL contains IP address, FORCE HTTP (remove https:// if present)
    url = url.replace(/^https:\/\//, 'http://');
    // Ensure it starts with http://
    if (!url.startsWith('http://') && !url.startsWith('http://')) {
      url = 'http://' + url.replace(/^https?:\/\//, '');
    }
    console.warn('🔒 ENFORCED HTTP for IP address (HTTPS not supported):', url);
  }
  
  // Final check: If somehow still HTTPS with IP, force conversion
  if (url.startsWith('https://') && ipPattern.test(url)) {
    url = url.replace('https://', 'http://');
    console.error('❌ CRITICAL: Forced HTTPS to HTTP conversion:', url);
  }
  
  return url;
};

// DO NOT cache the URL - always get it fresh to enforce HTTP
// This ensures runtime enforcement works even if env var changes
const getBackendApiUrlFresh = (): string => {
  return getBackendApiUrl();
};

/**
 * Get Firebase source based on environment
 * prod/staging -> 'new'
 * dev/local -> 'old'
 */
const getFirebaseSource = (): 'new' | 'old' => {
  // Check explicit environment variable first
  const explicitSource = import.meta.env.VITE_FIREBASE_SOURCE;
  if (explicitSource === 'new' || explicitSource === 'old') {
    return explicitSource;
  }
  
  // Fallback: determine from environment
  const env = import.meta.env.VITE_FIREBASE_ENV || import.meta.env.MODE || 'development';
  if (env === 'prod' || env === 'production' || env === 'staging') {
    return 'new';
  }
  
  // Default to 'old' for dev/local
  return 'old';
};

export interface CreateUserViaBackendParams {
  username: string;
  email: string;
  password: string;
  companyId: string;
  permissionTemplateId: string;
  firebaseSource: 'new' | 'old'; // Which Firebase instance to use
}

export interface CreateUserViaBackendResult {
  success: boolean;
  userId: string;
  username: string;
  email: string;
  password: string;
  role: string;
  error?: string;
}

/**
 * Create user account via backend API
 * The backend uses Admin SDK so owner stays connected
 * @param params - User creation parameters
 * @param idToken - Firebase Auth ID token of the owner (for authentication)
 * @returns Created user credentials
 */
export const createUserViaBackend = async (
  params: Omit<CreateUserViaBackendParams, 'firebaseSource'>,
  idToken: string
): Promise<CreateUserViaBackendResult> => {
  try {
    // Automatically determine Firebase source
    const firebaseSource = getFirebaseSource();
    
    // FINAL ENFORCEMENT: Get fresh URL and force HTTP for IP addresses
    let apiUrl = getBackendApiUrlFresh();
    
    // Double-check: If still HTTPS with IP, force HTTP
    if (apiUrl.startsWith('https://') && /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(apiUrl)) {
      apiUrl = apiUrl.replace('https://', 'http://');
      console.error('❌ CRITICAL: Runtime enforcement - forced HTTPS to HTTP:', apiUrl);
    }
    
    // ABSOLUTE FINAL CHECK: Force HTTP if IP detected (last chance before fetch)
    const finalUrl = apiUrl.replace(/^https:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/, 'http://$1');
    if (finalUrl !== apiUrl) {
      console.error('🚨 LAST-MINUTE ENFORCEMENT: Changed HTTPS to HTTP:', finalUrl);
    }
    
    // Log the final URL being used
    console.log('🌐 Making API request to:', finalUrl);
    
    const response = await fetch(`${finalUrl}/api/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        // Add API key if configured
        ...(import.meta.env.VITE_BACKEND_API_KEY && {
          'x-api-key': import.meta.env.VITE_BACKEND_API_KEY
        })
      },
      body: JSON.stringify({
        ...params,
        firebaseSource
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        userId: '',
        username: '',
        email: '',
        password: '',
        role: '',
        error: data.error || 'Erreur lors de la création de l\'utilisateur'
      };
    }

    return {
      success: true,
      userId: data.data.userId,
      username: data.data.username,
      email: data.data.email,
      password: data.data.password,
      role: data.data.role
    };
  } catch (error: any) {
    console.error('Error creating user via backend:', error);
    return {
      success: false,
      userId: '',
      username: '',
      email: '',
      password: '',
      role: '',
      error: error.message || 'Erreur de connexion au serveur'
    };
  }
};

