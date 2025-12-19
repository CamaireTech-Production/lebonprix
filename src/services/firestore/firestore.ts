/**
 * Firestore Service - Legacy Re-export File
 * 
 * This file re-exports all functions from dedicated service files.
 * It maintains backward compatibility while the codebase is migrated to use
 * the new service structure.
 * 
 * MIGRATION STATUS:
 * - All collection-specific services have been created
 * - Functions are re-exported from their dedicated services
 * - Some utility functions remain here temporarily
 * 
 * TODO: Update all imports to use dedicated services directly
 */

// ============================================================================
// RE-EXPORTS FROM DEDICATED SERVICES
// ============================================================================

// Categories
export * from './categories/categoryService';

// Products
export * from './products/productService';

// Sales
export * from './sales/saleService';

// Expenses
export * from './expenses/expenseService';

// Matieres
export * from './matieres/matiereService';

// Suppliers
export * from './suppliers/supplierService';

// Finance
export * from './finance/financeService';

// Stock
export * from './stock/stockService';

// Objectives
export * from './objectives/objectiveService';

// Tags
export * from './tags/tagService';

// Customers
export * from './customers/customerService';
export * from './customers/customerSourceService';

// Orders
export * from './orders/orderService';

// Companies
export * from './companies/companyService';
export * from './companies/companyPublic';
export * from './companies/companyVerificationService';
export * from './companies/userCompanySyncService';

// Employees - Explicit exports to avoid conflicts
// Note: getEmployeeRole and isUserEmployeeOfCompany exist in both employeeDisplayService and employeeRefService
// We export from employeeDisplayService (more complete implementation)
export {
  getEmployeeRole,
  isUserEmployeeOfCompany
} from './employees/employeeDisplayService';
// Export other functions from employeeDisplayService
export * from './employees/employeeDisplayService';
export * from './employees/employeeRefService';
export * from './employees/invitationService';
export * from './employees/permissionTemplateService';

// Shared utilities
export * from './shared';

// ============================================================================
// UTILITY FUNCTIONS (Not yet moved to dedicated services)
// ============================================================================

import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../core/firebase';
import { logError } from '@utils/core/logger';
import type { Company, DashboardStats, Sale, OrderStatus, PaymentStatus } from '../../types/models';
import type { SellerSettings } from '../../types/order';
import { useState, useEffect } from 'react';

// Dashboard Stats
export const subscribeToDashboardStats = (callback: (stats: Partial<DashboardStats>) => void): (() => void) => {
  const docRef = doc(db, 'dashboardStats', 'current');

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data);
    }
  });
};

export const updateDashboardStats = async (_companyId: string): Promise<void> => {
  // This function would calculate and update dashboard statistics
  // Implementation depends on your specific requirements
};

// Company Utilities
export const getCompanyByUserId = async (companyId: string): Promise<Company> => {
  // First try to get company by document ID (most common case)
  try {
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    if (companyDoc.exists()) {
      return {
        id: companyDoc.id,
        ...companyDoc.data()
      } as Company;
    }
  } catch (error) {
    // Continue to fallback
  }
  
  // Fallback: search by companyId field (for backward compatibility)
  const companiesRef = collection(db, 'companies');
  const q = query(companiesRef, where('companyId', '==', companyId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error('Company not found');
  }
  
  const companyDoc = snapshot.docs[0];
  return {
    id: companyDoc.id,
    ...companyDoc.data()
  } as Company;
};

export const subscribeToCompanies = (callback: (companies: Company[]) => void): (() => void) => {
  const companiesRef = collection(db, 'companies');
  
  return onSnapshot(companiesRef, (snapshot) => {
    const companies = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Company[];
    
    callback(companies);
  });
};

// Seller Settings
export const getSellerSettings = async (userId: string): Promise<SellerSettings | null> => {
  try {
    const ref = doc(db, 'sellerSettings', userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as SellerSettings;
    return { ...data };
  } catch (error) {
    logError('Error fetching seller settings', error);
    throw error;
  }
};

export const updateSellerSettings = async (userId: string, settings: Partial<SellerSettings>): Promise<void> => {
  try {
    const ref = doc(db, 'sellerSettings', userId);
    const now = serverTimestamp();
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { ...settings, updatedAt: now });
    } else {
      await setDoc(ref, { userId, createdAt: now, updatedAt: now, currency: 'XAF', paymentMethods: {}, ...settings });
    }
  } catch (error) {
    logError('Error updating seller settings', error);
    throw error;
  }
};

// ============================================================================
// DEPRECATED HOOKS (Keep for backward compatibility)
// ============================================================================

// NOTE: This hook is deprecated - use the one from hooks/useFirestore.ts instead
// Keeping for backward compatibility but it requires companyId which is not available here
export const useSales = () => {
  const [sales] = useState<Sale[]>([]);
  const [loading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This hook cannot work without companyId - it's legacy code
    // The proper hook is in hooks/useFirestore.ts
    console.warn('useSales from firestore.ts is deprecated. Use the one from hooks/useFirestore.ts');
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }, []);

  const addSale = async (data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale> => {
    try {
      const { createSale } = await import('./sales/saleService');
      return await createSale(data, data.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sale');
      throw err;
    }
  };

  const updateSale = async (saleId: string, data: Partial<Sale>): Promise<void> => {
    try {
      const { updateSaleDocument } = await import('./sales/saleService');
      await updateSaleDocument(saleId, data, data.userId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sale');
      throw err;
    }
  };

  const updateStatus = async (id: string, status: OrderStatus, paymentStatus: PaymentStatus) => {
    try {
      const { updateSaleStatus } = await import('./sales/saleService');
      await updateSaleStatus(id, status, paymentStatus, sales.find(s => s.id === id)?.userId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sale status');
      throw err;
    }
  };

  return { sales, loading, error, addSale, updateSale, updateStatus };
};
