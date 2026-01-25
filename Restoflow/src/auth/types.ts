// Authentication types and interfaces

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
}

export interface RestaurantUser extends User {
  role: 'restaurant';
  restaurantId: string;
  restaurantName: string;
  permissions: RestaurantPermission[];
}

export interface AdminUser extends User {
  role: 'admin' | 'super_admin';
  permissions: AdminPermission[];
  canManageRestaurants: boolean;
  canManageAdmins: boolean;
}

export type UserRole = 'restaurant' | 'admin' | 'super_admin';

export type RestaurantPermission = 
  | 'manage_menu'
  | 'manage_orders'
  | 'manage_tables'
  | 'manage_media'
  | 'view_analytics'
  | 'manage_settings'
  | 'manage_staff';

export type AdminPermission = 
  | 'manage_restaurants'
  | 'manage_admins'
  | 'view_system_analytics'
  | 'manage_system_settings'
  | 'manage_templates'
  | 'view_all_orders'
  | 'manage_billing';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  restaurantName?: string;
  adminRole?: 'admin' | 'super_admin';
}

export interface AuthError {
  code: string;
  message: string;
  details?: any;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
  refreshToken?: string;
}

export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
}

export interface AuthMiddleware {
  requireAuth: boolean;
  requireRole?: UserRole;
  requirePermissions?: (RestaurantPermission | AdminPermission)[];
  redirectTo?: string;
}

// Route protection types
export interface ProtectedRouteConfig {
  path: string;
  component: React.ComponentType;
  middleware: AuthMiddleware;
  children?: ProtectedRouteConfig[];
}

// Authentication context types
export interface AuthContextType {
  // State
  authState: AuthState;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  
  // Permissions
  hasPermission: (permission: RestaurantPermission | AdminPermission) => boolean;
  hasRole: (role: UserRole) => boolean;
  canAccess: (route: string) => boolean;
  
  // User management
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  
  // Session management
  isSessionValid: () => boolean;
  getSessionInfo: () => AuthSession | null;
}

// Service interfaces
export interface AuthService {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  register(credentials: RegisterCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  refreshToken(): Promise<AuthSession>;
  validateSession(): Promise<AuthSession | null>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
}

export interface PermissionService {
  checkPermission(user: User, permission: RestaurantPermission | AdminPermission): PermissionCheck;
  checkRole(user: User, role: UserRole): boolean;
  getUserPermissions(user: User): (RestaurantPermission | AdminPermission)[];
  canAccessRoute(user: User, route: string): boolean;
}

// Error types
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class PermissionError extends Error {
  constructor(
    public permission: RestaurantPermission | AdminPermission,
    message: string
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class SessionError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

