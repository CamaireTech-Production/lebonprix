import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { query, collection, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Product } from '../types/models';

interface UseInfiniteProductsReturn {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  refresh: () => void;
}

const PRODUCTS_PER_PAGE = 20;

export const useInfiniteProducts = (): UseInfiniteProductsReturn => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  // Load initial products
  const loadInitialProducts = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const q = query(
        collection(db, 'products'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(PRODUCTS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const allProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      const productsData = allProducts.filter(product => product.isAvailable !== false);

      setProducts(productsData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PRODUCTS_PER_PAGE);
      
      console.log(`✅ Initial products loaded: ${productsData.length} items`);
    } catch (err) {
      console.error('❌ Error loading initial products:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Load more products (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!user?.uid || !lastDoc || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      setError(null);

      const q = query(
        collection(db, 'products'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PRODUCTS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const allNewProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      const newProducts = allNewProducts.filter(product => product.isAvailable !== false);

      if (newProducts.length > 0) {
        setProducts(prev => {
          const totalLength = prev.length + newProducts.length;
          console.log(`✅ More products loaded: ${newProducts.length} items (total: ${totalLength})`);
          return [...prev, ...newProducts];
        });
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(newProducts.length === PRODUCTS_PER_PAGE);
      } else {
        setHasMore(false);
        console.log('✅ No more products to load');
      }
    } catch (err) {
      console.error('❌ Error loading more products:', err);
      setError(err as Error);
    } finally {
      setLoadingMore(false);
    }
  }, [user?.uid, lastDoc, loadingMore, hasMore]);

  // Refresh products (reset and reload)
  const refresh = useCallback(() => {
    setProducts([]);
    setLastDoc(null);
    setHasMore(true);
    loadInitialProducts();
  }, [loadInitialProducts]);

  // Load initial products when user changes
  useEffect(() => {
    if (user?.uid) {
      loadInitialProducts();
    } else {
      // Reset state when user is not available
      setProducts([]);
      setLastDoc(null);
      setHasMore(true);
      setLoading(false);
      setError(null);
    }
  }, [user?.uid, loadInitialProducts]);

  return {
    products,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh
  };
};
