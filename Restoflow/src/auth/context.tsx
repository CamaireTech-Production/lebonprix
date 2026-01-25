import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from './services';
import { permissionService } from './permissions';
import { 
  AuthContextType, 
  AuthState, 
  LoginCredentials, 
  RegisterCredentials, 
  User,
  AuthSession,
  RestaurantPermission,
  AdminPermission,
  UserRole
} from './types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // Initialize auth state
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Check for existing session
      const session = await authService.validateSession();
      
      if (session) {
        setAuthState({
          user: session.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to initialize authentication'
      });
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const session = await authService.login(credentials);
      
      setAuthState({
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      
      // Store session in localStorage for persistence
      localStorage.setItem('authSession', JSON.stringify({
        user: session.user,
        token: session.token,
        expiresAt: session.expiresAt
      }));
      
    } catch (error: any) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.message || 'Login failed'
      });
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const session = await authService.register(credentials);
      
      setAuthState({
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      
      // Store session in localStorage for persistence
      localStorage.setItem('authSession', JSON.stringify({
        user: session.user,
        token: session.token,
        expiresAt: session.expiresAt
      }));
      
    } catch (error: any) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.message || 'Registration failed'
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
      
      // Clear session from localStorage
      localStorage.removeItem('authSession');
      
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if logout fails
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
      localStorage.removeItem('authSession');
    }
  };

  const refreshToken = async () => {
    try {
      const session = await authService.refreshToken();
      
      setAuthState(prev => ({
        ...prev,
        user: session.user,
        isAuthenticated: true,
        error: null
      }));
      
      // Update stored session
      localStorage.setItem('authSession', JSON.stringify({
        user: session.user,
        token: session.token,
        expiresAt: session.expiresAt
      }));
      
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout user
      await logout();
    }
  };

  const hasPermission = (permission: RestaurantPermission | AdminPermission): boolean => {
    if (!authState.user) return false;
    
    const check = permissionService.checkPermission(authState.user, permission);
    return check.hasPermission;
  };

  const hasRole = (role: UserRole): boolean => {
    if (!authState.user) return false;
    return authState.user.role === role;
  };

  const canAccess = (route: string): boolean => {
    if (!authState.user) return false;
    return permissionService.canAccessRoute(authState.user, route);
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!authState.user) {
      throw new Error('No authenticated user');
    }
    
    try {
      const updatedUser = await authService.updateUser(authState.user.id, updates);
      
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
        error: null
      }));
      
      // Update stored session
      const storedSession = localStorage.getItem('authSession');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        session.user = updatedUser;
        localStorage.setItem('authSession', JSON.stringify(session));
      }
      
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to update profile'
      }));
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!authState.user) {
      throw new Error('No authenticated user');
    }
    
    try {
      await authService.changePassword(authState.user.id, currentPassword, newPassword);
      
      setAuthState(prev => ({
        ...prev,
        error: null
      }));
      
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to change password'
      }));
      throw error;
    }
  };

  const isSessionValid = (): boolean => {
    const storedSession = localStorage.getItem('authSession');
    if (!storedSession) return false;
    
    try {
      const session = JSON.parse(storedSession);
      return session.expiresAt > Date.now();
    } catch {
      return false;
    }
  };

  const getSessionInfo = (): AuthSession | null => {
    const storedSession = localStorage.getItem('authSession');
    if (!storedSession) return null;
    
    try {
      return JSON.parse(storedSession);
    } catch {
      return null;
    }
  };

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (!authState.isAuthenticated) return;
    
    const session = getSessionInfo();
    if (!session) return;
    
    const timeUntilExpiry = session.expiresAt - Date.now();
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0); // Refresh 5 minutes before expiry
    
    const timeout = setTimeout(() => {
      refreshToken();
    }, refreshTime);
    
    return () => clearTimeout(timeout);
  }, [authState.isAuthenticated]);

  const contextValue: AuthContextType = {
    authState,
    login,
    register,
    logout,
    refreshToken,
    hasPermission,
    hasRole,
    canAccess,
    updateProfile,
    changePassword,
    isSessionValid,
    getSessionInfo
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

