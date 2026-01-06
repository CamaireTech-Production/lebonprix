// src/hooks/useInfiniteSales.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { query, collection, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import SalesManager from '../services/storage/SalesManager';
import BackgroundSyncService from '../services/backgroundSync';
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
}

const SALES_PER_PAGE = 20;

export const useInfiniteSales = (dateRange?: { from: Date; to: Date } | null): UseInfiniteSalesReturn => {
  const { user, company } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false); // Start as false
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false); // Add syncing state
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  // Load initial sales
  const loadInitialSales = useCallback(async () => {
    if (!user?.uid || !company?.id) {
      setLoading(false);
      return;
    }

    // Validate dateRange if provided
    if (dateRange && dateRange.from > dateRange.to) {
      setError(new Error('Invalid date range: start date must be before end date'));
      setLoading(false);
      return;
    }

    // Skip localStorage cache when dateRange is active (simpler approach)
    // This ensures we always get fresh filtered data
    const useCache = !dateRange;

    // 1. Check localStorage FIRST - only if no dateRange filter
    if (useCache) {
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
    }

    try {
      setLoading(true); // Only show loading spinner if no cached data
      setError(null);
      console.log('📡 Loading sales from Firebase...', dateRange ? `(filtered: ${dateRange.from.toISOString()} to ${dateRange.to.toISOString()})` : '');

      // Build query with optional date range filters
      const queryConstraints: any[] = [
        collection(db, 'sales'),
        where('companyId', '==', company.id),
      ];

      // Add date range filters if provided
      if (dateRange) {
        const startTimestamp = Timestamp.fromDate(dateRange.from);
        const endTimestamp = Timestamp.fromDate(dateRange.to);
        queryConstraints.push(where('createdAt', '>=', startTimestamp));
        queryConstraints.push(where('createdAt', '<=', endTimestamp));
      }

      // Add ordering and limit (must come after where clauses)
      queryConstraints.push(orderBy('createdAt', 'desc'));
      queryConstraints.push(limit(SALES_PER_PAGE));

      const q = query(...queryConstraints);

      const snapshot = await getDocs(q);
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sale[];

      // Filter out sales with missing createdAt (shouldn't happen, but safety check)
      const validSales = salesData.filter(sale => sale.createdAt?.seconds);

      setSales(validSales);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === SALES_PER_PAGE);
      
      // Save to localStorage only if no dateRange filter (for future instant loads)
      if (useCache) {
        SalesManager.save(company.id, validSales);
      }
      console.log(`✅ Initial sales loaded${dateRange ? ' (filtered)' : ''}: ${validSales.length} items`);
    } catch (err) {
      console.error('❌ Error loading initial sales:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, company?.id, dateRange]);

  // Load more sales (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!user?.uid || !company?.id || !lastDoc || loadingMore || !hasMore) return;

    // Validate dateRange if provided
    if (dateRange && dateRange.from > dateRange.to) {
      setError(new Error('Invalid date range: start date must be before end date'));
      return;
    }

    try {
      setLoadingMore(true);
      setError(null);

      // Build query with optional date range filters
      const queryConstraints: any[] = [
        collection(db, 'sales'),
        where('companyId', '==', company.id),
      ];

      // Add date range filters if provided
      if (dateRange) {
        const startTimestamp = Timestamp.fromDate(dateRange.from);
        const endTimestamp = Timestamp.fromDate(dateRange.to);
        queryConstraints.push(where('createdAt', '>=', startTimestamp));
        queryConstraints.push(where('createdAt', '<=', endTimestamp));
      }

      // Add ordering, pagination, and limit (must come after where clauses)
      queryConstraints.push(orderBy('createdAt', 'desc'));
      queryConstraints.push(startAfter(lastDoc));
      queryConstraints.push(limit(SALES_PER_PAGE));

      const q = query(...queryConstraints);

      const snapshot = await getDocs(q);
      const newSales = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sale[];

      // Filter out sales with missing createdAt
      const validNewSales = newSales.filter(sale => sale.createdAt?.seconds);

      if (validNewSales.length > 0) {
        setSales(prev => {
          const updatedSales = [...prev, ...validNewSales];
          // Update localStorage only if no dateRange filter
          if (!dateRange) {
            SalesManager.save(company.id, updatedSales);
          }
          console.log(`✅ More sales loaded${dateRange ? ' (filtered)' : ''}: ${validNewSales.length} items (total: ${updatedSales.length})`);
          return updatedSales;
        });
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(validNewSales.length === SALES_PER_PAGE);
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
  }, [user?.uid, company?.id, lastDoc, loadingMore, hasMore, dateRange]);

  const refresh = useCallback(() => {
    setSales([]);
    setLastDoc(null);
    setHasMore(true);
    setError(null);
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

  useEffect(() => {
    if (user?.uid && company?.id) {
      // Reset pagination when dateRange changes
      setSales([]);
      setLastDoc(null);
      setHasMore(true);
      setError(null);
      loadInitialSales();
    } else {
      setSales([]);
      setLastDoc(null);
      setHasMore(true);
      setLoading(false);
      setError(null);
    }
  }, [user?.uid, company?.id, dateRange, loadInitialSales]);

  return {
    sales,
    loading,
    loadingMore,
    syncing, // Export syncing state
    hasMore,
    error,
    loadMore,
    refresh,
    updateSaleInList
  };
};
