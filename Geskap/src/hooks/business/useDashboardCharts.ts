import { useMemo } from 'react';
import type { Sale, Expense, Product } from '../../types/models';
import {
  calculateSalesByCategory,
  calculateExpensesByCategory,
  calculateSalesBySource,
  calculateSalesByPaymentStatus
} from '@utils/calculations/financialCalculations';

interface UseDashboardChartsParams {
  filteredSales: Sale[];
  filteredExpenses: Expense[];
  products: Product[] | undefined;
  sources: Array<{ id: string; name: string }>;
}

interface UseDashboardChartsReturn {
  salesByCategoryData: Array<{ category: string; amount: number }>;
  expensesByCategoryData: Array<{ category: string; amount: number; count: number }>;
  salesBySourceData: Array<{ source: string; amount: number; count: number }>;
  salesByPaymentStatusData: Array<{ status: string; amount: number; count: number }>;
}

/**
 * Hook to calculate all dashboard chart data
 */
export const useDashboardCharts = ({
  filteredSales,
  filteredExpenses,
  products,
  sources
}: UseDashboardChartsParams): UseDashboardChartsReturn => {
  // Calculate sales by product category
  const salesByCategoryData = useMemo(() => 
    calculateSalesByCategory(filteredSales, products || []),
    [filteredSales, products]
  );

  // Calculate expenses by category
  const expensesByCategoryData = useMemo(() => 
    calculateExpensesByCategory(filteredExpenses),
    [filteredExpenses]
  );

  // Calculate sales by source
  const salesBySourceData = useMemo(() => 
    calculateSalesBySource(filteredSales, sources.map(s => ({ id: s.id, name: s.name }))),
    [filteredSales, sources]
  );

  // Calculate sales by payment status
  const salesByPaymentStatusData = useMemo(() => 
    calculateSalesByPaymentStatus(filteredSales),
    [filteredSales]
  );

  return {
    salesByCategoryData,
    expensesByCategoryData,
    salesBySourceData,
    salesByPaymentStatusData
  };
};

