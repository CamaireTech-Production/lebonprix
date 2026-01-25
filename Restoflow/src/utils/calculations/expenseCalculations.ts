// Expense calculations utility for Restoflow
import type { Expense, Timestamp } from '../../types/geskap';

/**
 * Calculate total expenses for a list
 */
export const calculateTotalExpenses = (expenses: Expense[]): number => {
  return expenses.reduce((total, expense) => total + (expense.amount || 0), 0);
};

/**
 * Group expenses by category
 */
export const groupExpensesByCategory = (
  expenses: Expense[]
): Record<string, { total: number; count: number; expenses: Expense[] }> => {
  return expenses.reduce((groups, expense) => {
    const category = expense.category || 'Other';
    if (!groups[category]) {
      groups[category] = { total: 0, count: 0, expenses: [] };
    }
    groups[category].total += expense.amount || 0;
    groups[category].count += 1;
    groups[category].expenses.push(expense);
    return groups;
  }, {} as Record<string, { total: number; count: number; expenses: Expense[] }>);
};

/**
 * Get expenses within a date range
 */
export const filterExpensesByDateRange = (
  expenses: Expense[],
  startDate: Date,
  endDate: Date
): Expense[] => {
  const startTime = startDate.getTime() / 1000;
  const endTime = endDate.getTime() / 1000;

  return expenses.filter((expense) => {
    const expenseDate = expense.date || expense.createdAt;
    if (!expenseDate) return false;

    const expenseTime = (expenseDate as Timestamp).seconds;
    return expenseTime >= startTime && expenseTime <= endTime;
  });
};

/**
 * Calculate expenses by time period
 */
export const calculateExpensesByPeriod = (
  expenses: Expense[],
  period: 'daily' | 'weekly' | 'monthly'
): Record<string, number> => {
  const results: Record<string, number> = {};

  expenses.forEach((expense) => {
    const expenseDate = expense.date || expense.createdAt;
    if (!expenseDate) return;

    const date = new Date((expenseDate as Timestamp).seconds * 1000);
    let key: string;

    switch (period) {
      case 'daily':
        key = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }

    results[key] = (results[key] || 0) + (expense.amount || 0);
  });

  return results;
};

/**
 * Calculate average expense amount
 */
export const calculateAverageExpense = (expenses: Expense[]): number => {
  if (expenses.length === 0) return 0;
  return calculateTotalExpenses(expenses) / expenses.length;
};

/**
 * Get top expense categories
 */
export const getTopExpenseCategories = (
  expenses: Expense[],
  limit: number = 5
): Array<{ category: string; total: number; percentage: number }> => {
  const grouped = groupExpensesByCategory(expenses);
  const total = calculateTotalExpenses(expenses);

  return Object.entries(grouped)
    .map(([category, data]) => ({
      category,
      total: data.total,
      percentage: total > 0 ? (data.total / total) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
};
