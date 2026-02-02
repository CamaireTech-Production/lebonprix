import { useState, useEffect, useCallback } from 'react';
import { sharedSubscriptions } from '@services/firestore/sharedSubscriptions';
import { useAuth } from '@contexts/AuthContext';
import type { Product } from '../../types/models';

/**
 * Hook for accessing products in sales contexts (includes deleted/unavailable products)
 * This is specifically for sales editing, viewing, and management where we need to see
 * all products including those that have been marked as unavailable or deleted
 */
export const useSalesProducts = () => {
  const { user, company } = useAuth();
  const [salesProducts, setSalesProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize sales products subscription when company is available
  useEffect(() => {
    if (!user || !company) {
      setSalesProducts([]);
      setLoading(false);
      setSyncing(false);
      return;
    }

    // Initialize sales products subscription (includes all products)
    sharedSubscriptions.initializeSalesProducts(company.id);

    // Subscribe to updates from shared subscription
    const unsubscribe = sharedSubscriptions.subscribeToSalesProducts((data) => {
      setSalesProducts(data);
      const state = sharedSubscriptions.getSalesProductsState();
      setLoading(state.loading);
      setSyncing(state.syncing);
      setError(state.error);
    });

    return () => unsubscribe();
  }, [user, company]);

  // Helper function to get product by ID
  const getProductById = useCallback((productId: string): Product | undefined => {
    return salesProducts.find(p => p.id === productId);
  }, [salesProducts]);

  // Helper function to get product name with status
  const getProductNameWithStatus = useCallback((productId: string): string => {
    const product = getProductById(productId);
    if (!product) return 'Product Not Found';
    
    // Import here to avoid circular dependency
    const { getProductStatus, formatProductNameWithStatus } = require('@utils/productStatusHelper');
    return formatProductNameWithStatus(product);
  }, [getProductById]);

  // Helper function to check if product can be edited
  const canEditProduct = useCallback((productId: string): boolean => {
    const product = getProductById(productId);
    if (!product) return false;
    
    const { getProductStatus } = require('@utils/productStatusHelper');
    const status = getProductStatus(product);
    return status.allowEdit;
  }, [getProductById]);

  // Helper function to get products with status for a sale
  const getSaleProductsWithStatus = useCallback((sale: any) => {
    if (!sale.products || !Array.isArray(sale.products)) {
      return [];
    }

    const { getSaleProductsWithStatus } = require('@utils/productStatusHelper');
    return getSaleProductsWithStatus(sale, salesProducts);
  }, [salesProducts]);

  return {
    // Data
    salesProducts,
    loading,
    syncing,
    error,
    
    // Helper functions
    getProductById,
    getProductNameWithStatus,
    canEditProduct,
    getSaleProductsWithStatus,
  };
};
