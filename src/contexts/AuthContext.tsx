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

interface AuthContextType {
  user: User | null;
  currentUser: User | null; // For backward compatibility
  company: Company | null;
  loading: boolean;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Fetch company data when user is logged in
        const companyDoc = await getDoc(doc(db, 'companies', user.uid));
        if (companyDoc.exists()) {
          setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
        }
        
        // Ensure default finance entry types exist
        try {
          await ensureDefaultFinanceEntryTypes();
        } catch (error) {
          console.error('Failed to ensure default finance entry types:', error);
        }
      } else {
        setCompany(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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