// src/utils/expenseCalculations.ts
// Pure functions for expense calculations and filtering
// Extracted from useExpenseStats hook for better testability

import type { Expense } from '../types/models';

export interface ExpenseFilterOptions {
  category?: string;
  searchQuery?: string;
  dateRange?: { from: Date; to: Date };
  minAmount?: number;
  maxAmount?: number;
}

export interface ExpenseStats {
  summaryStats: Record<string, number>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  totalAmount: number;
  totalCount: number;
  averageAmount: number;
}

/**
 * Filter expenses based on provided filter options
 * @param expenses - Array of expenses to filter
 * @param filters - Filter options (category, search, date range, amount range)
 * @returns Filtered array of expenses
 */
export const filterExpenses = (
  expenses: Expense[],
  filters?: ExpenseFilterOptions
): Expense[] => {
  // First, exclude expenses with isAvailable === false
  let filteredExpenses = expenses.filter(exp => exp.isAvailable !== false);
  
  if (!filters) {
    return filteredExpenses;
  }
  
  // Filter by category
  if (filters.category && filters.category !== 'All') {
    filteredExpenses = filteredExpenses.filter(exp => exp.category === filters.category);
  }
  
  // Filter by search query (description, case-insensitive)
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredExpenses = filteredExpenses.filter(exp =>
      exp.description.toLowerCase().includes(query)
    );
  }
  
  // Filter by date range
  if (filters.dateRange) {
    filteredExpenses = filteredExpenses.filter(exp => {
      const timestamp = exp.date || exp.createdAt;
      if (!timestamp?.seconds) return false;
      const expenseDate = new Date(timestamp.seconds * 1000);
      return expenseDate >= filters.dateRange!.from && expenseDate <= filters.dateRange!.to;
    });
  }
  
  // Filter by amount range
  if (filters.minAmount !== undefined) {
    filteredExpenses = filteredExpenses.filter(exp => exp.amount >= filters.minAmount!);
  }
  if (filters.maxAmount !== undefined) {
    filteredExpenses = filteredExpenses.filter(exp => exp.amount <= filters.maxAmount!);
  }
  
  return filteredExpenses;
};

/**
 * Calculate category breakdown with percentages
 * @param expenses - Array of expenses
 * @param totalAmount - Total amount for percentage calculation
 * @returns Array of category breakdowns sorted by totalAmount descending
 */
export const calculateCategoryBreakdown = (
  expenses: Expense[],
  totalAmount: number
): Array<{
  category: string;
  count: number;
  totalAmount: number;
  percentage: number;
}> => {
  // Calculate summary stats by category
  const summaryStats: Record<string, number> = {};
  expenses.forEach(expense => {
    const category = expense.category;
    if (!summaryStats[category]) {
      summaryStats[category] = 0;
    }
    summaryStats[category] += expense.amount;
  });
  
  // Calculate category breakdown with percentages
  const categoryBreakdown = Object.entries(summaryStats)
    .map(([category, totalAmount]) => ({
      category,
      count: expenses.filter(exp => exp.category === category).length,
      totalAmount,
      percentage: totalAmount > 0 ? (totalAmount / totalAmount) * 100 : 0
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
  
  // Fix percentage calculation (based on totalAmount parameter)
  return categoryBreakdown.map(item => ({
    ...item,
    percentage: totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0
  }));
};

/**
 * Calculate expense statistics from filtered expenses
 * @param filteredExpenses - Array of filtered expenses
 * @returns ExpenseStats object with totals, averages, and category breakdown
 */
export const calculateExpenseStats = (
  filteredExpenses: Expense[]
): ExpenseStats => {
  // Calculate totals
  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalCount = filteredExpenses.length;
  const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;
  
  // Calculate summary stats by category
  const summaryStats: Record<string, number> = {};
  filteredExpenses.forEach(expense => {
    const category = expense.category;
    if (!summaryStats[category]) {
      summaryStats[category] = 0;
    }
    summaryStats[category] += expense.amount;
  });
  
  // Calculate category breakdown with percentages
  const categoryBreakdown = calculateCategoryBreakdown(filteredExpenses, totalAmount);
  
  return {
    summaryStats,
    categoryBreakdown,
    totalAmount,
    totalCount,
    averageAmount
  };
};

