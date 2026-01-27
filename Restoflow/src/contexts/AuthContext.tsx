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
import type { EmployeeRef } from '../types/geskap';
import { findEmployeeRestaurant } from '../services/firestore/employees/employeeRefService';

interface AuthContextType {
  currentUser: User | null;
  restaurant: Restaurant | null;
  employee: EmployeeRef | null;
  isEmployee: boolean;
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
  const [employee, setEmployee] = useState<EmployeeRef | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // First check if user is a restaurant owner
        const restaurantRef = doc(db, 'restaurants', user.uid);
        const restaurantDoc = await getDoc(restaurantRef);
        
        if (restaurantDoc.exists()) {
          // User is a restaurant owner
          const restaurantData = { id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant;
          setRestaurant(restaurantData);
          setEmployee(null);
          setIsVerified(restaurantData.isVerified === true && restaurantData.verificationStatus === 'verified');
          
          // Set up real-time listener for restaurant
          const unsubRestaurant = onSnapshot(restaurantRef, (doc) => {
            if (doc.exists()) {
              const data = { id: doc.id, ...doc.data() } as Restaurant;
              setRestaurant(data);
              setIsVerified(data.isVerified === true && data.verificationStatus === 'verified');
            }
            setLoading(false);
          }, (error) => {
            console.error('Error listening to restaurant data:', error);
            setRestaurant(null);
            setIsVerified(false);
            setLoading(false);
          });
          
          setLoading(false);
          return unsubRestaurant;
        } else {
          // Check if user is an employee
          const employeeResult = await findEmployeeRestaurant(user.uid);
          
          if (employeeResult) {
            // User is an employee
            const { restaurantId, employee: employeeData } = employeeResult;
            
            // Load restaurant data
            const employeeRestaurantRef = doc(db, 'restaurants', restaurantId);
            const employeeRestaurantDoc = await getDoc(employeeRestaurantRef);
            
            if (employeeRestaurantDoc.exists()) {
              const restaurantData = { id: employeeRestaurantDoc.id, ...employeeRestaurantDoc.data() } as Restaurant;
              
              // Check if restaurant is deleted or deactivated
              if (restaurantData.deleted || restaurantData.isDeleted) {
                setRestaurant(null);
                setEmployee(null);
                setIsVerified(false);
                setLoading(false);
                return;
              }
              
              if (restaurantData.isDeactivated || restaurantData.deactivated) {
                setRestaurant(null);
                setEmployee(null);
                setIsVerified(false);
                setLoading(false);
                return;
              }
              
              // Check if employee is active
              if (!employeeData.isActive) {
                setRestaurant(null);
                setEmployee(null);
                setIsVerified(false);
                setLoading(false);
                return;
              }
              
              setRestaurant(restaurantData);
              setEmployee(employeeData);
              setIsVerified(restaurantData.isVerified === true && restaurantData.verificationStatus === 'verified');
              
              // Set up real-time listeners
              const unsubRestaurant = onSnapshot(employeeRestaurantRef, (doc) => {
                if (doc.exists()) {
                  const data = { id: doc.id, ...doc.data() } as Restaurant;
                  setRestaurant(data);
                  setIsVerified(data.isVerified === true && data.verificationStatus === 'verified');
                }
              });
              
              const employeeRef = doc(db, 'restaurants', restaurantId, 'employeeRefs', user.uid);
              const unsubEmployee = onSnapshot(employeeRef, (doc) => {
                if (doc.exists()) {
                  const data = { id: doc.id, ...doc.data() } as EmployeeRef;
                  setEmployee(data);
                  
                  // If employee becomes inactive, sign out
                  if (!data.isActive) {
                    firebaseSignOut(auth);
                  }
                } else {
                  // Employee document deleted, sign out
                  firebaseSignOut(auth);
                }
              });
              
              setLoading(false);
              return () => {
                unsubRestaurant();
                unsubEmployee();
              };
            } else {
              // Restaurant not found
              setRestaurant(null);
              setEmployee(null);
              setIsVerified(false);
              setLoading(false);
            }
          } else {
            // Neither restaurant owner nor employee
            setRestaurant(null);
            setEmployee(null);
            setIsVerified(false);
            setLoading(false);
          }
        }
      } else {
        setRestaurant(null);
        setEmployee(null);
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
      
      // First check if user is a restaurant owner
      const restaurantDoc = await getDoc(doc(db, 'restaurants', cred.user.uid));
      
      if (restaurantDoc.exists()) {
        // User is a restaurant owner
        const restaurantData = restaurantDoc.data();
        
        if (restaurantData?.deleted || restaurantData?.isDeleted) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_ACCOUNT_DELETED');
        }
        
        if (restaurantData?.isDeactivated || restaurantData?.deactivated) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_ACCOUNT_DISABLED');
        }
        
        // Log activity and navigate
        await logActivity({
          userId: cred.user.uid,
          userEmail: email,
          action: 'login',
          entityType: 'restaurant',
        });
        
        console.log('[AuthContext] signIn complete (owner), navigating to dashboard');
        navigate('/dashboard');
        return;
      }
      
      // Check if user is an employee
      console.log('[AuthContext] Checking if user is an employee...', { uid: cred.user.uid });
      const employeeResult = await findEmployeeRestaurant(cred.user.uid);
      console.log('[AuthContext] Employee lookup result:', employeeResult);
      
      if (employeeResult) {
        const { restaurantId, employee: employeeData } = employeeResult;
        console.log('[AuthContext] Employee found:', { restaurantId, employeeId: employeeData.id, isActive: employeeData.isActive });
        
        // Check if employee is active
        if (!employeeData.isActive) {
          await firebaseSignOut(auth);
          throw new Error('EMPLOYEE_ACCOUNT_DISABLED');
        }
        
        // Load restaurant data to verify it's not deleted/deactivated
        const employeeRestaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
        
        if (!employeeRestaurantDoc.exists()) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_NOT_FOUND');
        }
        
        const restaurantData = employeeRestaurantDoc.data();
        
        if (restaurantData?.deleted || restaurantData?.isDeleted) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_ACCOUNT_DELETED');
        }
        
        if (restaurantData?.isDeactivated || restaurantData?.deactivated) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_ACCOUNT_DISABLED');
        }
        
        // Log activity and navigate
        await logActivity({
          userId: cred.user.uid,
          userEmail: email,
          action: 'login',
          entityType: 'employee',
          details: { restaurantId },
        });
        
        console.log('[AuthContext] signIn complete (employee), navigating to dashboard');
        navigate('/dashboard');
        return;
      }
      
      // Neither restaurant owner nor employee
      console.log('[AuthContext] User is neither restaurant owner nor employee');
      await firebaseSignOut(auth);
      throw new Error('NO_RESTAURANT_ACCOUNT');
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
      const userId = userCredential.user.uid;
      const userEmail = userCredential.user.email || '';
      
      // First check if user is a restaurant owner
      const restaurantDoc = await getDoc(doc(db, 'restaurants', userId));
      
      if (restaurantDoc.exists()) {
        // User is a restaurant owner
        const restaurantData = restaurantDoc.data();
        
        if (restaurantData?.deleted || restaurantData?.isDeleted) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_ACCOUNT_DELETED');
        }
        
        if (restaurantData?.isDeactivated || restaurantData?.deactivated) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_ACCOUNT_DISABLED');
        }
        
        // Log activity and navigate
        await logActivity({
          userId,
          userEmail,
          action: 'login_google',
          entityType: 'restaurant',
        });
        
        console.log('[AuthContext] signInWithGoogle complete (owner), navigating to dashboard');
        navigate('/dashboard');
        return;
      }
      
      // Check if user is an employee
      console.log('[AuthContext] Checking if user is an employee (Google)...', { uid: userId });
      const employeeResult = await findEmployeeRestaurant(userId);
      console.log('[AuthContext] Employee lookup result (Google):', employeeResult);
      
      if (employeeResult) {
        const { restaurantId, employee: employeeData } = employeeResult;
        console.log('[AuthContext] Employee found (Google):', { restaurantId, employeeId: employeeData.id, isActive: employeeData.isActive });
        
        // Check if employee is active
        if (!employeeData.isActive) {
          await firebaseSignOut(auth);
          throw new Error('EMPLOYEE_ACCOUNT_DISABLED');
        }
        
        // Load restaurant data to verify it's not deleted/deactivated
        const employeeRestaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
        
        if (!employeeRestaurantDoc.exists()) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_NOT_FOUND');
        }
        
        const restaurantData = employeeRestaurantDoc.data();
        
        if (restaurantData?.deleted || restaurantData?.isDeleted) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_ACCOUNT_DELETED');
        }
        
        if (restaurantData?.isDeactivated || restaurantData?.deactivated) {
          await firebaseSignOut(auth);
          throw new Error('RESTAURANT_ACCOUNT_DISABLED');
        }
        
        // Log activity and navigate
        await logActivity({
          userId,
          userEmail,
          action: 'login_google',
          entityType: 'employee',
          details: { restaurantId },
        });
        
        console.log('[AuthContext] signInWithGoogle complete (employee), navigating to dashboard');
        navigate('/dashboard');
        return;
      }
      
      // Neither restaurant owner nor employee
      await firebaseSignOut(auth);
      throw new Error('NO_RESTAURANT_ACCOUNT');
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
        if (error.message === 'EMPLOYEE_ACCOUNT_DISABLED') {
          const customError = new Error('Your employee account has been disabled. Please contact your restaurant manager.') as Error & { code: string };
          customError.code = 'employee-account-disabled';
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
    const isEmployeeUser = employee !== null;
    await firebaseSignOut(auth);
    if (user) {
      await logActivity({
        userId: user.uid,
        userEmail: user.email || '',
        action: 'logout',
        entityType: isEmployeeUser ? 'employee' : 'restaurant',
        details: { restaurantId: restaurant?.id },
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
    employee,
    isEmployee: employee !== null,
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