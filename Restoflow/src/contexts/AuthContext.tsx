import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { logActivity } from '../services/activityLogService';
import { Restaurant } from '../types';

interface AuthContextType {
  currentUser: User | null;
  restaurant: Restaurant | null;
  loading: boolean;
  isVerified: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateRestaurantProfile: (restaurantData: Partial<Restaurant>) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Real-time restaurant data
        const restaurantRef = doc(db, 'restaurants', user.uid);
        const unsubRestaurant = onSnapshot(restaurantRef, (restaurantDoc) => {
          if (restaurantDoc.exists()) {
            const restaurantData = { id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant;
            setRestaurant(restaurantData);
            // Check verification status
            setIsVerified(restaurantData.isVerified === true && restaurantData.verificationStatus === 'verified');
          } else {
            setRestaurant(null);
            setIsVerified(false);
          }
          setLoading(false);
        }, (error) => {
          console.error('Error listening to restaurant data:', error);
          setRestaurant(null);
          setIsVerified(false);
          setLoading(false);
        });
        // Clean up restaurant listener on user change
        return unsubRestaurant;
      } else {
        setRestaurant(null);
        setIsVerified(false);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[AuthContext] signIn start', { email });
      
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log('[AuthContext] signIn success', { uid: cred.user.uid });
      
      // Validate restaurant account exists and is not deleted BEFORE navigation
      const restaurantDoc = await getDoc(doc(db, 'restaurants', cred.user.uid));
      if (!restaurantDoc.exists()) {
        // Sign out immediately and throw error
        await firebaseSignOut(auth);
        throw new Error('NO_RESTAURANT_ACCOUNT');
      }
      
      const restaurantData = restaurantDoc.data();
      if (restaurantData?.deleted || restaurantData?.isDeleted) {
        // Sign out immediately and throw error
        await firebaseSignOut(auth);
        throw new Error('RESTAURANT_ACCOUNT_DELETED');
      }
      
      if (restaurantData?.isDeactivated || restaurantData?.deactivated) {
        // Sign out immediately and throw error
        await firebaseSignOut(auth);
        throw new Error('RESTAURANT_ACCOUNT_DISABLED');
      }
      
      // Only log activity and navigate if account is valid
      await logActivity({
        userId: cred.user.uid,
        userEmail: email,
        action: 'login',
        entityType: 'restaurant',
      });
      
      console.log('[AuthContext] signIn complete, navigating to dashboard');
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('[AuthContext] signIn error', error);
      
      // Handle specific Firebase Auth errors
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        
        // If user doesn't exist, suggest creating an account
        if (firebaseError.code === 'auth/user-not-found') {
          const customError = new Error('ACCOUNT_NOT_FOUND') as Error & { code: string };
          customError.code = 'auth/user-not-found';
          throw customError;
        }
        
        // If wrong password, suggest password reset
        if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
          const customError = new Error('INVALID_CREDENTIALS') as Error & { code: string };
          customError.code = firebaseError.code;
          throw customError;
        }
      }
      
      throw error;
    }
  };



  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Add additional scopes if needed
      provider.addScope('email');
      provider.addScope('profile');
      
      const userCredential = await signInWithPopup(auth, provider);
      const restaurantDoc = await getDoc(doc(db, 'restaurants', userCredential.user.uid));
      
      if (!restaurantDoc.exists()) {
        // Prevent unauthorized account creation - only allow existing accounts
        await firebaseSignOut(auth); // Sign out the user immediately
        throw new Error('NO_RESTAURANT_ACCOUNT');
      }
      
      // Check if account is not deleted
      const restaurantData = restaurantDoc.data();
      if (restaurantData?.deleted) {
        await firebaseSignOut(auth);
        throw new Error('RESTAURANT_ACCOUNT_DELETED');
      }
      
      // Only proceed if account exists and is valid
      await logActivity({
        userId: userCredential.user.uid,
        userEmail: userCredential.user.email || '',
        action: 'login_google',
        entityType: 'restaurant',
      });
      
      console.log('[AuthContext] signInWithGoogle complete, navigating to dashboard');
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('[AuthContext] signInWithGoogle error', error);
      
      // Handle custom errors first
      if (error instanceof Error) {
        if (error.message.includes('Failed to load Google APIs')) {
          const customError = new Error('Google Sign-in is not available. Please check your browser settings or try refreshing the page.') as Error & { code: string };
          customError.code = 'google-apis-not-loaded';
          throw customError;
        }
        if (error.message === 'NO_RESTAURANT_ACCOUNT') {
          const customError = new Error('NO_RESTAURANT_ACCOUNT') as Error & { code: string };
          customError.code = 'no-restaurant-account';
          throw customError;
        }
        if (error.message === 'RESTAURANT_ACCOUNT_DELETED') {
          const customError = new Error('RESTAURANT_ACCOUNT_DELETED') as Error & { code: string };
          customError.code = 'restaurant-account-deleted';
          throw customError;
        }
      }
      
      // Handle specific Firebase Auth errors
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        
        // If user doesn't exist, suggest creating an account
        if (firebaseError.code === 'auth/user-not-found') {
          const customError = new Error('ACCOUNT_NOT_FOUND') as Error & { code: string };
          customError.code = 'auth/user-not-found';
          throw customError;
        }
        
        // Handle popup closed by user
        if (firebaseError.code === 'auth/popup-closed-by-user') {
          const customError = new Error('Sign-in cancelled. Please try again if you want to continue.') as Error & { code: string };
          customError.code = 'auth/popup-closed-by-user';
          throw customError;
        }
        
        // Handle popup blocked
        if (firebaseError.code === 'auth/popup-blocked') {
          const customError = new Error('Sign-in popup was blocked. Please allow popups for this site and try again.') as Error & { code: string };
          customError.code = 'auth/popup-blocked';
          throw customError;
        }
        
        // Handle internal errors (often CSP related)
        if (firebaseError.code === 'auth/internal-error') {
          const customError = new Error('Google Sign-in failed due to browser security settings. Please try refreshing the page or using a different browser.') as Error & { code: string };
          customError.code = 'auth/internal-error';
          throw customError;
        }
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    const user = auth.currentUser;
    await firebaseSignOut(auth);
    if (user) {
      await logActivity({
        userId: user.uid,
        userEmail: user.email || '',
        action: 'logout',
        entityType: 'restaurant',
      });
    }
    navigate('/login');
  };

  const updateRestaurantProfile = async (restaurantData: Partial<Restaurant>) => {
    if (!currentUser) throw new Error('No authenticated user');
    
    await setDoc(doc(db, 'restaurants', currentUser.uid), {
      ...restaurantData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update local state
    if (restaurant) {
      setRestaurant({
        ...restaurant,
        ...restaurantData
      });
    }
  };

  // Add password reset function
  const sendPasswordResetEmail = async (email: string) => {
    await firebaseSendPasswordResetEmail(auth, email);
  };

  const value = {
    currentUser,
    restaurant,
    loading,
    isVerified,
    signIn,
    signInWithGoogle,
    signOut,
    updateRestaurantProfile,
    sendPasswordResetEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};