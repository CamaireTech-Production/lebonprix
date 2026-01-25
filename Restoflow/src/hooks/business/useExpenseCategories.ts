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
  loading: boolean;
  error: string | null;
  addCategory: (name: string) => Promise<ExpenseType>;
  updateCategory: (categoryId: string, updates: Partial<ExpenseType>) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  getCategoryCounts: () => Promise<Record<string, number>>;
}

export const useExpenseCategories = ({
  restaurantId
}: UseExpenseCategoriesOptions): UseExpenseCategoriesReturn => {
  const [categories, setCategories] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    });

    return () => unsubscribe();
  }, [restaurantId]);

  const handleAddCategory = useCallback(
    async (name: string) => {
      try {
        return await createExpenseType(restaurantId, name);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleUpdateCategory = useCallback(
    async (categoryId: string, updates: Partial<ExpenseType>) => {
      try {
        await updateExpenseType(restaurantId, categoryId, updates);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteCategory = useCallback(
    async (categoryId: string) => {
      try {
        await deleteExpenseType(restaurantId, categoryId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleGetCategoryCounts = useCallback(async () => {
    try {
      return await getExpenseCountByCategory(restaurantId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [restaurantId]);

  return {
    categories,
    loading,
    error,
    addCategory: handleAddCategory,
    updateCategory: handleUpdateCategory,
    deleteCategory: handleDeleteCategory,
    getCategoryCounts: handleGetCategoryCounts
  };
};
