// useFinance hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { FinanceEntry, FinanceSourceType } from '../../types/geskap';
import {
  subscribeToFinanceEntries,
  subscribeToFinanceEntriesByType,
  createFinanceEntry,
  updateFinanceEntry,
  softDeleteFinanceEntry,
  getFinanceEntriesByDateRange,
  calculateFinanceSummary,
  calculateDailyRevenue,
  calculateMonthlyRevenue
} from '../../services/firestore/finance';

interface UseFinanceOptions {
  restaurantId: string;
  userId: string;
  sourceTypeFilter?: FinanceSourceType;
  limitCount?: number;
}

interface UseFinanceReturn {
  entries: FinanceEntry[];
  loading: boolean;
  error: string | null;
  createEntry: (entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<FinanceEntry>;
  updateEntry: (entryId: string, updates: Partial<FinanceEntry>) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  getEntriesByDateRange: (startDate: Date, endDate: Date) => Promise<FinanceEntry[]>;
  getSummary: (startDate: Date, endDate: Date) => Promise<{
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    byType: Record<string, number>;
  }>;
  getDailyRevenue: (date: Date) => Promise<number>;
  getMonthlyRevenue: (year: number, month: number) => Promise<{
    revenue: number;
    expenses: number;
    profit: number;
  }>;
}

export const useFinance = ({
  restaurantId,
  userId,
  sourceTypeFilter,
  limitCount = 100
}: UseFinanceOptions): UseFinanceReturn => {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubscribe: () => void;

    if (sourceTypeFilter) {
      unsubscribe = subscribeToFinanceEntriesByType(restaurantId, sourceTypeFilter, (data) => {
        setEntries(data);
        setLoading(false);
      });
    } else {
      unsubscribe = subscribeToFinanceEntries(restaurantId, (data) => {
        setEntries(data);
        setLoading(false);
      }, limitCount);
    }

    return () => unsubscribe();
  }, [restaurantId, sourceTypeFilter, limitCount]);

  const handleCreateEntry = useCallback(
    async (entry: Omit<FinanceEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        return await createFinanceEntry({ ...entry, userId, restaurantId });
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId]
  );

  const handleUpdateEntry = useCallback(
    async (entryId: string, updates: Partial<FinanceEntry>) => {
      try {
        await updateFinanceEntry(restaurantId, entryId, updates);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteEntry = useCallback(
    async (entryId: string) => {
      try {
        await softDeleteFinanceEntry(restaurantId, entryId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetEntriesByDateRange = useCallback(
    async (startDate: Date, endDate: Date) => {
      try {
        return await getFinanceEntriesByDateRange(restaurantId, startDate, endDate);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetSummary = useCallback(
    async (startDate: Date, endDate: Date) => {
      try {
        return await calculateFinanceSummary(restaurantId, startDate, endDate);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetDailyRevenue = useCallback(
    async (date: Date) => {
      try {
        return await calculateDailyRevenue(restaurantId, date);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetMonthlyRevenue = useCallback(
    async (year: number, month: number) => {
      try {
        return await calculateMonthlyRevenue(restaurantId, year, month);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  return {
    entries,
    loading,
    error,
    createEntry: handleCreateEntry,
    updateEntry: handleUpdateEntry,
    deleteEntry: handleDeleteEntry,
    getEntriesByDateRange: handleGetEntriesByDateRange,
    getSummary: handleGetSummary,
    getDailyRevenue: handleGetDailyRevenue,
    getMonthlyRevenue: handleGetMonthlyRevenue
  };
};
