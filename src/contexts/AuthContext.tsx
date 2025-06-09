import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '../services/firebase';
import { 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import type { Company } from '../types/models';

interface AuthContextType {
  currentUser: User | null;
  company: Company | null;
  loading: boolean;
  signUp: (email: string, password: string, companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<User>;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch company data when user is logged in
        const companyDoc = await getDoc(doc(db, 'companies', user.uid));
        if (companyDoc.exists()) {
          setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
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

  const value = {
    currentUser,
    company,
    loading,
    signUp,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};