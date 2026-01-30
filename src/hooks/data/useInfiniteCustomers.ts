// src/hooks/useInfiniteCustomers.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { query, collection, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import SalesManager from '@services/storage/SalesManager';
import { useSales } from '@hooks/data/useFirestore';
import { sharedSubscriptions } from '@services/firestore/sharedSubscriptions';
import { normalizePhoneForComparison } from '@utils/core/phoneUtils';
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
  const [paginatedCustomers, setPaginatedCustomers] = useState<Customer[]>([]); // For pagination beyond first page
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [sortBy, setSortBy] = useState<'purchases' | 'name' | 'date'>('purchases');
  const isInitialLoadRef = useRef(true);

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

  // Load initial customers (for pagination beyond first page)
  const loadInitialCustomers = useCallback(async () => {
    if (!user?.uid || !company?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

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

      setPaginatedCustomers(customersData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === CUSTOMERS_PER_PAGE);
    } catch (err) {
      console.error('Error loading initial customers:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
      isInitialLoadRef.current = false;
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

      setPaginatedCustomers(prev => [...prev, ...customersData]);
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
    setPaginatedCustomers([]);
    setLastDoc(null);
    setHasMore(true);
    isInitialLoadRef.current = true;
    await loadInitialCustomers();
  }, [loadInitialCustomers]);

  // Load sales from cache when company changes
  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Set up real-time subscription for customers
  useEffect(() => {
    if (!user?.uid || !company?.id) {
      setCustomers([]);
      setPaginatedCustomers([]);
      setLoading(false);
      return;
    }

    // Initialize shared subscription
    sharedSubscriptions.initializeCustomers(company.id);

    // Subscribe to updates from shared subscription
    const unsubscribe = sharedSubscriptions.subscribeToCustomers((data: Customer[]) => {
      // Skip update during initial load to avoid conflicts
      if (isInitialLoadRef.current) {
        return;
      }

      // Merge subscription data (first page) with paginated data
      const subscriptionIds = new Set(data.map(c => c.id));
      const paginatedOnly = paginatedCustomers.filter(c => !subscriptionIds.has(c.id));
      setCustomers([...data, ...paginatedOnly]);
    });

    return () => unsubscribe();
  }, [user?.uid, company?.id, paginatedCustomers]);

  // Load on mount
  useEffect(() => {
    loadInitialCustomers();
  }, [loadInitialCustomers]);

  // Merge subscription customers with paginated customers
  useEffect(() => {
    if (isInitialLoadRef.current) return;

    // Get current subscription data
    const state = sharedSubscriptions.getCustomersState();
    if (state.data.length > 0) {
      const subscriptionIds = new Set(state.data.map(c => c.id));
      const paginatedOnly = paginatedCustomers.filter(c => !subscriptionIds.has(c.id));
      setCustomers([...state.data, ...paginatedOnly]);
    } else {
      // Fallback to paginated if no subscription data yet
      setCustomers(paginatedCustomers);
    }
  }, [paginatedCustomers]);

  // Count purchases per customer and sort
  const customersWithPurchaseCount = useMemo(() => {
    // Count purchases by phone number and by name
    // Use maps with normalized keys for accurate matching
    const purchaseCountMapByPhone: Record<string, number> = {};
    const purchaseCountMapByName: Record<string, number> = {};
    const purchaseCountMapByPhoneAndName: Record<string, Record<string, number>> = {}; // For exact phone+name matches
    
    sales.forEach(sale => {
      const phone = sale.customerInfo?.phone?.trim();
      const name = sale.customerInfo?.name?.trim().toLowerCase();
      
      if (phone) {
        // Use proper phone normalization for comparison
        const normalizedPhone = normalizePhoneForComparison(phone);
        if (normalizedPhone) {
          purchaseCountMapByPhone[normalizedPhone] = (purchaseCountMapByPhone[normalizedPhone] || 0) + 1;
          
          // Also track by phone+name combination for more accurate matching
          if (name) {
            if (!purchaseCountMapByPhoneAndName[normalizedPhone]) {
              purchaseCountMapByPhoneAndName[normalizedPhone] = {};
            }
            purchaseCountMapByPhoneAndName[normalizedPhone][name] = 
              (purchaseCountMapByPhoneAndName[normalizedPhone][name] || 0) + 1;
          }
        }
      }
      
      // Always count by name as well (for customers without phone or as fallback)
      if (name) {
        purchaseCountMapByName[name] = (purchaseCountMapByName[name] || 0) + 1;
      }
    });

    // Add purchase count to customers
    const customersWithCount: CustomerWithPurchaseCount[] = customers.map(customer => {
      const customerPhone = customer.phone?.trim() || '';
      const customerNormalizedPhone = customerPhone ? normalizePhoneForComparison(customerPhone) : '';
      const customerName = customer.name?.trim().toLowerCase() || '';
      
      let purchaseCount = 0;
      
      // Priority 1: Match by phone (most accurate)
      if (customerNormalizedPhone) {
        purchaseCount = purchaseCountMapByPhone[customerNormalizedPhone] || 0;
        
        // If phone matches but we want to be more precise, also check name match
        // This helps when same phone has different names (should still count)
        // For now, we count all sales with matching phone regardless of name
      }
      
      // Priority 2: If no phone match and customer has no phone, match by name
      if (purchaseCount === 0 && !customerNormalizedPhone && customerName) {
        purchaseCount = purchaseCountMapByName[customerName] || 0;
      }
      
      // Priority 3: If phone doesn't match but name does, use name as fallback
      // This handles cases where phone format differs but name matches
      if (purchaseCount === 0 && customerNormalizedPhone && customerName) {
        // Check if there are sales with this name (even if phone doesn't match)
        // But only if the customer's phone doesn't match any sales
        const nameCount = purchaseCountMapByName[customerName] || 0;
        // Only use name count if it's the same customer (name match is less reliable)
        // For now, we prioritize phone matching, so we don't use this fallback
        // to avoid double counting
      }
      
      return {
        ...customer,
        purchaseCount
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

