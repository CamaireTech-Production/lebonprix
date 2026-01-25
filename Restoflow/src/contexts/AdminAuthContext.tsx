import React, { createContext, useContext, useState, ReactNode } from 'react';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { logActivity } from '../services/activityLogService';
import { AdminUser } from '../types';

// Mock admin users (replace with Firestore logic later)
const mockAdmins = [
  { id: '1', email: 'superadmin@example.com', password: 'superadmin', role: 'super_admin' as const, isDeleted: false },
  { id: '2', email: 'admin@example.com', password: 'admin', role: 'admin' as const, isDeleted: false },
];

interface AdminAuthContextType {
  currentAdmin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
};

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(() => {
    const stored = localStorage.getItem('adminUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const auth = getAuth();
      const db = getFirestore();
      // Sign in with Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Fetch user from Firestore 'users' collection
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (!userDoc.exists()) {
        throw new Error('Admin user not found in database');
      }
      const userData = userDoc.data();
      if (!userData || userData.isDeleted) {
        throw new Error('Admin account is deleted or invalid');
      }
      if (userData.role !== 'admin' && userData.role !== 'super_admin') {
        throw new Error('Not an admin account');
      }
      const adminUser: AdminUser = {
        id: cred.user.uid,
        email: userData.email,
        role: userData.role,
        isDeleted: userData.isDeleted,
      };
      setCurrentAdmin(adminUser);
      localStorage.setItem('adminUser', JSON.stringify(adminUser));
      await logActivity({
        userId: cred.user.uid,
        userEmail: userData.email,
        action: 'admin_login',
        entityType: 'admin',
      });
    } catch (err: any) {
      setCurrentAdmin(null);
      localStorage.removeItem('adminUser');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const auth = getAuth();
    const admin = currentAdmin;
    await firebaseSignOut(auth);
    setCurrentAdmin(null);
    localStorage.removeItem('adminUser');
    if (admin) {
      await logActivity({
        userId: admin.id,
        userEmail: admin.email,
        action: 'admin_logout',
        entityType: 'admin',
      });
    }
  };

  return (
    <AdminAuthContext.Provider value={{ currentAdmin, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}; 