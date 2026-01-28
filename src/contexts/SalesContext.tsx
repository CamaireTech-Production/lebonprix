/**
 * Sales Context
 * Shares a single Firebase subscription for sales across all components
 * This eliminates duplicate subscriptions and reduces Firebase reads
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToSales, createSale, updateSaleDocument, updateSaleStatus } from '@services/firestore/sales/saleService';
import SalesManager from '@services/storage/SalesManager';
import ProductsManager from '@services/storage/ProductsManager';
import BackgroundSyncService from '@services/utilities/backgroundSync';
import type { Sale, OrderStatus, PaymentStatus } from '../types/models';
import { logError } from '@utils/core/logger';
import { Timestamp } from 'firebase/firestore';

interface SalesContextType {
  sales: Sale[];
  loading: boolean;
  syncing: boolean;
  error: Error | null;
  addSale: (
    data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>,
    createdBy?: import('../types/models').EmployeeRef | null
  ) => Promise<Sale>;
  updateSale: (saleId: string, data: Partial<Sale>) => Promise<void>;
  deleteSale: (saleId: string) => Promise<void>;
  updateStatus: (id: string, status: OrderStatus, paymentStatus: PaymentStatus) => Promise<void>;
  refresh: () => void;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export const SalesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, company } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Single subscription for all components
  useEffect(() => {
    if (!user || !company) {
      setSales([]);
      setLoading(false);
      setSyncing(false);
      return;
    }

    // 1. Check localStorage FIRST - instant display if data exists
    const localSales = SalesManager.load(company.id);
    if (localSales && localSales.length > 0) {
      setSales(localSales);
      setLoading(false);
      setSyncing(true);
    } else {
      setLoading(true);
    }

    // 2. Start background sync with Firebase
    BackgroundSyncService.syncSales(company.id, (freshSales) => {
      setSales(freshSales);
      setSyncing(false);
      setLoading(false);
    });

    // 3. Maintain single real-time subscription for all components
    const unsubscribe = subscribeToSales(company.id, (data) => {
      setSales(data);
      setLoading(false);
      setSyncing(false);
      
      // Save to localStorage for future instant loads
      SalesManager.save(company.id, data);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addSale = useCallback(async (
    data: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>,
    createdBy?: import('../types/models').EmployeeRef | null
  ): Promise<Sale> => {
    if (!user || !company) {
      throw new Error('User not authenticated');
    }
    try {
      const newSale = await createSale(
        { ...data, userId: user.uid, companyId: company.id },
        company.id,
        createdBy
      );
      
      // Invalidate sales cache
      SalesManager.remove(company.id);
      
      // Force sync to update localStorage
      BackgroundSyncService.forceSyncSales(company.id, (freshSales) => {
        setSales(freshSales);
      });
      
      // Invalidate product caches so stock values refresh
      ProductsManager.remove(company.id);
      if (user.uid) {
        ProductsManager.remove(user.uid);
      }
      
      // Notify product list to refresh immediately if mounted
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('products:refresh', {
          detail: { companyId: company.id }
        }));
      }
      
      // Wait for syncFinanceEntryWithSale to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Trigger finance refresh to update balance immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finance:refresh'));
      }
      
      return newSale;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [user, company]);

  const updateSale = useCallback(async (saleId: string, data: Partial<Sale>): Promise<void> => {
    if (!user || !company) {
      throw new Error('User not authenticated');
    }
    try {
      await updateSaleDocument(saleId, data, company.id);
      
      // Update local state
      setSales(currentSales => 
        currentSales.map(sale => 
          sale.id === saleId 
            ? { ...sale, ...data, updatedAt: Timestamp.now() }
            : sale
        )
      );
      
      // Invalidate cache
      SalesManager.remove(company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [user, company]);

  const deleteSale = useCallback(async (saleId: string): Promise<void> => {
    if (!user || !company) {
      throw new Error('User not authenticated');
    }
    try {
      // Soft delete is handled by the service
      // Just update local state
      setSales(currentSales => currentSales.filter(sale => sale.id !== saleId));
      
      // Invalidate cache
      SalesManager.remove(company.id);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [user, company]);

  const updateStatus = useCallback(async (id: string, status: OrderStatus, paymentStatus: PaymentStatus): Promise<void> => {
    if (!user || !company) {
      throw new Error('User not authenticated');
    }
    try {
      await updateSaleStatus(id, status, paymentStatus, company.id);
      
      // Update local state
      setSales(currentSales => 
        currentSales.map(sale => 
          sale.id === id 
            ? { ...sale, status, paymentStatus, updatedAt: Timestamp.now() }
            : sale
        )
      );
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [user, company]);

  const refresh = useCallback(() => {
    if (company?.id) {
      SalesManager.remove(company.id);
      // The subscription will automatically refresh
    }
  }, [company?.id]);

  const value: SalesContextType = {
    sales,
    loading,
    syncing,
    error,
    addSale,
    updateSale,
    deleteSale,
    updateStatus,
    refresh
  };

  return (
    <SalesContext.Provider value={value}>
      {children}
    </SalesContext.Provider>
  );
};

export const useSalesContext = (): SalesContextType => {
  const context = useContext(SalesContext);
  if (context === undefined) {
    throw new Error('useSalesContext must be used within a SalesProvider');
  }
  return context;
};

