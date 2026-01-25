// useExpenses hook for Restoflow
import { useState, useEffect, useCallback } from 'react';
import type { Expense, EmployeeRef } from '../../types/geskap';
import {
  subscribeToExpenses,
  createExpense,
  updateExpense,
  softDeleteExpense,
  softDeleteExpenseWithImage
} from '../../services/firestore/expenses';

interface UseExpensesOptions {
  restaurantId: string;
  userId: string;
  createdBy?: EmployeeRef | null;
}

interface UseExpensesReturn {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  addExpense: (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Expense>;
  updateExpense: (expenseId: string, data: Partial<Expense>) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  deleteExpenseWithImage: (expense: Expense) => Promise<void>;
}

export const useExpenses = ({
  restaurantId,
  userId,
  createdBy
}: UseExpensesOptions): UseExpensesReturn => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToExpenses(restaurantId, (data) => {
      setExpenses(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  const handleAddExpense = useCallback(
    async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        return await createExpense({ ...data, userId, restaurantId }, restaurantId, createdBy);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId, userId, createdBy]
  );

  const handleUpdateExpense = useCallback(
    async (expenseId: string, data: Partial<Expense>) => {
      try {
        await updateExpense(expenseId, data, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteExpense = useCallback(
    async (expenseId: string) => {
      try {
        await softDeleteExpense(expenseId, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  const handleDeleteExpenseWithImage = useCallback(
    async (expense: Expense) => {
      try {
        await softDeleteExpenseWithImage(expense, restaurantId);
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [restaurantId]
  );

  return {
    expenses,
    loading,
    error,
    addExpense: handleAddExpense,
    updateExpense: handleUpdateExpense,
    deleteExpense: handleDeleteExpense,
    deleteExpenseWithImage: handleDeleteExpenseWithImage
  };
};
