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

const SESSION_KEY_PREFIX = 'lebonprix_user_session_';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get the localStorage key for a specific user's session
 */
const getSessionKey = (userId: string): string => {
  return `${SESSION_KEY_PREFIX}${userId}`;
};

/**
 * Save user session to localStorage with userId-specific key
 */
export const saveUserSession = (userId: string, email: string, companies?: Array<{ companyId: string; name: string; role: string }>): void => {
  try {
    const sessionData: UserSessionData = {
      userId,
      email,
      timestamp: Date.now(),
      companies
    };
    
    const sessionKey = getSessionKey(userId);
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
  } catch (error) {
    console.error('❌ Failed to save user session:', error);
  }
};

/**
 * Get user session from localStorage for a specific user
 * Returns null if session doesn't exist or is expired
 */
export const getUserSession = (userId?: string): UserSessionData | null => {
  try {
    // If userId is provided, get that specific user's session
    if (userId) {
      const sessionKey = getSessionKey(userId);
      const stored = localStorage.getItem(sessionKey);
      if (!stored) {
        return null;
      }
      
      const sessionData: UserSessionData = JSON.parse(stored);
      
      // Check if session is expired
      const now = Date.now();
      const isExpired = now - sessionData.timestamp > SESSION_TTL;
      
      if (isExpired) {
        clearUserSession(userId);
        return null;
      }
      
      return sessionData;
    }
    
    // If no userId provided, try to find any active session by checking all keys
    // This is for backward compatibility and auto-detection
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SESSION_KEY_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const sessionData: UserSessionData = JSON.parse(stored);
            
            // Check if session is expired
            const now = Date.now();
            const isExpired = now - sessionData.timestamp > SESSION_TTL;
            
            if (isExpired) {
              clearUserSession(sessionData.userId);
              continue;
            }
            
            return sessionData;
          } catch {
            // Invalid data, skip
            continue;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to retrieve user session:', error);
    return null;
  }
};

/**
 * Check if a specific user has an active session
 */
export const hasActiveSession = (userId?: string): boolean => {
  return getUserSession(userId) !== null;
};

/**
 * Clear user session from localStorage for a specific user
 * If no userId provided, clears all user sessions (for logout scenarios)
 */
export const clearUserSession = (userId?: string): void => {
  try {
    if (userId) {
      // Clear specific user's session
      const sessionKey = getSessionKey(userId);
      localStorage.removeItem(sessionKey);
    } else {
      // Clear all user sessions (for cleanup or logout scenarios)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(SESSION_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error('❌ Failed to clear user session:', error);
  }
};

/**
 * Update user session companies list for a specific user
 */
export const updateUserSessionCompanies = (userId: string, companies: Array<{ companyId: string; name: string; role: string }>): void => {
  const session = getUserSession(userId);
  if (session) {
    saveUserSession(session.userId, session.email, companies);
  }
};


