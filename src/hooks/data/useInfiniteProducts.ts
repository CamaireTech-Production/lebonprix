import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { query, collection, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@services/firebase';
import { devLog, logError } from '@utils/core/logger';
import ProductsManager from '@services/storage/ProductsManager';
import BackgroundSyncService from '@services/utilities/backgroundSync';
import type { Product } from '../types/models';

interface UseInfiniteProductsReturn {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  syncing: boolean; // Add syncing state
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  refresh: () => void;
}

const PRODUCTS_PER_PAGE = 20;

export const useInfiniteProducts = (): UseInfiniteProductsReturn => {
  const { user, company } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false); // Start as false
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false); // Add syncing state
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  // Load initial products
  const loadInitialProducts = useCallback(async () => {
    
    if (!user?.uid || !company?.id) {
      setLoading(false);
      return;
    }

    // 1. Check localStorage FIRST - instant display if data exists
    const localProducts = ProductsManager.load(company.id);
    if (localProducts && localProducts.length > 0) {
      const visibleProducts = localProducts.filter(product => 
        product.isAvailable !== false
      );
      setProducts(visibleProducts);
      setLoading(false); // No loading spinner - data is available
      setSyncing(true); // Show background sync indicator
      
      // Start background sync
      BackgroundSyncService.syncProducts(company.id, (freshProducts) => {
        const visibleProducts = freshProducts.filter(product => 
          product.isAvailable !== false
        );
        setProducts(visibleProducts);
        setSyncing(false); // Hide background sync indicator
      });
      return;
    }

    try {
      setLoading(true); // Only show loading spinner if no cached data
      setError(null);

      const q = query(
        collection(db, 'products'),
        where('companyId', '==', company.id),
        orderBy('createdAt', 'desc'),
        limit(PRODUCTS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const allProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      const productsData = allProducts.filter(product => 
        product.isAvailable !== false
      );

      setProducts(productsData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PRODUCTS_PER_PAGE);
      
      // Save to localStorage for future instant loads
      ProductsManager.save(company.id, productsData);
    } catch (err) {
      console.error('❌ Error loading initial products:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, company?.id]);

  // Load more products (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!user?.uid || !company?.id || !lastDoc || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      setError(null);

      const q = query(
        collection(db, 'products'),
        where('companyId', '==', company.id),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PRODUCTS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const allNewProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      const newProducts = allNewProducts.filter(product => 
        product.isAvailable !== false
      );

      if (newProducts.length > 0) {
        setProducts(prev => {
          const totalLength = prev.length + newProducts.length;
          return [...prev, ...newProducts];
        });
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(newProducts.length === PRODUCTS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      logError('Error loading more products', err);
      setError(err as Error);
    } finally {
      setLoadingMore(false);
    }
  }, [user?.uid, company?.id, lastDoc, loadingMore, hasMore]);

  // Refresh products (reset and reload)
  const refresh = useCallback(() => {
    // Clear localStorage to force fresh data with images
    if (company?.id) {
      ProductsManager.remove(company.id);
    }
    setProducts([]);
    setLastDoc(null);
    setHasMore(true);
    loadInitialProducts();
  }, [loadInitialProducts, company?.id]);

  // Load initial products when user or company changes
  useEffect(() => {
    if (user?.uid && company?.id) {
      loadInitialProducts();
    } else {
      // Reset state when user or company is not available
      setProducts([]);
      setLastDoc(null);
      setHasMore(true);
      setLoading(false);
      setError(null);
    }
  }, [user?.uid, company?.id, loadInitialProducts]);

  return {
    products,
    loading,
    loadingMore,
    syncing, // Export syncing state
    hasMore,
    error,
    loadMore,
    refresh
  };
};
