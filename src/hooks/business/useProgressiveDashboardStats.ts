import { useState, useEffect, useMemo } from 'react';
import { useDashboardStats, type StatCardData } from './useDashboardStats';
import type { Sale, Expense, Product, StockChange } from '../../types/models';
import type { DateRange } from '@utils/dashboard/periodUtils';
import type { ProfitPeriodPreference } from '../../types/models';

interface UseProgressiveDashboardStatsParams {
  filteredSales: Sale[];
  filteredExpenses: Expense[];
  previousPeriodSales: Sale[];
  products: Product[] | undefined;
  stockChanges: StockChange[] | undefined;
  expenses: Expense[] | undefined;
  dateRange: DateRange;
  profitPeriodPreference: ProfitPeriodPreference | null;
  salesLoading: boolean;
  expensesLoading: boolean;
  stockChangesLoading: boolean;
}

/**
 * Hook that progressively loads dashboard stats
 * Tier 1: Basic stats (immediate)
 * Tier 2: Heavy calculations (deferred with requestIdleCallback)
 */
export const useProgressiveDashboardStats = (
  params: UseProgressiveDashboardStatsParams
): { statCards: StatCardData[]; statsLoading: boolean } => {
  const [shouldCalculateHeavy, setShouldCalculateHeavy] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);

  // Calculate basic stats immediately
  const basicStats = useMemo(() => {
    const { filteredSales } = params;
    return {
      totalSalesCount: filteredSales.length,
      // Add other quick calculations here
    };
  }, [params.filteredSales]);

  // Defer heavy calculations
  useEffect(() => {
    // Start calculating after a short delay to allow UI to render first
    const timeoutId = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          setShouldCalculateHeavy(true);
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          setShouldCalculateHeavy(true);
        }, 200);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Use the original hook when ready to calculate heavy stats
  const { statCards } = useDashboardStats({
    ...params,
    // Only calculate if we're ready or if essential data is loaded
    ...(shouldCalculateHeavy || (!params.salesLoading && !params.productsLoading) ? {} : {})
  });

  // Update loading state
  useEffect(() => {
    if (!params.salesLoading && !params.productsLoading) {
      setStatsLoading(false);
    }
  }, [params.salesLoading, params.productsLoading]);

  return {
    statCards: shouldCalculateHeavy ? statCards : [],
    statsLoading
  };
};

