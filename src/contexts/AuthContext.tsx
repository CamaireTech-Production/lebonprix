import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '../services/firebase';
import { 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  updatePassword
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Company } from '../types/models';
import { ensureDefaultFinanceEntryTypes } from '../services/firestore';
import { dataCache, cacheKeys } from '../utils/dataCache';

interface AuthContextType {
  user: User | null;
  currentUser: User | null; // For backward compatibility
  company: Company | null;
  loading: boolean;
  companyLoading: boolean; // New: indicates if company data is still loading in background
  signUp: (email: string, password: string, companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<User>;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  updateCompany: (data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyLoading, setCompanyLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔥 Auth state changed:', user ? 'User logged in' : 'User logged out');
      setUser(user);
      
      if (user) {
        // 🚀 IMMEDIATE UI RENDER: Set loading to false right away
        console.log('✅ User authenticated - rendering UI immediately');
        setLoading(false);
        
        // 🔄 BACKGROUND LOADING: Start company data fetch in background
        console.log('🔄 Starting background company data loading...');
        loadCompanyDataInBackground(user.uid);
        
        // 🔄 BACKGROUND LOADING: Start finance types in background
        console.log('🔄 Starting background finance types loading...');
        loadFinanceTypesInBackground();
        
      } else {
        setCompany(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // 🔄 Background company data loading function with caching
  const loadCompanyDataInBackground = async (userId: string) => {
    setCompanyLoading(true);
    try {
      const cacheKey = cacheKeys.company(userId);
      
      // Check cache first
      const cachedCompany = dataCache.get<Company>(cacheKey);
      if (cachedCompany) {
        setCompany(cachedCompany);
        setCompanyLoading(false);
        console.log('🚀 Company data loaded from cache');
        return;
      }
      
      console.log('📡 Fetching company data in background...');
      
      // Add timeout protection
      const companyDoc = await Promise.race([
        getDoc(doc(db, 'companies', userId)),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Company fetch timeout after 10 seconds')), 10000)
        )
      ]);
      
      if (companyDoc.exists()) {
        const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
        setCompany(companyData);
        
        // Cache company data for 15 minutes (company data changes rarely)
        dataCache.set(cacheKey, companyData, 15 * 60 * 1000);
        console.log('✅ Company data loaded and cached successfully in background');
      } else {
        console.log('⚠️ No company document found for user');
      }
    } catch (error) {
      console.error('❌ Background company loading failed:', error);
      // App continues to work without company data
      // You could show a subtle notification to user if needed
    } finally {
      setCompanyLoading(false);
    }
  };

  // 🔄 Background finance types loading function
  const loadFinanceTypesInBackground = async () => {
    try {
      console.log('📡 Ensuring finance types in background...');
      
      // Add timeout protection
      await Promise.race([
        ensureDefaultFinanceEntryTypes(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Finance types timeout after 15 seconds')), 15000)
        )
      ]);
      
      console.log('✅ Finance types ensured successfully in background');
    } catch (error) {
      console.error('❌ Background finance types loading failed:', error);
      // App continues to work without finance types setup
      // Finance features might have fallbacks or show setup prompts
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
  ): Promise<User> => {
    const response = await createUserWithEmailAndPassword(auth, email, password);
    const user = response.user;

    // Create company document
    const companyDoc = {
      ...companyData,
      userId: user.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await setDoc(doc(db, 'companies', user.uid), companyDoc);

    // Set company in state
    setCompany({ id: user.uid, ...companyDoc } as Company);

    return user;
  };

  const signIn = async (email: string, password: string): Promise<User> => {
    const response = await signInWithEmailAndPassword(auth, email, password);
    return response.user;
  };

  const signOut = (): Promise<void> => {
    return firebaseSignOut(auth);
  };

  const updateCompany = async (data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    const companyRef = doc(db, 'companies', user.uid);
    const updateData = {
      ...data,
      updatedAt: Timestamp.now()
    };

    await updateDoc(companyRef, updateData);
    
    // Update local state
    setCompany(prev => prev ? { ...prev, ...updateData } : null);
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    // Reauthenticate user before changing password
    const credential = await signInWithEmailAndPassword(auth, user.email!, currentPassword);
    await updatePassword(credential.user, newPassword);
  };

  const value = {
    user,
    currentUser: user, // For backward compatibility
    company,
    loading,
    companyLoading,
    signUp,
    signIn,
    signOut,
    updateCompany,
    updateUserPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};