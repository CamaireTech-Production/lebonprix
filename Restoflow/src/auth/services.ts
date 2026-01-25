import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  collection
} from 'firebase/firestore';
import { 
  AuthService, 
  LoginCredentials, 
  RegisterCredentials, 
  AuthSession, 
  User, 
  RestaurantUser, 
  AdminUser,
  AuthError,
  SessionError
} from './types';
import { FirestoreService } from '../services/firestoreService';

export class FirebaseAuthService implements AuthService {
  private auth = getAuth();
  private db = getFirestore();

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      const { email, password } = credentials;
      
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Get user data from Firestore
      const user = await this.getUserFromFirestore(firebaseUser.uid);
      
      // Validate user is active
      if (!user.isActive) {
        await firebaseSignOut(this.auth);
        throw new AuthError('USER_INACTIVE', 'User account is inactive');
      }
      
      // Create session
      const session: AuthSession = {
        user,
        token: await firebaseUser.getIdToken(),
        expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
        refreshToken: firebaseUser.refreshToken
      };
      
      // Log activity
      await FirestoreService.logActivity({
        userId: user.id,
        userEmail: user.email,
        action: 'login',
        entityType: user.role === 'restaurant' ? 'restaurant' : 'admin',
        details: { role: user.role }
      });
      
      return session;
      
    } catch (error: any) {
      if (error instanceof AuthError) {
        throw error;
      }
      
      // Handle Firebase Auth errors
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
        case 'auth/user-disabled':
          throw new AuthError('USER_DISABLED', 'User account is disabled');
        case 'auth/too-many-requests':
          throw new AuthError('TOO_MANY_ATTEMPTS', 'Too many failed attempts. Please try again later');
        case 'auth/network-request-failed':
          throw new AuthError('NETWORK_ERROR', 'Network error. Please check your connection');
        default:
          throw new AuthError('LOGIN_FAILED', 'Login failed. Please try again');
      }
    }
  }

  async register(credentials: RegisterCredentials): Promise<AuthSession> {
    try {
      const { email, password, restaurantName, adminRole } = credentials;
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Determine user type and create appropriate user record
      let user: User;
      
      if (adminRole) {
        // Create admin user
        user = await this.createAdminUser(firebaseUser.uid, email, adminRole);
      } else if (restaurantName) {
        // Create restaurant user
        user = await this.createRestaurantUser(firebaseUser.uid, email, restaurantName);
      } else {
        throw new AuthError('INVALID_REGISTRATION', 'Invalid registration data');
      }
      
      // Create session
      const session: AuthSession = {
        user,
        token: await firebaseUser.getIdToken(),
        expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
        refreshToken: firebaseUser.refreshToken
      };
      
      // Log activity
      await FirestoreService.logActivity({
        userId: user.id,
        userEmail: user.email,
        action: 'register',
        entityType: user.role === 'restaurant' ? 'restaurant' : 'admin',
        details: { role: user.role }
      });
      
      return session;
      
    } catch (error: any) {
      if (error instanceof AuthError) {
        throw error;
      }
      
      // Handle Firebase Auth errors
      switch (error.code) {
        case 'auth/email-already-in-use':
          throw new AuthError('EMAIL_EXISTS', 'Email already in use');
        case 'auth/weak-password':
          throw new AuthError('WEAK_PASSWORD', 'Password is too weak');
        case 'auth/invalid-email':
          throw new AuthError('INVALID_EMAIL', 'Invalid email address');
        case 'auth/network-request-failed':
          throw new AuthError('NETWORK_ERROR', 'Network error. Please check your connection');
        default:
          throw new AuthError('REGISTRATION_FAILED', 'Registration failed. Please try again');
      }
    }
  }

  async logout(): Promise<void> {
    try {
      // Log activity before logout
      const currentUser = this.auth.currentUser;
      if (currentUser) {
        await FirestoreService.logActivity({
          userId: currentUser.uid,
          userEmail: currentUser.email || '',
          action: 'logout',
          entityType: 'user'
        });
      }
      
      await firebaseSignOut(this.auth);
    } catch (error) {
      console.error('Logout error:', error);
      // Still sign out even if logging fails
      await firebaseSignOut(this.auth);
    }
  }

  async refreshToken(): Promise<AuthSession> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        throw new SessionError('NO_USER', 'No authenticated user');
      }
      
      // Get fresh token
      const token = await currentUser.getIdToken(true);
      
      // Get updated user data
      const user = await this.getUserFromFirestore(currentUser.uid);
      
      return {
        user,
        token,
        expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
        refreshToken: currentUser.refreshToken
      };
      
    } catch (error: any) {
      throw new SessionError('REFRESH_FAILED', 'Failed to refresh token');
    }
  }

  async validateSession(): Promise<AuthSession | null> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        return null;
      }
      
      // Check if token is still valid
      const token = await currentUser.getIdToken();
      const user = await this.getUserFromFirestore(currentUser.uid);
      
      if (!user.isActive) {
        await firebaseSignOut(this.auth);
        return null;
      }
      
      return {
        user,
        token,
        expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
        refreshToken: currentUser.refreshToken
      };
      
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const userRef = doc(this.db, 'users', userId);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      // Get updated user
      const updatedUser = await this.getUserFromFirestore(userId);
      
      // Log activity
      await FirestoreService.logActivity({
        userId,
        userEmail: updatedUser.email,
        action: 'update_profile',
        entityType: 'user',
        details: { updatedFields: Object.keys(updates) }
      });
      
      return updatedUser;
      
    } catch (error) {
      throw new AuthError('UPDATE_FAILED', 'Failed to update user profile');
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        throw new AuthError('NO_USER', 'No authenticated user');
      }
      
      // Re-authenticate with current password
      await signInWithEmailAndPassword(this.auth, currentUser.email!, currentPassword);
      
      // Update password
      await updatePassword(currentUser, newPassword);
      
      // Log activity
      await FirestoreService.logActivity({
        userId,
        userEmail: currentUser.email!,
        action: 'change_password',
        entityType: 'user'
      });
      
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        throw new AuthError('INVALID_PASSWORD', 'Current password is incorrect');
      }
      throw new AuthError('PASSWORD_CHANGE_FAILED', 'Failed to change password');
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
      
      // Log activity
      await FirestoreService.logActivity({
        userId: 'system',
        userEmail: email,
        action: 'password_reset_requested',
        entityType: 'user'
      });
      
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new AuthError('USER_NOT_FOUND', 'No account found with this email');
      }
      throw new AuthError('RESET_FAILED', 'Failed to send password reset email');
    }
  }

  async verifyEmail(token: string): Promise<void> {
    // Email verification would be implemented here
    // This is a placeholder for future implementation
    throw new AuthError('NOT_IMPLEMENTED', 'Email verification not implemented');
  }

  // Private helper methods
  private async getUserFromFirestore(uid: string): Promise<User> {
    const userDoc = await getDoc(doc(this.db, 'users', uid));
    if (!userDoc.exists()) {
      throw new AuthError('USER_NOT_FOUND', 'User not found in database');
    }
    
    const userData = userDoc.data();
    return this.mapFirestoreUserToUser(uid, userData);
  }

  private async createAdminUser(uid: string, email: string, role: 'admin' | 'super_admin'): Promise<AdminUser> {
    const adminUser: AdminUser = {
      id: uid,
      email,
      role,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      permissions: this.getDefaultAdminPermissions(role),
      canManageRestaurants: role === 'super_admin',
      canManageAdmins: role === 'super_admin'
    };
    
    await setDoc(doc(this.db, 'users', uid), {
      ...adminUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return adminUser;
  }

  private async createRestaurantUser(uid: string, email: string, restaurantName: string): Promise<RestaurantUser> {
    // Create restaurant first
    const restaurantId = await FirestoreService.createRestaurant({
      name: restaurantName,
      email,
      uid,
      adminUsers: [uid],
      isActive: true,
      settings: {},
      customization: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    const restaurantUser: RestaurantUser = {
      id: uid,
      email,
      role: 'restaurant',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      restaurantId,
      restaurantName,
      permissions: this.getDefaultRestaurantPermissions()
    };
    
    await setDoc(doc(this.db, 'users', uid), {
      ...restaurantUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return restaurantUser;
  }

  private mapFirestoreUserToUser(uid: string, userData: any): User {
    if (userData.role === 'restaurant') {
      return {
        id: uid,
        email: userData.email,
        role: 'restaurant',
        isActive: userData.isActive,
        createdAt: userData.createdAt?.toMillis() || Date.now(),
        updatedAt: userData.updatedAt?.toMillis() || Date.now(),
        lastLoginAt: userData.lastLoginAt?.toMillis(),
        restaurantId: userData.restaurantId,
        restaurantName: userData.restaurantName,
        permissions: userData.permissions || this.getDefaultRestaurantPermissions()
      } as RestaurantUser;
    } else {
      return {
        id: uid,
        email: userData.email,
        role: userData.role,
        isActive: userData.isActive,
        createdAt: userData.createdAt?.toMillis() || Date.now(),
        updatedAt: userData.updatedAt?.toMillis() || Date.now(),
        lastLoginAt: userData.lastLoginAt?.toMillis(),
        permissions: userData.permissions || this.getDefaultAdminPermissions(userData.role),
        canManageRestaurants: userData.canManageRestaurants || false,
        canManageAdmins: userData.canManageAdmins || false
      } as AdminUser;
    }
  }

  private getDefaultRestaurantPermissions(): RestaurantPermission[] {
    return [
      'manage_menu',
      'manage_orders',
      'manage_tables',
      'manage_media',
      'view_analytics',
      'manage_settings',
      'manage_staff'
    ];
  }

  private getDefaultAdminPermissions(role: 'admin' | 'super_admin'): AdminPermission[] {
    const basePermissions: AdminPermission[] = [
      'manage_restaurants',
      'view_system_analytics',
      'view_all_orders'
    ];
    
    if (role === 'super_admin') {
      return [
        ...basePermissions,
        'manage_admins',
        'manage_system_settings',
        'manage_templates',
        'manage_billing'
      ];
    }
    
    return basePermissions;
  }
}

// Export singleton instance
export const authService = new FirebaseAuthService();

