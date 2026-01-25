/**
 * Service to create users via backend API
 */

// Backend API URL - can be configured via environment variable
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:4500';

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
    
    const response = await fetch(`${BACKEND_API_URL}/api/users/create`, {
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

