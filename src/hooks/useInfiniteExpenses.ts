// src/hooks/useInfiniteExpenses.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { query, collection, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import ExpensesManager from '../services/storage/ExpensesManager';
import BackgroundSyncService from '../services/backgroundSync';
import type { Expense } from '../types/models';

interface UseInfiniteExpensesReturn {
  expenses: Expense[];
  loading: boolean;
  loadingMore: boolean;
  syncing: boolean; // Add syncing state
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  refresh: () => void;
}

const EXPENSES_PER_PAGE = 20;

export const useInfiniteExpenses = (): UseInfiniteExpensesReturn => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false); // Start as false
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false); // Add syncing state
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  // Load initial expenses
  const loadInitialExpenses = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // 1. Check localStorage FIRST - instant display if data exists
    const localExpenses = ExpensesManager.load(user.uid);
    if (localExpenses && localExpenses.length > 0) {
      setExpenses(localExpenses);
      setLoading(false); // No loading spinner - data is available
      setSyncing(true); // Show background sync indicator
      console.log('🚀 Expenses loaded instantly from localStorage');
      
      // Start background sync
      BackgroundSyncService.syncExpenses(user.uid, (freshExpenses) => {
        setExpenses(freshExpenses);
        setSyncing(false); // Hide background sync indicator
        console.log('🔄 Expenses updated from background sync');
      });
      return;
    }

    try {
      setLoading(true); // Only show loading spinner if no cached data
      setError(null);
      console.log('📡 No cached expenses, loading from Firebase...');

      const q = query(
        collection(db, 'expenses'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(EXPENSES_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];

      setExpenses(expensesData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === EXPENSES_PER_PAGE);
      
      // Save to localStorage for future instant loads
      ExpensesManager.save(user.uid, expensesData);
      console.log(`✅ Initial expenses loaded and cached: ${expensesData.length} items`);
    } catch (err) {
      console.error('❌ Error loading initial expenses:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Load more expenses (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!user?.uid || !lastDoc || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      setError(null);

      const q = query(
        collection(db, 'expenses'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(EXPENSES_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const newExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];

      if (newExpenses.length > 0) {
        setExpenses(prev => {
          const updatedExpenses = [...prev, ...newExpenses];
          // Update localStorage with all expenses
          ExpensesManager.save(user.uid, updatedExpenses);
          console.log(`✅ More expenses loaded: ${newExpenses.length} items (total: ${updatedExpenses.length})`);
          return updatedExpenses;
        });
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(newExpenses.length === EXPENSES_PER_PAGE);
      } else {
        setHasMore(false);
        console.log('✅ No more expenses to load');
      }
    } catch (err) {
      console.error('❌ Error loading more expenses:', err);
      setError(err as Error);
    } finally {
      setLoadingMore(false);
    }
  }, [user?.uid, lastDoc, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    setExpenses([]);
    setLastDoc(null);
    setHasMore(true);
    loadInitialExpenses();
  }, [loadInitialExpenses]);

  useEffect(() => {
    if (user?.uid) {
      loadInitialExpenses();
    } else {
      setExpenses([]);
      setLastDoc(null);
      setHasMore(true);
      setLoading(false);
      setError(null);
    }
  }, [user?.uid, loadInitialExpenses]);

  return {
    expenses,
    loading,
    loadingMore,
    syncing, // Export syncing state
    hasMore,
    error,
    loadMore,
    refresh
  };
};
