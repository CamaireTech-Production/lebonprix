// useExpenseCategories hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { ExpenseType } from '../../types/geskap';
import {
  subscribeToExpenseTypes,
  createExpenseType,
  updateExpenseType,
  deleteExpenseType,
  getExpenseCountByCategory
} from '../../services/firestore/expenses';

interface UseExpenseCategoriesOptions {
  restaurantId: string;
}

interface UseExpenseCategoriesReturn {
  categories: ExpenseType[];
  categoryUsageCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
  addCategory: (name: string) => Promise<ExpenseType>;
  updateCategory: (categoryId: string, name: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  refreshCounts: () => Promise<void>;
}

export const useExpenseCategories = ({
  restaurantId
}: UseExpenseCategoriesOptions): UseExpenseCategoriesReturn => {
  const [categories, setCategories] = useState<ExpenseType[]>([]);
  const [categoryUsageCounts, setCategoryUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch category usage counts
  const fetchCounts = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const counts = await getExpenseCountByCategory(restaurantId);
      setCategoryUsageCounts(counts);
    } catch (err) {
      console.error('Error fetching category counts:', err);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToExpenseTypes(restaurantId, (data) => {
      setCategories(data);
      setLoading(false);
      // Fetch counts when categories load
      fetchCounts();
    });

    return () => unsubscribe();
  }, [restaurantId, fetchCounts]);

  const handleAddCategory = useCallback(
    async (name: string) => {
      try {
        const newCategory = await createExpenseType(restaurantId, name);
        // Refresh counts after adding
        await fetchCounts();
        return newCategory;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, fetchCounts]
  );

  const handleUpdateCategory = useCallback(
    async (categoryId: string, name: string) => {
      try {
        await updateExpenseType(restaurantId, categoryId, { name });
        // Refresh counts after updating
        await fetchCounts();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, fetchCounts]
  );

  const handleDeleteCategory = useCallback(
    async (categoryId: string) => {
      try {
        await deleteExpenseType(restaurantId, categoryId);
        // Refresh counts after deleting
        await fetchCounts();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, fetchCounts]
  );

  return {
    categories,
    categoryUsageCounts,
    loading,
    error,
    addCategory: handleAddCategory,
    updateCategory: handleUpdateCategory,
    deleteCategory: handleDeleteCategory,
    refreshCounts: fetchCounts
  };
};
