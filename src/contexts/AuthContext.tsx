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
import CompanyManager from '../services/storage/CompanyManager';
import FinanceTypesManager from '../services/storage/FinanceTypesManager';
import BackgroundSyncService from '../services/backgroundSync';

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

  // 🚀 INSTANT company data loading from localStorage with background sync
  const loadCompanyDataInBackground = async (userId: string) => {
    setCompanyLoading(true);
    
    // 1. INSTANT LOAD: Check localStorage first
    const localCompany = CompanyManager.load(userId);
    if (localCompany) {
      setCompany(localCompany);
      setCompanyLoading(false);
      console.log('🚀 Company data loaded instantly from localStorage');
      
      // 2. BACKGROUND SYNC: Update localStorage if needed
      BackgroundSyncService.syncCompany(userId, (freshCompany) => {
        setCompany(freshCompany);
        console.log('🔄 Company data updated from background sync');
      });
      return;
    }
    
    // 3. FALLBACK: No localStorage data, fetch from Firebase
    try {
      console.log('📡 No cached company data, fetching from Firebase...');
      
      const companyDoc = await getDoc(doc(db, 'companies', userId));
      
      if (companyDoc.exists()) {
        const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
        setCompany(companyData);
        
        // Save to localStorage for future instant loads
        CompanyManager.save(userId, companyData);
        console.log('✅ Company data loaded from Firebase and cached to localStorage');
      } else {
        console.log('⚠️ No company document found for user');
      }
    } catch (error) {
      console.error('❌ Company loading failed:', error);
    } finally {
      setCompanyLoading(false);
    }
  };

  // 🚀 INSTANT finance types loading with localStorage flag
  const loadFinanceTypesInBackground = async () => {
    if (!user?.uid) return;
    
    // 1. INSTANT CHECK: Check localStorage flag first
    if (!FinanceTypesManager.needsSetup(user.uid)) {
      console.log('🚀 Finance types already setup - skipping');
      return;
    }
    
    // 2. SETUP NEEDED: Ensure finance types and mark as setup
    try {
      console.log('📡 Setting up finance types...');
      
      await ensureDefaultFinanceEntryTypes();
      
      // Mark as setup in localStorage to skip future checks
      FinanceTypesManager.markAsSetup(user.uid);
      console.log('✅ Finance types setup completed and marked in localStorage');
    } catch (error) {
      console.error('❌ Finance types setup failed:', error);
      // App continues to work without finance types setup
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

    // Set company in state and localStorage
    const company = { id: user.uid, ...companyDoc } as Company;
    setCompany(company);
    CompanyManager.save(user.uid, company);

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
    
    // Update local state and localStorage
    const updatedCompany = company ? { ...company, ...updateData } : null;
    setCompany(updatedCompany);
    
    if (updatedCompany) {
      CompanyManager.save(user.uid, updatedCompany);
    }
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