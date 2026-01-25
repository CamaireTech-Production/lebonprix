// Financial calculations utility for Restoflow
import type { Sale, Expense, FinanceEntry, Timestamp } from '../../types/geskap';

/**
 * Calculate total revenue from sales
 */
export const calculateTotalRevenue = (sales: Sale[]): number => {
  return sales.reduce((total, sale) => {
    if (sale.isAvailable === false) return total;
    return total + (sale.totalAmount || 0);
  }, 0);
};

/**
 * Calculate total profit from sales
 */
export const calculateTotalProfit = (sales: Sale[]): number => {
  return sales.reduce((total, sale) => {
    if (sale.isAvailable === false) return total;
    return total + (sale.totalProfit || 0);
  }, 0);
};

/**
 * Calculate profit margin percentage
 */
export const calculateProfitMargin = (revenue: number, cost: number): number => {
  if (revenue === 0) return 0;
  return ((revenue - cost) / revenue) * 100;
};

/**
 * Calculate net income (revenue - expenses)
 */
export const calculateNetIncome = (
  sales: Sale[],
  expenses: Expense[]
): { revenue: number; expenses: number; netIncome: number } => {
  const revenue = calculateTotalRevenue(sales);
  const totalExpenses = expenses
    .filter(e => e.isAvailable !== false)
    .reduce((total, expense) => total + (expense.amount || 0), 0);

  return {
    revenue,
    expenses: totalExpenses,
    netIncome: revenue - totalExpenses
  };
};

/**
 * Calculate daily financial summary
 */
export const calculateDailySummary = (
  sales: Sale[],
  expenses: Expense[],
  date: Date
): { revenue: number; expenses: number; profit: number; salesCount: number } => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const dayStartTime = dayStart.getTime() / 1000;
  const dayEndTime = dayEnd.getTime() / 1000;

  const daySales = sales.filter((sale) => {
    if (sale.isAvailable === false) return false;
    const saleTime = (sale.createdAt as Timestamp)?.seconds || 0;
    return saleTime >= dayStartTime && saleTime <= dayEndTime;
  });

  const dayExpenses = expenses.filter((expense) => {
    if (expense.isAvailable === false) return false;
    const expenseDate = expense.date || expense.createdAt;
    const expenseTime = (expenseDate as Timestamp)?.seconds || 0;
    return expenseTime >= dayStartTime && expenseTime <= dayEndTime;
  });

  const revenue = daySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const expenseTotal = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const profit = daySales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);

  return {
    revenue,
    expenses: expenseTotal,
    profit,
    salesCount: daySales.length
  };
};

/**
 * Calculate monthly financial summary
 */
export const calculateMonthlySummary = (
  sales: Sale[],
  expenses: Expense[],
  year: number,
  month: number
): { revenue: number; expenses: number; profit: number; averageOrderValue: number } => {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const monthStartTime = monthStart.getTime() / 1000;
  const monthEndTime = monthEnd.getTime() / 1000;

  const monthSales = sales.filter((sale) => {
    if (sale.isAvailable === false) return false;
    const saleTime = (sale.createdAt as Timestamp)?.seconds || 0;
    return saleTime >= monthStartTime && saleTime <= monthEndTime;
  });

  const monthExpenses = expenses.filter((expense) => {
    if (expense.isAvailable === false) return false;
    const expenseDate = expense.date || expense.createdAt;
    const expenseTime = (expenseDate as Timestamp)?.seconds || 0;
    return expenseTime >= monthStartTime && expenseTime <= monthEndTime;
  });

  const revenue = monthSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const expenseTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const profit = monthSales.reduce((sum, s) => sum + (s.totalProfit || 0), 0);
  const averageOrderValue = monthSales.length > 0 ? revenue / monthSales.length : 0;

  return {
    revenue,
    expenses: expenseTotal,
    profit,
    averageOrderValue
  };
};

/**
 * Calculate food cost percentage
 */
export const calculateFoodCostPercentage = (sales: Sale[]): number => {
  const totalRevenue = calculateTotalRevenue(sales);
  const totalCost = sales.reduce((sum, sale) => {
    if (sale.isAvailable === false) return sum;
    return sum + (sale.totalCost || 0);
  }, 0);

  if (totalRevenue === 0) return 0;
  return (totalCost / totalRevenue) * 100;
};

/**
 * Get revenue trend data for charting
 */
export const getRevenueTrend = (
  sales: Sale[],
  days: number = 30
): Array<{ date: string; revenue: number; profit: number }> => {
  const results: Record<string, { revenue: number; profit: number }> = {};

  // Initialize all days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    results[key] = { revenue: 0, profit: 0 };
  }

  // Fill in sales data
  sales.forEach((sale) => {
    if (sale.isAvailable === false) return;
    const saleDate = new Date((sale.createdAt as Timestamp).seconds * 1000);
    const key = saleDate.toISOString().split('T')[0];
    if (results[key]) {
      results[key].revenue += sale.totalAmount || 0;
      results[key].profit += sale.totalProfit || 0;
    }
  });

  return Object.entries(results)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Calculate outstanding credit amount
 */
export const calculateOutstandingCredit = (sales: Sale[]): number => {
  return sales
    .filter((sale) => sale.status === 'credit' && sale.isAvailable !== false)
    .reduce((sum, sale) => sum + (sale.remainingAmount || 0), 0);
};
