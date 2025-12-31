// src/hooks/useInfiniteSales.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { query, collection, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import SalesManager from '../services/storage/SalesManager';
import BackgroundSyncService from '../services/backgroundSync';
import { subscribeToSales } from '../services/firestore';
import type { Sale } from '../types/models';

interface UseInfiniteSalesReturn {
  sales: Sale[];
  loading: boolean;
  loadingMore: boolean;
  syncing: boolean; // Add syncing state
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  refresh: () => void;
  updateSaleInList: (saleId: string, updatedSale: Sale) => void;
  removeSaleFromList: (saleId: string) => void;
  addSaleToList: (newSale: Sale) => void;
}

const SALES_PER_PAGE = 20;

export const useInfiniteSales = (): UseInfiniteSalesReturn => {
  const { user, company } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false); // Start as false
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false); // Add syncing state
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isInitialLoadRef = useRef(true);

  // Load initial sales
  const loadInitialSales = useCallback(async () => {
    if (!user?.uid || !company?.id) {
      setLoading(false);
      return;
    }

    // 1. Check localStorage FIRST - instant display if data exists
    const localSales = SalesManager.load(company.id);
    if (localSales && localSales.length > 0) {
      setSales(localSales);
      setLoading(false); // No loading spinner - data is available
      setSyncing(true); // Show background sync indicator
      console.log('🚀 Sales loaded instantly from localStorage');
      
      // Start background sync
      BackgroundSyncService.syncSales(company.id, (freshSales) => {
        setSales(freshSales);
        setSyncing(false); // Hide background sync indicator
        console.log('🔄 Sales updated from background sync');
      });
      return;
    }

    try {
      setLoading(true); // Only show loading spinner if no cached data
      setError(null);
      console.log('📡 No cached sales, loading from Firebase...');

      const q = query(
        collection(db, 'sales'),
        where('companyId', '==', company.id),
        orderBy('createdAt', 'desc'),
        limit(SALES_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sale[];

      setSales(salesData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === SALES_PER_PAGE);
      
      // Save to localStorage for future instant loads
      SalesManager.save(company.id, salesData);
      console.log(`✅ Initial sales loaded and cached: ${salesData.length} items`);
    } catch (err) {
      console.error('❌ Error loading initial sales:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, company?.id]);

  // Load more sales (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!user?.uid || !company?.id || !lastDoc || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      setError(null);

      const q = query(
        collection(db, 'sales'),
        where('companyId', '==', company.id),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(SALES_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const newSales = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sale[];

      if (newSales.length > 0) {
        setSales(prev => {
          const updatedSales = [...prev, ...newSales];
          // Update localStorage with all sales
          SalesManager.save(company.id, updatedSales);
          console.log(`✅ More sales loaded: ${newSales.length} items (total: ${updatedSales.length})`);
          return updatedSales;
        });
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(newSales.length === SALES_PER_PAGE);
      } else {
        setHasMore(false);
        console.log('✅ No more sales to load');
      }
    } catch (err) {
      console.error('❌ Error loading more sales:', err);
      setError(err as Error);
    } finally {
      setLoadingMore(false);
    }
  }, [user?.uid, company?.id, lastDoc, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    setSales([]);
    setLastDoc(null);
    setHasMore(true);
    loadInitialSales();
  }, [loadInitialSales]);

  // Update a specific sale in the list
  const updateSaleInList = useCallback((saleId: string, updatedSale: Sale) => {
    setSales(prev => {
      const updated = prev.map(sale => 
        sale.id === saleId ? { ...updatedSale, id: saleId } : sale
      );
      // Update localStorage with updated sales
      if (company?.id) {
        SalesManager.save(company.id, updated);
      }
      return updated;
    });
  }, [company?.id]);

  // Remove a sale from the list (for deletion)
  const removeSaleFromList = useCallback((saleId: string) => {
    setSales(prev => {
      const filtered = prev.filter(sale => sale.id !== saleId);
      // Update localStorage with filtered sales
      if (company?.id) {
        SalesManager.save(company.id, filtered);
      }
      return filtered;
    });
  }, [company?.id]);

  // Add a new sale to the list (for new sales from POS or elsewhere)
  const addSaleToList = useCallback((newSale: Sale) => {
    setSales(prev => {
      // Check if sale already exists (avoid duplicates)
      const exists = prev.some(sale => sale.id === newSale.id);
      if (exists) {
        // Update existing sale instead
        const updated = prev.map(sale => 
          sale.id === newSale.id ? { ...newSale, id: newSale.id } : sale
        );
        if (company?.id) {
          SalesManager.save(company.id, updated);
        }
        return updated;
      }
      
      // Add new sale at the beginning (most recent first)
      const updated = [newSale, ...prev];
      // Update localStorage with new sales
      if (company?.id) {
        SalesManager.save(company.id, updated);
      }
      return updated;
    });
  }, [company?.id]);

  // Set up real-time subscription for sales updates
  useEffect(() => {
    if (!user?.uid || !company?.id) {
      // Cleanup subscription if user/company changes
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setSales([]);
      setLastDoc(null);
      setHasMore(true);
      setLoading(false);
      setError(null);
      return;
    }

    // Subscribe to real-time sales updates (first page only for performance)
    // This will catch new sales immediately
    const unsubscribe = subscribeToSales(company.id, (freshSales) => {
      // Skip update during initial load to avoid conflicts
      if (isInitialLoadRef.current) {
        return;
      }

      setSales(prev => {
        // Only merge if we have existing data (avoid replacing during initial load)
        if (prev.length === 0) {
          return prev;
        }

        // Merge fresh sales (first page) with existing paginated data
        // Create a map of existing sales by ID to preserve paginated data
        const existingMap = new Map(prev.map(sale => [sale.id, sale]));
        
        // Get IDs of fresh sales (first page only)
        const freshSaleIds = new Set(freshSales.map(sale => sale.id));
        
        // Update or add fresh sales (these are the most recent)
        freshSales.forEach(sale => {
          existingMap.set(sale.id, sale);
        });
        
        // Remove sales that are no longer in the first page but keep paginated ones
        // Only remove if they're not in our existing list (to preserve pagination)
        const merged = Array.from(existingMap.values());
        
        // Sort by createdAt desc to maintain order
        merged.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        
        // Update localStorage
        SalesManager.save(company.id, merged);
        return merged;
      });
      
      setSyncing(false);
    }, SALES_PER_PAGE); // Subscribe to first page for real-time updates

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.uid, company?.id]);

  // Load initial sales
  useEffect(() => {
    if (user?.uid && company?.id) {
      isInitialLoadRef.current = true;
      loadInitialSales().then(() => {
        // Mark initial load as complete after data is loaded
        // This prevents the subscription from interfering with initial load
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 500);
      });
    } else {
      setSales([]);
      setLastDoc(null);
      setHasMore(true);
      setLoading(false);
      setError(null);
      isInitialLoadRef.current = true;
    }
  }, [user?.uid, company?.id, loadInitialSales]);

  return {
    sales,
    loading,
    loadingMore,
    syncing, // Export syncing state
    hasMore,
    error,
    loadMore,
    refresh,
    updateSaleInList,
    removeSaleFromList,
    addSaleToList
  };
};
