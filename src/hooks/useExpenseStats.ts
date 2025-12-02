// src/hooks/useExpenseStats.ts
import { useMemo } from 'react';
import { 
  filterExpenses, 
  calculateExpenseStats,
  type ExpenseStats,
  type ExpenseFilterOptions 
} from '../utils/expenseCalculations';
import type { Expense } from '../types/models';

// Re-export types for backward compatibility
export type { ExpenseStats, ExpenseFilterOptions };

export const useExpenseStats = (
  expenses: Expense[],
  filters?: ExpenseFilterOptions
): ExpenseStats => {
  return useMemo(() => {
    // Filter expenses using pure function
    const filteredExpenses = filterExpenses(expenses, filters);
    
    // Calculate stats using pure function
    return calculateExpenseStats(filteredExpenses);
  }, [expenses, filters]);
};

