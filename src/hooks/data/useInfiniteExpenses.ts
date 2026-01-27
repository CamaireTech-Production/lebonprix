// src/hooks/useInfiniteExpenses.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { query, collection, where, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@services/core/firebase';
import { subscribeToExpenses } from '@services/firestore/expenses/expenseService';
import ExpensesManager from '@services/storage/ExpensesManager';
import BackgroundSyncService from '@services/utilities/backgroundSync';
import type { Expense } from '../../types/models';

interface UseInfiniteExpensesReturn {
  expenses: Expense[];
  loading: boolean;
  loadingMore: boolean;
  syncing: boolean; // Add syncing state
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  refresh: () => void;
  addExpense: (expense: Expense) => void; // Add function to manually add expense
  removeExpense: (expenseId: string) => void; // Add function to manually remove expense
  updateExpense: (expenseId: string, updatedExpense: Expense) => void; // Add function to manually update expense
}

const EXPENSES_PER_PAGE = 20;

export const useInfiniteExpenses = (): UseInfiniteExpensesReturn => {
  const { user, company } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false); // Start as false
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false); // Add syncing state
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const subscriptionUnsubscribeRef = useRef<(() => void) | null>(null);
  const paginatedExpensesRef = useRef<Expense[]>([]); // Track expenses loaded via pagination
  const isInitialLoadRef = useRef(true);

  // Load initial expenses
  const loadInitialExpenses = useCallback(async () => {
    if (!user?.uid || !company?.id) {
      setLoading(false);
      return;
    }

    // 1. Check localStorage FIRST - instant display if data exists
    const localExpenses = ExpensesManager.load(company.id);
    if (localExpenses && localExpenses.length > 0) {
      setExpenses(localExpenses);
      setLoading(false); // No loading spinner - data is available
      setSyncing(true); // Show background sync indicator
      console.log('🚀 Expenses loaded instantly from localStorage');
      
      // Start background sync
      BackgroundSyncService.syncExpenses(company.id, (freshExpenses) => {
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
        where('companyId', '==', company.id),
        where('isAvailable', '!=', false),
        orderBy('createdAt', 'desc'),
        limit(EXPENSES_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];

      // Store paginated expenses separately (for merging with real-time updates)
      paginatedExpensesRef.current = expensesData;
      
      // Note: Real-time subscription will update the expenses state
      // We only set initial state if subscription hasn't kicked in yet
      if (isInitialLoadRef.current) {
        setExpenses(expensesData);
        isInitialLoadRef.current = false;
      }
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === EXPENSES_PER_PAGE);
      
      // Save to localStorage for future instant loads
      ExpensesManager.save(company.id, expensesData);
      console.log(`✅ Initial expenses loaded and cached: ${expensesData.length} items`);
    } catch (err) {
      console.error('❌ Error loading initial expenses:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, company?.id]);

  // Load more expenses (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!user?.uid || !company?.id || !lastDoc || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      setError(null);

      const q = query(
        collection(db, 'expenses'),
        where('companyId', '==', company.id),
        where('isAvailable', '!=', false),
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
        // Add to paginated expenses ref
        paginatedExpensesRef.current = [...paginatedExpensesRef.current, ...newExpenses];
        
        setExpenses(prev => {
          // Merge with existing expenses, avoiding duplicates
          const existingIds = new Set(prev.map(e => e.id));
          const uniqueNewExpenses = newExpenses.filter(e => !existingIds.has(e.id));
          const updatedExpenses = [...prev, ...uniqueNewExpenses].sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime; // Descending order
          });
          
          // Update localStorage with all expenses
          ExpensesManager.save(company.id, updatedExpenses);
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
  }, [user?.uid, company?.id, lastDoc, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    setExpenses([]);
    setLastDoc(null);
    setHasMore(true);
    paginatedExpensesRef.current = [];
    isInitialLoadRef.current = true;
    loadInitialExpenses();
  }, [loadInitialExpenses]);

  // Function to manually add an expense to the local state
  // Note: This is mainly for optimistic updates. The real-time subscription will handle the actual update.
  const addExpense = useCallback((newExpense: Expense) => {
    if (!user?.uid || !company?.id || !newExpense.id) return;
    
    setExpenses(prev => {
      // Check if expense already exists to avoid duplicates
      const exists = prev.some(exp => exp.id === newExpense.id);
      if (exists) {
        console.log('⚠️ Expense already exists, skipping manual add (subscription will handle it)');
        return prev;
      }
      
      // Add the new expense at the beginning (most recent first)
      const updatedExpenses = [newExpense, ...prev];
      // Update localStorage with the new expense
      ExpensesManager.save(company.id, updatedExpenses);
      return updatedExpenses;
    });
  }, [user?.uid, company?.id]);

  // Function to manually remove an expense from the local state
  const removeExpense = useCallback((expenseId: string) => {
    if (!user?.uid || !company?.id) return;
    
    setExpenses(prev => {
      // Remove the expense with the given ID
      const updatedExpenses = prev.filter(expense => expense.id !== expenseId);
      // Update localStorage with the updated expenses
      ExpensesManager.save(company.id, updatedExpenses);
      return updatedExpenses;
    });
  }, [user?.uid, company?.id]);

  // Function to manually update an expense in the local state
  const updateExpense = useCallback((expenseId: string, updatedExpense: Expense) => {
    if (!user?.uid || !company?.id) return;
    
    setExpenses(prev => {
      // Update the expense with the given ID
      const updatedExpenses = prev.map(expense => 
        expense.id === expenseId ? updatedExpense : expense
      );
      // Update localStorage with the updated expenses immediately
      ExpensesManager.save(company.id, updatedExpenses);
      return updatedExpenses;
    });
  }, [user?.uid, company?.id]);

  // Real-time subscription effect
  useEffect(() => {
    if (!user?.uid || !company?.id) {
      // Cleanup subscription if user/company changes
      if (subscriptionUnsubscribeRef.current) {
        subscriptionUnsubscribeRef.current();
        subscriptionUnsubscribeRef.current = null;
      }
      return;
    }

    // Set up real-time subscription
    console.log('📡 Setting up real-time subscription for expenses');
    const unsubscribe = subscribeToExpenses(company.id, (realTimeExpenses) => {
      console.log('🔄 Real-time update received:', realTimeExpenses.length, 'expenses');
      
      setExpenses(prevExpenses => {
        // Create a map of expenses by ID for quick lookup and deduplication
        const expenseMap = new Map<string, Expense>();
        
        // First, add all real-time expenses (first 100 from subscription)
        // These are the source of truth from Firestore - subscription data takes priority
        realTimeExpenses.forEach(exp => {
          expenseMap.set(exp.id, exp);
        });
        
        // Then, add paginated expenses that are beyond the subscription limit
        // Only include expenses that are not in the real-time list
        paginatedExpensesRef.current.forEach(exp => {
          if (!expenseMap.has(exp.id)) {
            expenseMap.set(exp.id, exp);
          }
        });
        
        // Convert map back to array and sort by createdAt (most recent first)
        // Using Map ensures no duplicates - subscription data is source of truth
        const mergedExpenses = Array.from(expenseMap.values()).sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime; // Descending order
        });
        
        // Update localStorage
        ExpensesManager.save(company.id, mergedExpenses);
        
        return mergedExpenses;
      });
      
      setSyncing(false);
      setLoading(false);
    });
    
    subscriptionUnsubscribeRef.current = unsubscribe;
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (subscriptionUnsubscribeRef.current) {
        subscriptionUnsubscribeRef.current();
        subscriptionUnsubscribeRef.current = null;
      }
    };
  }, [user?.uid, company?.id]);

  // Initial load effect
  useEffect(() => {
    if (user?.uid && company?.id) {
      isInitialLoadRef.current = true;
      loadInitialExpenses();
    } else {
      setExpenses([]);
      setLastDoc(null);
      setHasMore(true);
      setLoading(false);
      setError(null);
      paginatedExpensesRef.current = [];
    }
  }, [user?.uid, company?.id, loadInitialExpenses]);

  return {
    expenses,
    loading,
    loadingMore,
    syncing, // Export syncing state
    hasMore,
    error,
    loadMore,
    refresh,
    addExpense,
    removeExpense,
    updateExpense
  };
};
