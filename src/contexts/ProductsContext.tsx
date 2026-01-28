/**
 * Products Context
 * Shares a single Firebase subscription for products across all components
 * This eliminates duplicate subscriptions and reduces Firebase reads
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToProducts } from '@services/firestore/products/productService';
import ProductsManager from '@services/storage/ProductsManager';
import BackgroundSyncService from '@services/utilities/backgroundSync';
import type { Product } from '../types/models';
import { createProduct, updateProduct } from '@services/firestore/products/productService';
import { logError } from '@utils/core/logger';
import { Timestamp } from 'firebase/firestore';

interface ProductsContextType {
  products: Product[];
  loading: boolean;
  syncing: boolean;
  error: Error | null;
  addProduct: (
    productData: Omit<Product, 'id' | 'createdAt'>,
    supplierInfo?: {
      supplierId?: string;
      isOwnPurchase?: boolean;
      isCredit?: boolean;
      costPrice?: number;
    },
    createdBy?: import('../types/models').EmployeeRef | null
  ) => Promise<Product>;
  updateProductData: (productId: string, updates: Partial<Product>) => Promise<void>;
  refresh: () => void;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, company } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Single subscription for all components
  useEffect(() => {
    if (!user || !company) {
      setProducts([]);
      setLoading(false);
      setSyncing(false);
      return;
    }

    // 1. Check localStorage FIRST - instant display if data exists
    const localProducts = ProductsManager.load(company.id);
    if (localProducts && localProducts.length > 0) {
      setProducts(localProducts);
      setLoading(false);
      setSyncing(true);
    } else {
      setLoading(true);
    }

    // 2. Start background sync with Firebase
    BackgroundSyncService.syncProducts(company.id, (freshProducts) => {
      setProducts(freshProducts);
      setSyncing(false);
      setLoading(false);
    });

    // 3. Maintain single real-time subscription for all components
    const unsubscribe = subscribeToProducts(company.id, (data) => {
      setProducts(data);
      setLoading(false);
      setSyncing(false);
      
      // Save to localStorage for future instant loads
      ProductsManager.save(company.id, data);
    });

    return () => unsubscribe();
  }, [user, company]);

  const addProduct = useCallback(async (
    productData: Omit<Product, 'id' | 'createdAt'>,
    supplierInfo?: {
      supplierId?: string;
      isOwnPurchase?: boolean;
      isCredit?: boolean;
      costPrice?: number;
    },
    createdBy?: import('../types/models').EmployeeRef | null
  ): Promise<Product> => {
    if (!user || !company) {
      throw new Error('User not authenticated');
    }
    try {
      const newProduct = await createProduct(
        { ...productData, userId: user.uid, companyId: company.id },
        company.id,
        createdBy,
        supplierInfo
      );
      
      // Invalidate products cache
      ProductsManager.remove(company.id);
      if (user.uid) {
        ProductsManager.remove(user.uid);
      }
      
      // Notify product list to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('products:refresh', {
          detail: { companyId: company.id }
        }));
      }
      
      return newProduct;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [user, company]);

  const updateProductData = useCallback(async (productId: string, updates: Partial<Product>): Promise<void> => {
    if (!user || !company) {
      throw new Error('User not authenticated');
    }
    try {
      await updateProduct(productId, {
        ...updates,
        updatedAt: Timestamp.now()
      }, company.id);
      
      // Invalidate products cache
      ProductsManager.remove(company.id);
      
      // Notify product list to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('products:refresh', {
          detail: { companyId: company.id }
        }));
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [user, company]);

  const refresh = useCallback(() => {
    if (company?.id) {
      ProductsManager.remove(company.id);
      // The subscription will automatically refresh
    }
  }, [company?.id]);

  const value: ProductsContextType = {
    products,
    loading,
    syncing,
    error,
    addProduct,
    updateProductData,
    refresh
  };

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
};

export const useProductsContext = (): ProductsContextType => {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    throw new Error('useProductsContext must be used within a ProductsProvider');
  }
  return context;
};

