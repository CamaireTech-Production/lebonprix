import { useMemo } from 'react';
import type { Sale, Expense } from '../../types/models';
import { differenceInDays } from 'date-fns';
import type { DateRange } from '@utils/dashboard/periodUtils';

interface UseFilteredDashboardDataParams {
  sales: Sale[] | undefined;
  expenses: Expense[] | undefined;
  dateRange: DateRange;
  allSales: Sale[];
}

interface UseFilteredDashboardDataReturn {
  filteredSales: Sale[];
  filteredExpenses: Expense[];
  previousPeriodSales: Sale[];
}

/**
 * Hook to filter sales and expenses by date range and calculate previous period
 */
export const useFilteredDashboardData = ({
  sales,
  expenses,
  dateRange,
  allSales
}: UseFilteredDashboardDataParams): UseFilteredDashboardDataReturn => {
  // Use all sales when available, recent sales for immediate display
  const salesDataToUse = allSales.length > 0 ? allSales : sales || [];

  // Filter sales by date range
  const filteredSales = useMemo(() => {
    return salesDataToUse.filter(sale => {
      if (!sale.createdAt?.seconds) return false;
      const saleDate = new Date(sale.createdAt.seconds * 1000);
      return saleDate >= dateRange.from && saleDate <= dateRange.to;
    });
  }, [salesDataToUse, dateRange]);

  // Filter expenses by date range (excluding soft-deleted)
  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(expense => {
      // First filter out soft-deleted expenses
      if (expense.isAvailable === false) return false;
      // Then apply date range filter
      if (!expense.createdAt?.seconds) return false;
      const expenseDate = new Date(expense.createdAt.seconds * 1000);
      return expenseDate >= dateRange.from && expenseDate <= dateRange.to;
    });
  }, [expenses, dateRange]);

  // Calculate previous period for trend comparisons (same duration, shifted back)
  const previousPeriodSales = useMemo(() => {
    const periodDuration = differenceInDays(dateRange.to, dateRange.from);
    const previousPeriodStart = new Date(dateRange.from);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDuration - 1);
    const previousPeriodEnd = new Date(dateRange.from);
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);

    return salesDataToUse.filter(sale => {
      if (!sale.createdAt?.seconds) return false;
      const saleDate = new Date(sale.createdAt.seconds * 1000);
      return saleDate >= previousPeriodStart && saleDate <= previousPeriodEnd;
    });
  }, [salesDataToUse, dateRange]);

  return {
    filteredSales,
    filteredExpenses,
    previousPeriodSales
  };
};

