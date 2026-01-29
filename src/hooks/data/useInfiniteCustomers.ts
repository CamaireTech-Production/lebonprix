// src/hooks/useInfiniteCustomers.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { query, collection, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import SalesManager from '@services/storage/SalesManager';
import { useSales } from '@hooks/data/useFirestore';
import type { Customer, Sale } from '@types/models';

export interface CustomerWithPurchaseCount extends Customer {
  purchaseCount: number;
}

interface UseInfiniteCustomersReturn {
  customers: CustomerWithPurchaseCount[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  refresh: () => void;
  sortBy: 'purchases' | 'name' | 'date';
  setSortBy: (sort: 'purchases' | 'name' | 'date') => void;
}

const CUSTOMERS_PER_PAGE = 20;

export const useInfiniteCustomers = (): UseInfiniteCustomersReturn => {
  const { user, company } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [sortBy, setSortBy] = useState<'purchases' | 'name' | 'date'>('purchases');

  // OPTIMIZATION: Use cached sales from SalesManager instead of querying Firestore
  // This reduces Firebase reads from thousands to zero (uses localStorage cache)
  // Also use useSales() hook to ensure cache stays fresh with real-time updates
  const { sales: realtimeSales } = useSales();

  // Load sales from cache (instant, no Firebase reads)
  const loadSales = useCallback(() => {
    if (!company?.id) return;

    // 1. Try to load from localStorage cache first (instant, no Firebase reads)
    const cachedSales = SalesManager.load(company.id);
    if (cachedSales && cachedSales.length > 0) {
      // Filter out deleted sales
      const validSales = cachedSales.filter(sale => !(sale as any).isDeleted && sale.isAvailable !== false);
      setSales(validSales);
      return;
    }

    // 2. If no cache, use real-time sales from useSales() hook
    // This will sync in background and update cache automatically
    if (realtimeSales && realtimeSales.length > 0) {
      const validSales = realtimeSales.filter(sale => !(sale as any).isDeleted && sale.isAvailable !== false);
      setSales(validSales);
    }
  }, [company?.id, realtimeSales]);

  // Load initial customers
  const loadInitialCustomers = useCallback(async () => {
    if (!user?.uid || !company?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Sales are loaded from cache via useEffect (no await needed - instant from localStorage)

      const q = query(
        collection(db, 'customers'),
        where('companyId', '==', company.id),
        orderBy('createdAt', 'desc'),
        limit(CUSTOMERS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];

      setCustomers(customersData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === CUSTOMERS_PER_PAGE);
    } catch (err) {
      console.error('Error loading initial customers:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, company?.id]);

  // Load more customers (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!user?.uid || !company?.id || !lastDoc || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      setError(null);

      const q = query(
        collection(db, 'customers'),
        where('companyId', '==', company.id),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(CUSTOMERS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const customersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];

      setCustomers(prev => [...prev, ...customersData]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === CUSTOMERS_PER_PAGE);
    } catch (err) {
      console.error('Error loading more customers:', err);
      setError(err as Error);
    } finally {
      setLoadingMore(false);
    }
  }, [user?.uid, company?.id, lastDoc, loadingMore, hasMore]);

  // Refresh customers
  const refresh = useCallback(async () => {
    setCustomers([]);
    setLastDoc(null);
    setHasMore(true);
    await loadInitialCustomers();
  }, [loadInitialCustomers]);

  // Load sales from cache when company changes
  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Load on mount
  useEffect(() => {
    loadInitialCustomers();
  }, [loadInitialCustomers]);

  // Count purchases per customer and sort
  const customersWithPurchaseCount = useMemo(() => {
    // Count purchases by phone number
    const purchaseCountMap: Record<string, number> = {};
    sales.forEach(sale => {
      const phone = sale.customerInfo?.phone;
      if (phone) {
        // Normalize phone number (remove spaces, +, etc.)
        const normalizedPhone = phone.replace(/\s+/g, '').replace(/\+/g, '');
        purchaseCountMap[normalizedPhone] = (purchaseCountMap[normalizedPhone] || 0) + 1;
      }
    });

    // Add purchase count to customers
    const customersWithCount: CustomerWithPurchaseCount[] = customers.map(customer => {
      const normalizedPhone = customer.phone?.replace(/\s+/g, '').replace(/\+/g, '') || '';
      return {
        ...customer,
        purchaseCount: purchaseCountMap[normalizedPhone] || 0
      };
    });

    // Sort based on selected sort option
    return customersWithCount.sort((a, b) => {
      if (sortBy === 'purchases') {
        return b.purchaseCount - a.purchaseCount; // Descending
      } else if (sortBy === 'name') {
        const nameA = (a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.name || '').toLowerCase();
        const nameB = (b.firstName && b.lastName ? `${b.firstName} ${b.lastName}` : b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      } else { // date
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.seconds || 0;
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.seconds || 0;
        return dateB - dateA; // Descending (newest first)
      }
    });
  }, [customers, sales, sortBy]);

  return {
    customers: customersWithPurchaseCount,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    sortBy,
    setSortBy
  };
};

