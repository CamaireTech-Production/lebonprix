// src/hooks/useExpenseStats.ts
import { useMemo } from 'react';
import type { Expense } from '../types/models';

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

export interface ExpenseFilterOptions {
  category?: string;
  searchQuery?: string;
  dateRange?: { from: Date; to: Date };
  minAmount?: number;
  maxAmount?: number;
}

export const useExpenseStats = (
  expenses: Expense[],
  filters?: ExpenseFilterOptions
): ExpenseStats => {
  return useMemo(() => {
    // Filter expenses
    let filteredExpenses = expenses.filter(exp => exp.isAvailable !== false);
    
    if (filters) {
      // Filter by category
      if (filters.category && filters.category !== 'All') {
        filteredExpenses = filteredExpenses.filter(exp => exp.category === filters.category);
      }
      
      // Filter by search query
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
    }
    
    // Calculate summary stats by category
    const summaryStats: Record<string, number> = {};
    filteredExpenses.forEach(expense => {
      const category = expense.category;
      if (!summaryStats[category]) {
        summaryStats[category] = 0;
      }
      summaryStats[category] += expense.amount;
    });
    
    // Calculate totals
    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalCount = filteredExpenses.length;
    const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;
    
    // Calculate category breakdown with percentages
    const categoryBreakdown = Object.entries(summaryStats)
      .map(([category, totalAmount]) => ({
        category,
        count: filteredExpenses.filter(exp => exp.category === category).length,
        totalAmount,
        percentage: totalAmount > 0 ? (totalAmount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
    
    // Fix percentage calculation
    const breakdownWithCorrectPercentage = categoryBreakdown.map(item => ({
      ...item,
      percentage: totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0
    }));
    
    return {
      summaryStats,
      categoryBreakdown: breakdownWithCorrectPercentage,
      totalAmount,
      totalCount,
      averageAmount
    };
  }, [expenses, filters]);
};

