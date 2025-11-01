/**
 * User Session Management Utility
 * Handles storing and retrieving user session information in localStorage
 */

interface UserSessionData {
  userId: string;
  email: string;
  timestamp: number;
  companies?: Array<{
    companyId: string;
    name: string;
    role: string;
  }>;
}

const SESSION_KEY = 'lebonprix_user_session';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Save user session to localStorage
 */
export const saveUserSession = (userId: string, email: string, companies?: Array<{ companyId: string; name: string; role: string }>): void => {
  try {
    const sessionData: UserSessionData = {
      userId,
      email,
      timestamp: Date.now(),
      companies
    };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    console.log('💾 User session saved to localStorage:', { userId, email });
  } catch (error) {
    console.error('❌ Failed to save user session:', error);
  }
};

/**
 * Get user session from localStorage
 * Returns null if session doesn't exist or is expired
 */
export const getUserSession = (): UserSessionData | null => {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      return null;
    }
    
    const sessionData: UserSessionData = JSON.parse(stored);
    
    // Check if session is expired
    const now = Date.now();
    const isExpired = now - sessionData.timestamp > SESSION_TTL;
    
    if (isExpired) {
      console.log('⏰ User session expired, removing from localStorage');
      clearUserSession();
      return null;
    }
    
    console.log('✅ User session retrieved from localStorage:', { userId: sessionData.userId, email: sessionData.email });
    return sessionData;
  } catch (error) {
    console.error('❌ Failed to retrieve user session:', error);
    return null;
  }
};

/**
 * Check if user has an active session
 */
export const hasActiveSession = (): boolean => {
  return getUserSession() !== null;
};

/**
 * Clear user session from localStorage
 */
export const clearUserSession = (): void => {
  try {
    localStorage.removeItem(SESSION_KEY);
    console.log('🧹 User session cleared from localStorage');
  } catch (error) {
    console.error('❌ Failed to clear user session:', error);
  }
};

/**
 * Update user session companies list
 */
export const updateUserSessionCompanies = (companies: Array<{ companyId: string; name: string; role: string }>): void => {
  const session = getUserSession();
  if (session) {
    saveUserSession(session.userId, session.email, companies);
  }
};

