// src/hooks/useInfiniteCustomers.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { query, collection, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Customer, Sale } from '../types/models';

interface CustomerWithPurchaseCount extends Customer {
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

  // Load sales to count purchases per customer
  const loadSales = useCallback(async () => {
    if (!company?.id) return;

    try {
      const salesQuery = query(
        collection(db, 'sales'),
        where('companyId', '==', company.id)
      );
      const salesSnapshot = await getDocs(salesQuery);
      const salesData = salesSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(sale => sale.isAvailable !== false) as Sale[];
      setSales(salesData);
    } catch (err) {
      console.error('Error loading sales for customer count:', err);
    }
  }, [company?.id]);

  // Load initial customers
  const loadInitialCustomers = useCallback(async () => {
    if (!user?.uid || !company?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load sales first to count purchases
      await loadSales();

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
  }, [user?.uid, company?.id, loadSales]);

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

